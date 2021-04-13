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
  const timelockDelay = 5; // seconds
  let admin: User;
  let proposer: User;
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
    
  });

  describe("RolManager", function () {
    let timelock: Timelock;
    let rolManager: RolManager;
    let proposerRole: string;

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

      proposerRole = await rolManager.PROPOSER_ROLE();

      // queue transaction data
      target = rolManager.address;
      value = 0;
      signature = "grantRole(bytes32, string)";

      // Encode call data
      const rolManagerInterface = new ethers.utils.Interface(RolManagerArtifact.abi);
      callData = rolManagerInterface.encodeFunctionData("grantRole", [proposerRole, proposer.address]);
    });

    it("successfully deploys", async function () {
      expect(ethers.utils.isAddress(await timelock.address)).to.be.true;
      expect(ethers.utils.isAddress(await rolManager.address)).to.be.true;
    });

    it("should be timelock admin", async function () {
      expect(await timelock.admin()).to.be.eq(rolManager.address);
    });

    it("should reject queuing from not authorized role", async function () {
      eta = 2;
      await expect(rolManager.queueTransaction(target, value, signature, callData, eta)).to.be.revertedWith(
        "RolManager: sender requires permission",
      );
    });

    describe("Admin", function () {
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
    });

    describe("Proposer", function () {
      beforeEach(async function () {
        await rolManager.grantRole(proposerRole, proposer.address);
      });

      it("should be able to queue transaction to timelock", async function () {
        const currentBlock = await admin.signer.provider?.getBlock("latest");
        const currentTimestamp = (await currentBlock?.timestamp) ?? 0;
        eta = currentTimestamp + 20;

        await expect(
          rolManager.connect(proposer.signer).queueTransaction(target, value, signature, callData, eta),
        ).to.emit(timelock, "QueueTransaction");
      });
    });
  });
});
