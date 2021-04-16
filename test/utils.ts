import { ethers, waffle } from "hardhat";
import { ParamType } from "ethers/lib/utils";
import GnosisSafeArtifact from "@gnosis.pm/safe-contracts/build/contracts/GnosisSafe.json";
import GnosisProxyFactoryArtifact from "@gnosis.pm/safe-contracts/build/contracts/GnosisSafeProxyFactory.json";
import { Event, Signer } from "ethers";
const { deployContract } = waffle;

// types
import { User } from "./types";

// constants
import { Address0 } from "./constants";

export const mineBlockAtTimestamp = async (timestamp: number): Promise<any> => {
  await ethers.provider.send("evm_mine", [timestamp]);
};

export const getCurrentBlockTimestamp = async (): Promise<number> => {
  const currentBlock = await ethers.provider?.getBlock("latest");
  const currentTimestamp = currentBlock?.timestamp ?? 0;
  return currentTimestamp;
};

export const getTransactionEta = async (timelockDelay: number): Promise<number> => {
  const currentTimestamp = await getCurrentBlockTimestamp();
  const transactionEta = currentTimestamp + timelockDelay + 1;

  return transactionEta;
};

export const getExpectedContractAddress = async (deployer: User): Promise<string> => {
  const adminAddressTransactionCount = await deployer.signer.getTransactionCount();
  const expectedContractAddress = ethers.utils.getContractAddress({
    from: deployer.address,
    nonce: adminAddressTransactionCount + 1,
  });

  return expectedContractAddress;
};

export const encodeParameters = (types: (string | ParamType)[], values: any[]): string => {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
};

export const generateMultisigWallet = async (signers: string[], treshold: number, deployer: User): Promise<any> => {
  const gnosisSafeMasterCopy = await deployContract(deployer.signer, GnosisSafeArtifact, []);

  // Create Gnosis Safe
  const gnosisSafeInterface = new ethers.utils.Interface(GnosisSafeArtifact.abi);
  const gnosisSafeData = gnosisSafeInterface.encodeFunctionData("setup", [
    signers,
    treshold,
    Address0,
    "0x",
    Address0,
    Address0,
    0,
    Address0,
  ]);
  const gnosisProxyFactory = await deployContract(deployer.signer, GnosisProxyFactoryArtifact, []);

  try {
    // deploy gnosisSafe wallet
    const proxyCreationTx = await gnosisProxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData);
    const proxyCreationTxReceipt = await proxyCreationTx.wait();

    const gnosisSafe = await getParamFromTxEvent(
      proxyCreationTxReceipt.events,
      "ProxyCreation",
      gnosisProxyFactory.address,
      "proxy",
      deployer.signer,
    );

    return gnosisSafe;
  } catch (e) {
    console.log("error", e);
  }
};

async function getParamFromTxEvent(
  events: Event[],
  eventName: string,
  contractAddress: string,
  paramName: string,
  signer: Signer,
) {
  const event = events.find(
    (eventItem: Event) => eventItem.event === eventName && eventItem.address === contractAddress,
  );
  const eventArguments = event?.args;
  const param = eventArguments ? eventArguments[paramName] : "";

  if (param) {
    const gnosisInterface = new ethers.utils.Interface(GnosisSafeArtifact.abi);
    const contract = new ethers.Contract(param, gnosisInterface, signer);
    return contract;
  } else {
    return param;
  }
}
