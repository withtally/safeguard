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
  let safeGuard: SafeGuard;
  let adminRole: string;
  let proposerRole: string;
  let executerRole: string;
  let cancelerRole: string;

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

    safeGuard = (await deployContract(admin.signer, SafeGuardArtifact, [
      admin.address,
      ["0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1"],
      [proposerDefinedOnCreation.address],
    ])) as SafeGuard;

    timelock = (await deployContract(admin.signer, TimelockArtifact, [safeGuard.address, timelockDelay])) as Timelock;

    // contract roles
    adminRole = await safeGuard.SAFEGUARD_ADMIN_ROLE();
    proposerRole = await safeGuard.PROPOSER_ROLE();
    executerRole = await safeGuard.EXECUTOR_ROLE();
    cancelerRole = await safeGuard.CANCELER_ROLE();

    // define transaction data
    target = timelock.address;
    value = 0;
    signature = "";

    // Encode call data
    callData = timelockInterface.encodeFunctionData("setPendingAdmin", [proposedAdminAddress]);
  });

  it("should fail deploy if there is a mismatch in the array values", async function (){
    await expect(deployContract(admin.signer, SafeGuardArtifact, [
      admin.address,
      ["0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1"],
      [proposerDefinedOnCreation.address, proposer.address],
    ])).to.be.reverted
  }) 

  it("should successfully deploys", async function () {
    expect(ethers.utils.isAddress(await timelock.address)).to.be.true;
    expect(ethers.utils.isAddress(await safeGuard.address)).to.be.true;
    expect(await safeGuard.hasRole(adminRole, admin.address)).to.be.true;
    expect(await safeGuard.hasRole(proposerRole, proposerDefinedOnCreation.address)).to.be.true;
  });

  it("should be timelock admin", async function () {
    expect(await timelock.admin()).to.be.eq(safeGuard.address);
  });

  describe("Factory", function () {
    it("should be able to set timelock address", async function () {
      await safeGuard.setTimelock(timelock.address);
      expect(await safeGuard.timelock()).to.be.eq(timelock.address);
    });

    it("should not be able to set timelock address if is not the factory", async function () {
      await expect(safeGuard.connect(proposer.signer).setTimelock(timelock.address)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("should not be able to set timelock address if there's one defined", async function () {
      await expect(safeGuard.setTimelock(timelock.address)).to.be.revertedWith(TIMELOCK_ALREADY_DEFINED);
    });
  });

  describe("Admin", function () {
    it("should be able to grant role", async function () {
      await safeGuard.grantRole(proposerRole, proposer.address);
      expect(await safeGuard.hasRole(proposerRole, proposer.address)).to.be.true;
      // check enumerable list available
      expect(await safeGuard.getRoleMemberCount(proposerRole)).to.be.eq(2);
      expect(await safeGuard.getRoleMember(proposerRole, 1)).to.be.eq(proposer.address);
    });

    it("should be able to revoke role", async function () {
      await safeGuard.grantRole(proposerRole, proposer.address);
      expect(await safeGuard.hasRole(proposerRole, proposer.address)).to.be.true;

      await safeGuard.revokeRole(proposerRole, proposer.address);
      expect(await safeGuard.hasRole(proposerRole, proposer.address)).to.be.false;
    });

    it("should not be able to queue transaction", async function () {
      eta = await getTransactionEta(timelockDelay);

      await expect(safeGuard.queueTransaction(target, value, signature, callData, eta)).to.be.revertedWith(
        REQUIRES_PERMISSION,
      );
    });

    it("should not be able to execute queued transaction from timelock", async function () {
      await safeGuard.grantRole(proposerRole, proposer.address);

      eta = await getTransactionEta(timelockDelay);

      await expect(
        safeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "QueueTransaction");

      await expect(
        safeGuard.connect(admin.signer).executeTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith(REQUIRES_PERMISSION);
    });
  });

  describe("Proposer", function () {
    before(async function () {
      await safeGuard.grantRole(proposerRole, proposer.address);
    });

    beforeEach(async function () {
      eta = await getTransactionEta(timelockDelay);
    });

    it("should be able to queue transaction to timelock", async function () {
      await expect(
        safeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
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
        safeGuard.connect(proposer.signer).queueTransactionWithDescription(
          target,
          value,
          signature,
          callData,
          eta,
          description,
        ),
      )
        .to.emit(safeGuard, "QueueTransactionWithDescription")
        .withArgs(expectedHash, target, value, signature, callData, eta, description);
    });

    it("should reject canceling transaction", async function () {
      await expect(
        safeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "QueueTransaction");

      await expect(
        safeGuard.connect(proposer.signer).cancelTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith(REQUIRES_PERMISSION);
    });

    it("should reject executing transaction", async function () {
      await expect(
        safeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "QueueTransaction");

      await expect(
        safeGuard.connect(proposer.signer).executeTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith(REQUIRES_PERMISSION);
    });

    it("should reject queuing the same proposal twice", async function () {
      await expect(
        safeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "QueueTransaction");

      await expect(
        safeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith("SafeGuard::queueTransaction: transaction already queued at eta");
    });
  });

  describe("Executer", function () {
    before(async function () {
      await safeGuard.grantRole(proposerRole, proposer.address);
      await safeGuard.grantRole(executerRole, executer.address);
    });

    beforeEach(async function () {
      eta = await getTransactionEta(timelockDelay);
    });

    it("should reject queuing transaction", async function () {
      await expect(
        safeGuard.connect(executer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith(REQUIRES_PERMISSION);
    });

    it("should reject canceling transaction", async function () {
      await expect(
        safeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "QueueTransaction");

      await expect(
        safeGuard.connect(executer.signer).cancelTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith(REQUIRES_PERMISSION);
    });

    it("should be able to execute transaction to timelock", async function () {
      await expect(
        safeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "QueueTransaction");

      await mineBlockAtTimestamp(eta);

      await expect(
        safeGuard.connect(executer.signer).executeTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "ExecuteTransaction");

      expect(await timelock.pendingAdmin()).to.be.eq(proposedAdminAddress);
    });

    it("should not be able to execute a not queued transaction", async function () {
      // define transaction data
      target = safeGuard.address;
      value = 0;
      signature = "";
      callData = timelockInterface.encodeFunctionData("setPendingAdmin", [proposedAdminAddress]);

      await safeGuard.grantRole(proposerRole, proposer.address);

      eta = await getTransactionEta(timelockDelay);

      await expect(
        safeGuard.connect(executer.signer).executeTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith("SafeGuard::executeTransaction: transaction should be queued");
    });
  });

  describe("Canceler", function () {
    before(async function () {
      await safeGuard.grantRole(cancelerRole, canceler.address);
    });

    beforeEach(async function () {
      eta = await getTransactionEta(timelockDelay);
    });

    it("should be able to cancel queued transaction from timelock", async function () {
      await safeGuard.grantRole(proposerRole, proposer.address);

      eta = await getTransactionEta(timelockDelay);

      await expect(
        safeGuard.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "QueueTransaction");

      await expect(
        safeGuard.connect(canceler.signer).cancelTransaction(target, value, signature, callData, eta),
      ).to.emit(timelock, "CancelTransaction");
    });

    it("should not be able to cancel a not queued transaction", async function () {
      // define transaction data
      target = safeGuard.address;
      value = 0;
      signature = "";
      callData = timelockInterface.encodeFunctionData("setPendingAdmin", [proposedAdminAddress]);

      await safeGuard.grantRole(proposerRole, proposer.address);

      eta = await getTransactionEta(timelockDelay);

      await expect(
        safeGuard.connect(canceler.signer).cancelTransaction(target, value, signature, callData, eta),
      ).to.be.revertedWith("SafeGuard::cancelTransaction: transaction should be queued");
    });
  });
});
