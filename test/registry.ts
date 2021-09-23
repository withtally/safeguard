import { ethers } from "hardhat";
import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";

// utils
import { getRandomNum, parseEvent } from "./utils";

// constants
import { INVALID_FAILSAFE_INDEX, INVALID_VERSION, ALREADY_REGISTERED } from "./constants/error-messages.json";
import { SAFEGUARD_VERSION } from "./constants/values.json";
import { SafeGuard } from "../typechain";

const randomNum = getRandomNum();

describe("Registry", () => {
  let factory: Contract;
  let registry: Contract;

  let admin: SignerWithAddress;

  beforeEach(async () => {
    [admin] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("Registry");
    registry = await Registry.deploy();
    await registry.deployed();

    const Factory = await ethers.getContractFactory("SafeGuardFactory");
    factory = await Factory.deploy(registry.address);
    await factory.deployed();
  });

  it("Should not allow registering safeGuard with version 0", async () => {
    await expect(registry.register(admin.address, 0)).to.be.revertedWith(INVALID_VERSION);
  });

  it("Should have 0 safeGuards after deployment", async () => {
    const res = await registry.getSafeGuardCount();
    expect(res).to.be.eq(0);
  });

  it(`Should register ${randomNum} safeGuards`, async () => {
    for (let i = 0; i < randomNum; i++) {
      let res = await factory.connect(admin).createSafeGuard(40, "My safeGuard", admin.address, [], []);
      const txReceipt = await res.wait();

      const resSafeGuardsCount = await registry.getSafeGuardCount();
      const safeGuardAt = await registry.getSafeGuard(i);

      expect(resSafeGuardsCount).to.be.eq(i + 1);
      const event = parseEvent(txReceipt.events, "SafeGuardCreated(address,address,address,string)");
      expect(event.args.safeGuardAddress, "Invalid safeGuard address").to.be.eq(safeGuardAt);

      res = await registry.safeGuardVersion(safeGuardAt);
      expect(res, "Invalid safeGuard version").to.be.eq(SAFEGUARD_VERSION);
      const safeGuardAtIndex = await registry.getSafeGuard(resSafeGuardsCount - 1);
      expect(safeGuardAtIndex, "Invalid safeGuard at index").to.be.eq(safeGuardAt);
    }
  });

  it("Should revert when getting safeGuard with invalid index", async () => {
    await expect(registry.getSafeGuard(5)).to.be.revertedWith(INVALID_FAILSAFE_INDEX);
  });

  describe("Pre deployed safeGuard", () => {
    let safeGuard: SafeGuard;

    beforeEach(async () => {
      const res = await factory.connect(admin).createSafeGuard(40, "My safeGuard", admin.address, [], []);
      const txReceipt = await res.wait();

      const event = parseEvent(txReceipt.events, "SafeGuardCreated(address,address,address,string)");
      const newSafeGuardAddress = event.args.safeGuardAddress;

      safeGuard = (await ethers.getContractAt("SafeGuard", newSafeGuardAddress)) as SafeGuard;
    });

    it("Should not revert when registering already registered safeGuard", async () => {
      await expect(registry.register(safeGuard.address, 1)).to.be.revertedWith(ALREADY_REGISTERED);
    });
  });
});
