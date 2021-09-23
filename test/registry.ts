import { ethers } from "hardhat";
import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";

// utils
import { getExpectedContractAddress, getRandomNum, parseEvent } from "./utils";

// constants
import { INVALID_FAILSAFE_INDEX } from "./constants/error-messages.json";
import { SAFEGUARD_VERSION } from "./constants/values.json";

const randomNum = getRandomNum();

describe("Registry", () => {
  let factory: Contract;
  let registry: Contract;

  let admin: SignerWithAddress;

  beforeEach(async () => {
    [admin] = await ethers.getSigners();

    const expectedFactoryAddress = await getExpectedContractAddress(admin)

    const Registry = await ethers.getContractFactory("Registry");
    registry = await Registry.deploy(expectedFactoryAddress);
    await registry.deployed();

    const Factory = await ethers.getContractFactory("SafeGuardFactory");
    factory = await Factory.deploy(registry.address);
    await factory.deployed();
  });

  it("Should not allow registering safeGuard if not called from the factory", async () => {
    await expect(registry.register(admin.address, 1)).to.be.revertedWith('Registry: sender requires permission');
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
});
