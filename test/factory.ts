import { ethers } from "hardhat";
import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";

// types
import { RolManager } from "../typechain";

// utils
import { parseEvent } from "./utils";

describe("Factory", () => {
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

  it("Should create RolManager", async () => {
    const res = await factory.connect(admin).createFailSafe(40, "My failSafe");
    const txReceipt = await res.wait();

    const event = parseEvent(txReceipt.events, "RolManagerCreated(address,address,address,string)");
    expect(event, "no event emitted").to.be.not.null;

    const newRolManager = (await ethers.getContractAt("RolManager", event.args.rolManagerAddress)) as RolManager;
    const adminRole = await newRolManager.ROLMANAGER_ADMIN_ROLE();

    expect(await newRolManager.hasRole(adminRole, admin.address)).to.be.true;
    expect(await newRolManager.hasRole(adminRole, event.args.admin)).to.be.true;
  });

  it(`Should set registry address`, async () => {
    const res = await factory.registry();
    expect(res, "Registry not match").to.be.eq(registry.address);
  });
});
