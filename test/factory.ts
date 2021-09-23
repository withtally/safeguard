import { ethers } from "hardhat";
import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";

// types
import { SafeGuard } from "../typechain";

// utils
import { parseEvent, getRandomNum } from "./utils";

// constants
import { INVALID_FAILSAFE_INDEX } from "./constants/error-messages.json";
import { SAFEGUARD_VERSION } from "./constants/values.json";

const randomNum = getRandomNum();

describe("Factory", () => {
  let factory: Contract;

  let admin: SignerWithAddress;
  let proposer: SignerWithAddress;
  let executer: SignerWithAddress;
  let canceler: SignerWithAddress;

  beforeEach(async () => {
    [admin, proposer, executer, canceler] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("SafeGuardFactory");
    factory = await Factory.deploy();
    await factory.deployed();
  });

  it("Should create SafeGuard", async () => {
    const res = await factory
      .connect(admin)
      .createSafeGuard(
        40,
        "My safeGuard",
        admin.address,
        [
          "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1",
          "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63",
          "0xebfdca8e46c0b8dacf9989ee613e35727eadd20a1d5e5ad01a53968c7e5fe07a",
        ],
        [proposer.address, executer.address, canceler.address],
      );
    const txReceipt = await res.wait();

    const event = parseEvent(txReceipt.events, "SafeGuardCreated(address,address,address,string)");
    expect(event, "no event emitted").to.be.not.null;

    const newSafeGuard = (await ethers.getContractAt("SafeGuard", event.args.safeGuardAddress)) as SafeGuard;
    const adminRole = await newSafeGuard.SAFEGUARD_ADMIN_ROLE();
    const proposerRole = await newSafeGuard.PROPOSER_ROLE();
    const executerRole = await newSafeGuard.EXECUTOR_ROLE();
    const cancelerRole = await newSafeGuard.CANCELER_ROLE();

    expect(await newSafeGuard.hasRole(adminRole, admin.address)).to.be.true;
    expect(await newSafeGuard.hasRole(proposerRole, proposer.address)).to.be.true;
    expect(await newSafeGuard.hasRole(executerRole, executer.address)).to.be.true;
    expect(await newSafeGuard.hasRole(cancelerRole, canceler.address)).to.be.true;
    expect(await newSafeGuard.hasRole(adminRole, event.args.admin)).to.be.true;
  });

  it("Should create SafeGuard and assign roles on creation", async () => {
    const res = await factory.connect(admin).createSafeGuard(40, "My safeGuard", admin.address, [], []);
    const txReceipt = await res.wait();

    const event = parseEvent(txReceipt.events, "SafeGuardCreated(address,address,address,string)");
    expect(event, "no event emitted").to.be.not.null;

    const newSafeGuard = (await ethers.getContractAt("SafeGuard", event.args.safeGuardAddress)) as SafeGuard;
    const adminRole = await newSafeGuard.SAFEGUARD_ADMIN_ROLE();

    expect(await newSafeGuard.hasRole(adminRole, admin.address)).to.be.true;
    expect(await newSafeGuard.hasRole(adminRole, event.args.admin)).to.be.true;
  });

  it("Should have 0 safeGuards after deployment", async () => {
    const res = await factory.getSafeGuardCount();
    expect(res).to.be.eq(0);
  });

  it(`Should register ${randomNum} safeGuards`, async () => {
    for (let i = 0; i < randomNum; i++) {
      let res = await factory.connect(admin).createSafeGuard(40, "My safeGuard", admin.address, [], []);
      const txReceipt = await res.wait();

      const resSafeGuardsCount = await factory.getSafeGuardCount();
      const safeGuardAt = await factory.getSafeGuard(i);

      expect(resSafeGuardsCount).to.be.eq(i + 1);
      const event = parseEvent(txReceipt.events, "SafeGuardCreated(address,address,address,string)");
      expect(event.args.safeGuardAddress, "Invalid safeGuard address").to.be.eq(safeGuardAt);

      res = await factory.safeGuardVersion(safeGuardAt);
      expect(res, "Invalid safeGuard version").to.be.eq(SAFEGUARD_VERSION);
      const safeGuardAtIndex = await factory.getSafeGuard(resSafeGuardsCount - 1);
      expect(safeGuardAtIndex, "Invalid safeGuard at index").to.be.eq(safeGuardAt);
    }
  });

  it("Should revert when getting safeGuard with invalid index", async () => {
    await expect(factory.getSafeGuard(5)).to.be.revertedWith(INVALID_FAILSAFE_INDEX);
  });

  it("Should reject create a SafeGuard with roles mismatch", async () => {
    await expect(factory.connect(admin).createSafeGuard(
      40, 
      "My safeGuard", 
      admin.address, 
      [], 
      [admin.address])
    ).revertedWith("SafeGuardFactory::create: roles assignment arity mismatch");
  });
});
