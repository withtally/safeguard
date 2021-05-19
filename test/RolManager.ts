import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumberish } from "ethers";

// types
import { Timelock, RolManager } from "../typechain";
import { User } from "./types";

// contract artifacts
import RolManagerArtifact from "../artifacts/contracts/RolManager.sol/RolManager.json";
import TimelockArtifact from "../artifacts/contracts/Timelock.sol/Timelock.json";

// utils
import { mineBlockAtTimestamp, getTransactionEta, getExpectedContractAddress } from "./utils";

const { deployContract } = waffle;

describe("RolManager - Unit tests", function () {
  const timelockDelay = 2; // seconds

  let admin: User;
  let proposer: User;
  let executer: User;
  let proposedAdminAddress: string;
  let expectedRolManagerContractAddress: string;

  let timelock: Timelock;
  let rolManager: RolManager;
  let proposerRole: string;
  let executerRole: string;

  let target: string;
  let value: BigNumberish;
  let signature: string;
  let callData: string;
  let eta: number;

  before(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    admin = {
      signer: signers[0],
      address: await signers[0].getAddress(),
    };
    proposer = {
      signer: signers[1],
      address: await signers[1].getAddress(),
    };
    executer = {
      signer: signers[2],
      address: await signers[2].getAddress(),
    };

    proposedAdminAddress = await signers[3].getAddress();

    // Get RolManager contract expected deploy address
    expectedRolManagerContractAddress = await getExpectedContractAddress(admin);

    // contract deployments
    timelock = (await deployContract(admin.signer, TimelockArtifact, [
      expectedRolManagerContractAddress,
      timelockDelay,
    ])) as Timelock;

    rolManager = (await deployContract(admin.signer, RolManagerArtifact, [
      timelock.address,
      admin.address,
    ])) as RolManager;

    // contract roles
    proposerRole = await rolManager.PROPOSER_ROLE();
    executerRole = await rolManager.EXECUTOR_ROLE();

    // define transaction data
    target = timelock.address;
    value = 0;
    signature = "";

    // Encode call data
    const timelockInterface = new ethers.utils.Interface(TimelockArtifact.abi);
    callData = timelockInterface.encodeFunctionData("setPendingAdmin", [proposedAdminAddress]);
  });

  it("successfully deploys", async function () {
    expect(ethers.utils.isAddress(await timelock.address)).to.be.true;
    expect(ethers.utils.isAddress(await rolManager.address)).to.be.true;
  });

  it("should be timelock admin", async function () {
    expect(await timelock.admin()).to.be.eq(rolManager.address);
  });

  describe("Admin", function () {
    it("should be able to grant role", async function () {
      await rolManager.grantRole(proposerRole, proposer.address);
      expect(await rolManager.hasRole(proposerRole, proposer.address)).to.be.true;
      // check enumerable list available
      expect(await rolManager.getRoleMemberCount(proposerRole)).to.be.eq(1);
      expect(await rolManager.getRoleMember(proposerRole, 0)).to.be.eq(proposer.address);
    });

    it("should be able to revoke role", async function () {
      await rolManager.grantRole(proposerRole, proposer.address);
      expect(await rolManager.hasRole(proposerRole, proposer.address)).to.be.true;

      await rolManager.revokeRole(proposerRole, proposer.address);
      expect(await rolManager.hasRole(proposerRole, proposer.address)).to.be.false;
    });

    it("should not be able to queue transaction", async function () {
      eta = await getTransactionEta(timelockDelay);

      await expect(rolManager.queueTransaction(target, value, signature, callData, eta)).to.be.revertedWith(
        "RolManager: sender requires permission",
      );
    });

    it("should not be able to execute queued transaction from timelock", async function () {
      await rolManager.grantRole(proposerRole, proposer.address);

      eta = await getTransactionEta(timelockDelay);

      await expect(
        rolManager.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "QueueTransaction");

      await expect(
        rolManager.connect(admin.signer).executeTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith("RolManager: sender requires permission");
    });

    it("should be able to cancel queued transaction from timelock", async function () {
      await rolManager.grantRole(proposerRole, proposer.address);

      eta = await getTransactionEta(timelockDelay);

      await expect(
        rolManager.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "QueueTransaction");

      await expect(rolManager.connect(admin.signer).cancelTransaction(target, value, signature, callData, eta)).to.emit(
        timelock,
        "CancelTransaction",
      );
    });
  });

  describe("Proposer", function () {
    before(async function () {
      await rolManager.grantRole(proposerRole, proposer.address);
    });

    beforeEach(async function () {
      eta = await getTransactionEta(timelockDelay);
    });

    it("should be able to queue transaction to timelock", async function () {
      await expect(
        rolManager.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "QueueTransaction");
    });

    it("should reject canceling transaction", async function () {
      await expect(
        rolManager.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "QueueTransaction");

      await expect(
        rolManager.connect(proposer.signer).cancelTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith("RolManager: sender requires permission");
    });

    it("should reject executing transaction", async function () {
      await expect(
        rolManager.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "QueueTransaction");

      await expect(
        rolManager.connect(proposer.signer).executeTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith("RolManager: sender requires permission");
    });
  });

  describe("Executer", function () {
    before(async function () {
      await rolManager.grantRole(proposerRole, proposer.address);
      await rolManager.grantRole(executerRole, executer.address);
    });

    beforeEach(async function () {
      eta = await getTransactionEta(timelockDelay);
    });

    it("should reject queuing transaction", async function () {
      await expect(
        rolManager.connect(executer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith("RolManager: sender requires permission");
    });

    it("should reject canceling transaction", async function () {
      await expect(
        rolManager.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "QueueTransaction");

      await expect(
        rolManager.connect(executer.signer).cancelTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith("RolManager: sender requires permission");
    });

    it("should be able to execute transaction to timelock", async function () {
      await expect(
        rolManager.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "QueueTransaction");

      await mineBlockAtTimestamp(eta);

      await expect(
        rolManager.connect(executer.signer).executeTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "ExecuteTransaction");

      expect(await timelock.pendingAdmin()).to.be.eq(proposedAdminAddress);
    });
  });
});
