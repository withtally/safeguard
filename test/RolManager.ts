import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumberish } from "ethers";

// types
import { Timelock, SafeGuard } from "../typechain";
import { User } from "./types";

// contract artifacts
import SafeGuardArtifact from "../artifacts/contracts/SafeGuard.sol/SafeGuard.json";
import TimelockArtifact from "../artifacts/contracts/mocks/Timelock.sol/Timelock.json";

// utils
import { mineBlockAtTimestamp, getTransactionEta } from "./utils";

// constants
import { REQUIRES_PERMISSION, TIMELOCK_ALREADY_DEFINED } from "./constants/error-messages.json";

const { deployContract } = waffle;

describe("SafeGuard - Unit tests", function () {
  const timelockDelay = 2; // seconds
  const timelockInterface = new ethers.utils.Interface(TimelockArtifact.abi);

  let admin: User;
  let proposer: User;
  let executer: User;
  let canceler: User;
  let proposerDefinedOnCreation: User;
  let proposedAdminAddress: string;

  let timelock: Timelock;
  let SafeGuard: SafeGuard;
  let adminRole: string;
  let proposerRole: string;
  let executerRole: string;
  let cancelerRole: string;
  let creatorRole: string;

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
    canceler = {
      signer: signers[3],
      address: await signers[3].getAddress(),
    };
    proposerDefinedOnCreation = {
      signer: signers[4],
      address: await signers[4].getAddress(),
    };

    proposedAdminAddress = await signers[3].getAddress();

    // contract deployments

    SafeGuard = (await deployContract(admin.signer, SafeGuardArtifact, [
      admin.address,
      ["0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1"],
      [proposerDefinedOnCreation.address],
    ])) as SafeGuard;

    timelock = (await deployContract(admin.signer, TimelockArtifact, [SafeGuard.address, timelockDelay])) as Timelock;

    // contract roles
    adminRole = await SafeGuard.SAFEGUARD_ADMIN_ROLE();
    creatorRole = await SafeGuard.CREATOR_ROLE();
    proposerRole = await SafeGuard.PROPOSER_ROLE();
    executerRole = await SafeGuard.EXECUTOR_ROLE();
    cancelerRole = await SafeGuard.CANCELER_ROLE();

    // define transaction data
    target = timelock.address;
    value = 0;
    signature = "";

    // Encode call data
    callData = timelockInterface.encodeFunctionData("setPendingAdmin", [proposedAdminAddress]);
  });

  it("successfully deploys", async function () {
    expect(ethers.utils.isAddress(await timelock.address)).to.be.true;
    expect(ethers.utils.isAddress(await SafeGuard.address)).to.be.true;
    expect(await SafeGuard.hasRole(adminRole, admin.address)).to.be.true;
    expect(await SafeGuard.hasRole(proposerRole, proposerDefinedOnCreation.address)).to.be.true;
    expect(await SafeGuard.hasRole(creatorRole, admin.address)).to.be.true;
  });

  it("should be timelock admin", async function () {
    expect(await timelock.admin()).to.be.eq(SafeGuard.address);
  });

  describe("Creator", function () {
    it("should be able to set timelock address", async function () {
      await SafeGuard.setTimelock(timelock.address);
      expect(await SafeGuard.timelock()).to.be.eq(timelock.address);
    });

    it("should not be able to set timelock address if is not the creator", async function () {
      await expect(SafeGuard.connect(proposer.signer).setTimelock(timelock.address)).to.be.revertedWith(
        REQUIRES_PERMISSION,
      );
    });

    it("should not be able to set timelock address if there's one defined", async function () {
      await expect(SafeGuard.setTimelock(timelock.address)).to.be.revertedWith(TIMELOCK_ALREADY_DEFINED);
    });
  });

  describe("Admin", function () {
    it("should be able to grant role", async function () {
      await SafeGuard.grantRole(proposerRole, proposer.address);
      expect(await SafeGuard.hasRole(proposerRole, proposer.address)).to.be.true;
      // check enumerable list available
      expect(await SafeGuard.getRoleMemberCount(proposerRole)).to.be.eq(2);
      expect(await SafeGuard.getRoleMember(proposerRole, 1)).to.be.eq(proposer.address);
    });

    it("should be able to revoke role", async function () {
      await SafeGuard.grantRole(proposerRole, proposer.address);
      expect(await SafeGuard.hasRole(proposerRole, proposer.address)).to.be.true;

      await SafeGuard.revokeRole(proposerRole, proposer.address);
      expect(await SafeGuard.hasRole(proposerRole, proposer.address)).to.be.false;
    });

    it("should not be able to queue transaction", async function () {
      eta = await getTransactionEta(timelockDelay);

      await expect(SafeGuard.queueTransaction(target, value, signature, callData, eta, "")).to.be.revertedWith(
        REQUIRES_PERMISSION,
      );
    });

    it("should not be able to execute queued transaction from timelock", async function () {
      await SafeGuard.grantRole(proposerRole, proposer.address);

      eta = await getTransactionEta(timelockDelay);

      await expect(
        SafeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta, ""),
      ).to.emit(timelock, "QueueTransaction");

      await expect(
        SafeGuard.connect(admin.signer).executeTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith(REQUIRES_PERMISSION);
    });
  });

  describe("Proposer", function () {
    before(async function () {
      await SafeGuard.grantRole(proposerRole, proposer.address);
    });

    beforeEach(async function () {
      eta = await getTransactionEta(timelockDelay);
    });

    it("should be able to queue transaction to timelock", async function () {
      await expect(
        SafeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta, ""),
      ).to.emit(timelock, "QueueTransaction");
    });

    it("should be able to queue transaction with description", async function () {
      const description = "My tx description";
      const abiCoder = new ethers.utils.AbiCoder();
      const encodedFucnCall = abiCoder.encode(
        ["address", "uint256", "string", "bytes", "uint256"],
        [target, value, signature, callData, eta],
      );
      const expectedHash = ethers.utils.keccak256(encodedFucnCall);
      await expect(
        SafeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta, description),
      )
        .to.emit(SafeGuard, "QueueTransaction")
        .withArgs(expectedHash, target, value, signature, callData, eta, description);
    });

    it("should reject canceling transaction", async function () {
      await expect(
        SafeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta, ""),
      ).to.emit(timelock, "QueueTransaction");

      await expect(
        SafeGuard.connect(proposer.signer).cancelTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith(REQUIRES_PERMISSION);
    });

    it("should reject executing transaction", async function () {
      await expect(
        SafeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta, ""),
      ).to.emit(timelock, "QueueTransaction");

      await expect(
        SafeGuard.connect(proposer.signer).executeTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith(REQUIRES_PERMISSION);
    });
  });

  describe("Executer", function () {
    before(async function () {
      await SafeGuard.grantRole(proposerRole, proposer.address);
      await SafeGuard.grantRole(executerRole, executer.address);
    });

    beforeEach(async function () {
      eta = await getTransactionEta(timelockDelay);
    });

    it("should reject queuing transaction", async function () {
      await expect(
        SafeGuard.connect(executer.signer).queueTransaction(target, value, signature, callData, eta, ""),
      ).to.be.revertedWith(REQUIRES_PERMISSION);
    });

    it("should reject canceling transaction", async function () {
      await expect(
        SafeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta, ""),
      ).to.emit(timelock, "QueueTransaction");

      await expect(
        SafeGuard.connect(executer.signer).cancelTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith(REQUIRES_PERMISSION);
    });

    it("should be able to execute transaction to timelock", async function () {
      await expect(
        SafeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta, ""),
      ).to.emit(timelock, "QueueTransaction");

      await mineBlockAtTimestamp(eta);

      await expect(
        SafeGuard.connect(executer.signer).executeTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "ExecuteTransaction");

      expect(await timelock.pendingAdmin()).to.be.eq(proposedAdminAddress);
    });
  });

  describe("Canceler", function () {
    before(async function () {
      await SafeGuard.grantRole(cancelerRole, canceler.address);
    });

    beforeEach(async function () {
      eta = await getTransactionEta(timelockDelay);
    });

    it("should be able to cancel queued transaction from timelock", async function () {
      await SafeGuard.grantRole(proposerRole, proposer.address);

      eta = await getTransactionEta(timelockDelay);

      await expect(
        SafeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta, ""),
      ).to.emit(timelock, "QueueTransaction");

      await expect(
        SafeGuard.connect(canceler.signer).cancelTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "CancelTransaction");
    });
  });
});
