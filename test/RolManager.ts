import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Signer } from "@ethersproject/abstract-signer";
import { expect } from "chai";

import { RolManager } from "../typechain/RolManager";
import { Timelock } from "../typechain/Timelock";

// contract artifacts
import RolManagerArtifact from "../artifacts/contracts/RolManager.sol/RolManager.json";
import TimelockArtifact from "../artifacts/contracts/Timelock.sol/Timelock.json";

const { deployContract } = waffle;

// Types
type User = {
  signer: Signer;
  address: string;
};

describe("Unit tests", function () {
  const timelockDelay = 2; // seconds
  let admin: User;
  let proposer: User;
  let executer: User;
  let anotherProposer: User;
  let expectedRolManagerContractAddress: string;

  beforeEach(async function () {
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
    anotherProposer = {
      signer: signers[1],
      address: await signers[1].getAddress(),
    };
  });

  describe("RolManager", function () {
    let timelock: Timelock;
    let rolManager: RolManager;
    let proposerRole: string;
    let executerRole: string;

    let target: string;
    let value: number;
    let signature: string;
    let callData: string;
    let eta: number;

    beforeEach(async function () {
      // Get RolManager contract expected deploy address
      const adminAddressTransactionCount = await admin.signer.getTransactionCount();
      expectedRolManagerContractAddress = ethers.utils.getContractAddress({
        from: admin.address,
        nonce: adminAddressTransactionCount + 1,
      });

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

      // queue transaction data
      target = rolManager.address;
      value = 0;
      signature = "";

      // Encode call data
      const rolManagerInterface = new ethers.utils.Interface(RolManagerArtifact.abi);
      callData = rolManagerInterface.encodeFunctionData("hasRole", [proposerRole, anotherProposer.address]);
    });

    it("successfully deploys", async function () {
      expect(ethers.utils.isAddress(await timelock.address)).to.be.true;
      expect(ethers.utils.isAddress(await rolManager.address)).to.be.true;
    });

    it("should be timelock admin", async function () {
      expect(await timelock.admin()).to.be.eq(rolManager.address);
    });


    describe("Admin", function () {
      beforeEach(async function () {
        const currentBlock = await admin.signer.provider?.getBlock("latest");
        const currentTimestamp = (await currentBlock?.timestamp) ?? 0;
        eta = currentTimestamp + 3;
      });

      it("should be able to grant role", async function () {
        await rolManager.grantRole(proposerRole, proposer.address);
        expect(await rolManager.hasRole(proposerRole, proposer.address)).to.be.true;
      });

      it("should be able to revoke role", async function () {
        await rolManager.grantRole(proposerRole, proposer.address);
        expect(await rolManager.hasRole(proposerRole, proposer.address)).to.be.true;
        await rolManager.revokeRole(proposerRole, proposer.address);
        expect(await rolManager.hasRole(proposerRole, proposer.address)).to.be.false;
      });

      it("should not be able to queue transaction", async function () {
        await expect(rolManager.queueTransaction(target, value, signature, callData, eta)).to.be.revertedWith(
          "RolManager: sender requires permission",
        );
      });

      it("should not be able to execute queued transaction from timelock", async function () {
        await rolManager.grantRole(proposerRole, proposer.address);

        const currentBlock = await admin.signer.provider?.getBlock("latest");
        const currentTimestamp = (await currentBlock?.timestamp) ?? 0;
        eta = currentTimestamp + 3;

        await expect(
          rolManager.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
        ).to.emit(timelock, "QueueTransaction");
        
        await expect(rolManager.connect(admin.signer).executeTransaction(target, value, signature, callData, eta)).to.be.revertedWith(
          "RolManager: sender requires permission",
        );

      });

      it("should be able to cancel queued transaction from timelock", async function () {
        await rolManager.grantRole(proposerRole, proposer.address);

        const currentBlock = await admin.signer.provider?.getBlock("latest");
        const currentTimestamp = (await currentBlock?.timestamp) ?? 0;
        eta = currentTimestamp + 3;

        await expect(
          rolManager.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
        ).to.emit(timelock, "QueueTransaction");

        await expect(
          rolManager.connect(admin.signer).cancelTransaction(target, value, signature, callData, eta),
        ).to.emit(timelock, "CancelTransaction");

      });
    });

    describe("Proposer", function () {
      beforeEach(async function () {
        await rolManager.grantRole(proposerRole, proposer.address);
        const currentBlock = await admin.signer.provider?.getBlock("latest");
        const currentTimestamp = (await currentBlock?.timestamp) ?? 0;
        eta = currentTimestamp + 3;
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
        
        await expect(rolManager.connect(proposer.signer).cancelTransaction(target, value, signature, callData, eta)).to.be.revertedWith(
          "RolManager: sender requires permission",
        );
      });

      it("should reject executing transaction", async function () {
        await expect(
          rolManager.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
        ).to.emit(timelock, "QueueTransaction");

        await expect(rolManager.connect(proposer.signer).executeTransaction(target, value, signature, callData, eta)).to.be.revertedWith(
          "RolManager: sender requires permission",
        );
      });
    });

    describe("Executer", function () {
      beforeEach(async function () {
        await rolManager.grantRole(proposerRole, proposer.address);
        await rolManager.grantRole(executerRole, executer.address);
        const currentBlock = await admin.signer.provider?.getBlock("latest");
        const currentTimestamp = (await currentBlock?.timestamp) ?? 0;
        eta = currentTimestamp + 3;
      });

      it("should reject queuing transaction", async function () {
        await expect(rolManager.connect(executer.signer).queueTransaction(target, value, signature, callData, eta)).to.be.revertedWith(
          "RolManager: sender requires permission",
        );
      });

      it("should reject canceling transaction", async function () {
        await expect(
          rolManager.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
        ).to.emit(timelock, "QueueTransaction");

        await expect(rolManager.connect(executer.signer).cancelTransaction(target, value, signature, callData, eta)).to.be.revertedWith(
          "RolManager: sender requires permission",
        );
      });

      it("should be able to execute transaction to timelock", async function () {
        await expect(
          rolManager.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
        ).to.emit(timelock, "QueueTransaction");

        await ethers.provider.send( 'evm_mine', [eta]);

        await expect(
          rolManager.connect(executer.signer).executeTransaction(target, value, signature, callData, eta),
        ).to.emit(timelock, "ExecuteTransaction");
      });
    });
  });
});
