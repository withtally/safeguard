import { ethers } from "hardhat";
import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";

// utils
import { getRandomNum, parseEvent } from "./utils";

// constants
import { INVALID_FAILSAFE_INDEX, INVALID_VERSION, ALREADY_REGISTERED } from "./constants/error-messages.json";
import { FAILSAFE_VERSION } from "./constants/values.json";
import { RolManager } from "../typechain";

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

    const Factory = await ethers.getContractFactory("RolManagerFactory");
    factory = await Factory.deploy(registry.address);
    await factory.deployed();
  });

  it("Should not allow registering failSafe with version 0", async () => {
    await expect(registry.register(admin.address, 0)).to.be.revertedWith(INVALID_VERSION);
  });

  it("Should have 0 failSafes after deployment", async () => {
    const res = await registry.getFailSafeCount();
    expect(res).to.be.eq(0);
  });

  it(`Should register ${randomNum} failSafes`, async () => {
    for (let i = 0; i < randomNum; i++) {
      let res = await factory.connect(admin).createFailSafe(40);
      const txReceipt = await res.wait();

      const resFailSafesCount = await registry.getFailSafeCount();
      const failSafeAt = await registry.getFailSafe(i);

      expect(resFailSafesCount).to.be.eq(i + 1);
      const event = parseEvent(txReceipt.events, "RolManagerCreated(address,address,address)");
      expect(event.args.rolManagerAddress, "Invalid failSafe address").to.be.eq(failSafeAt);

      res = await registry.failSafeVersion(failSafeAt);
      expect(res, "Invalid failSafe version").to.be.eq(FAILSAFE_VERSION);

      const failSafeAtIndex = await registry.getFailSafe(resFailSafesCount - 1);
      expect(failSafeAtIndex, "Invalid failSafe at index").to.be.eq(failSafeAt);
    }
  });

  it("Should revert when getting failSafe with invalid index", async () => {
    await expect(registry.getFailSafe(5)).to.be.revertedWith(INVALID_FAILSAFE_INDEX);
  });

  describe("Pre deployed failSafe", () => {
    let failSafe: RolManager;

    beforeEach(async () => {
      const res = await factory.connect(admin).createFailSafe(40);
      const txReceipt = await res.wait();

      const event = parseEvent(txReceipt.events, "RolManagerCreated(address,address,address)");
      const newFailSafeAddress = event.args.rolManagerAddress;

      failSafe = (await ethers.getContractAt("RolManager", newFailSafeAddress)) as RolManager;
    });

    it("Should not revert when registering already registered failSafe", async () => {
      await expect(registry.register(failSafe.address, 1)).to.be.revertedWith(ALREADY_REGISTERED);
    });
  });
});
