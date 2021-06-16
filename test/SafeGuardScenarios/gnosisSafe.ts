import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumberish, Contract } from "ethers";
import { expect } from "chai";

// types
import { Timelock, SafeGuard } from "../../typechain";
import { User } from "../types";

// contract artifacts
import SafeGuardArtifact from "../../artifacts/contracts/SafeGuard.sol/SafeGuard.json";
import TimelockArtifact from "../../artifacts/contracts/mocks/Timelock.sol/Timelock.json";
import MockContractArtifact from "../../artifacts/contracts/mocks/MockContract.sol/MockContract.json";

// utils
import { getTransactionEta, generateMultisigWallet, mineBlockAtTimestamp } from "../utils";
import { MockContract } from "../../typechain/MockContract";

// constants
import { REQUIRES_PERMISSION } from "../constants/error-messages.json";

const { deployContract } = waffle;

describe("Unit tests - Gnosis scenario", function () {
  const timelockDelay = 2; // seconds

  let admin: User;
  let walletSigner1: User;
  let walletSigner2: User;
  let multisigDeployer: User;
  let executor: User;
  let gnosisSafeWallet: Contract;

  let timelock: Timelock;
  let SafeGuard: SafeGuard;
  let mockContract: MockContract;
  let proposerRole: string;
  let executorRole: string;

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
    walletSigner1 = {
      signer: signers[1],
      address: await signers[1].getAddress(),
    };
    walletSigner2 = {
      signer: signers[2],
      address: await signers[2].getAddress(),
    };
    multisigDeployer = {
      signer: signers[3],
      address: await signers[3].getAddress(),
    };
    executor = {
      signer: signers[3],
      address: await signers[3].getAddress(),
    };

    const walletSigners = [walletSigner1.address, walletSigner2.address];

    // deploy gnosisSafe wallet
    gnosisSafeWallet = await generateMultisigWallet(walletSigners, 1, multisigDeployer);

    SafeGuard = (await deployContract(admin.signer, SafeGuardArtifact, [admin.address, [], []])) as SafeGuard;

    // contract deployments
    timelock = (await deployContract(admin.signer, TimelockArtifact, [SafeGuard.address, timelockDelay])) as Timelock;

    await SafeGuard.setTimelock(timelock.address);

    mockContract = (await deployContract(admin.signer, MockContractArtifact, [])) as MockContract;
    // contract roles
    proposerRole = await SafeGuard.PROPOSER_ROLE();
    executorRole = await SafeGuard.EXECUTOR_ROLE();

    // give proposer role to multisig
    await SafeGuard.grantRole(proposerRole, multisigDeployer.address);

    // define transaction data
    target = timelock.address;
    value = 0;
    signature = "";

    // Encode call data
    const timelockInterface = new ethers.utils.Interface(TimelockArtifact.abi);
    callData = timelockInterface.encodeFunctionData("setPendingAdmin", [multisigDeployer.address]);
  });

  beforeEach(async function () {
    eta = (await getTransactionEta(timelockDelay)) + 3;
  });

  it("successfully deploys", async function () {
    expect(ethers.utils.isAddress(await timelock.address)).to.be.true;
    expect(ethers.utils.isAddress(await SafeGuard.address)).to.be.true;
    expect(ethers.utils.isAddress(await gnosisSafeWallet.address)).to.be.true;
  });

  it("should have proposer role", async function () {
    expect(await SafeGuard.hasRole(proposerRole, multisigDeployer.address)).to.be.true;
  });

  it("should be able to queue transaction to timelock", async function () {
    await expect(
      SafeGuard.connect(multisigDeployer.signer).queueTransaction(target, value, signature, callData, eta),
    ).to.emit(timelock, "QueueTransaction");
  });

  it("should reject canceling transaction", async function () {
    await expect(
      SafeGuard.connect(multisigDeployer.signer).queueTransaction(target, value, signature, callData, eta),
    ).to.emit(timelock, "QueueTransaction");

    await expect(
      SafeGuard.connect(multisigDeployer.signer).cancelTransaction(target, value, signature, callData, eta),
    ).to.be.revertedWith(REQUIRES_PERMISSION);
  });

  it("should reject executing transaction", async function () {
    await expect(
      SafeGuard.connect(multisigDeployer.signer).queueTransaction(target, value, signature, callData, eta),
    ).to.emit(timelock, "QueueTransaction");

    await expect(
      SafeGuard.connect(multisigDeployer.signer).executeTransaction(target, value, signature, callData, eta),
    ).to.be.revertedWith(REQUIRES_PERMISSION);
  });

  it("should be able to execute transaction queued by multisig", async function () {
    await SafeGuard.grantRole(executorRole, executor.address);
    await expect(
      SafeGuard.connect(multisigDeployer.signer).queueTransaction(target, value, signature, callData, eta),
    ).to.emit(timelock, "QueueTransaction");

    await mineBlockAtTimestamp(eta);

    await expect(
      SafeGuard.connect(executor.signer).executeTransaction(target, value, signature, callData, eta, {
        gasLimit: 2500000,
      }),
    ).to.emit(timelock, "ExecuteTransaction");

    expect(await timelock.pendingAdmin()).to.be.eq(multisigDeployer.address);
  });

  it("should be able to execute eth valued transactions", async function () {
    await SafeGuard.grantRole(executorRole, executor.address);
    const amountToSend = ethers.utils.parseEther("1");

    // define transaction data
    const targetValuedTran = mockContract.address;
    const valueForValuedTran = amountToSend;

    // Encode call data
    const mockContractInterface = new ethers.utils.Interface(MockContractArtifact.abi);
    const callDataValuedTran = mockContractInterface.encodeFunctionData("_transfer", [
      multisigDeployer.address,
      amountToSend,
    ]);

    await expect(
      SafeGuard.connect(multisigDeployer.signer).queueTransaction(
        targetValuedTran,
        valueForValuedTran,
        signature,
        callDataValuedTran,
        eta,
      ),
    ).to.emit(timelock, "QueueTransaction");

    await mineBlockAtTimestamp(eta);

    await expect(
      SafeGuard.connect(executor.signer).executeTransaction(
        targetValuedTran,
        valueForValuedTran,
        signature,
        callDataValuedTran,
        eta,
        {
          value: amountToSend,
          gasLimit: 2500000,
        },
      ),
    ).to.emit(timelock, "ExecuteTransaction");

    expect(await mockContract.lastReceiver()).to.be.eq(multisigDeployer.address);
  });
});
