
import { ethers } from "hardhat";

// types
import {User} from './types';

export const mineBlockAtTimestamp = async (timestamp: number): Promise<any> => {
  await ethers.provider.send( 'evm_mine', [timestamp]);
}

export const getCurrentBlockTimestamp = async (): Promise<number> => {
  const currentBlock = await ethers.provider?.getBlock("latest");
  const currentTimestamp =  currentBlock?.timestamp ?? 0;
  return currentTimestamp;
}

export const getTransactionEta = async (timelockDelay: number): Promise<number> => {
  const currentTimestamp =  await getCurrentBlockTimestamp();
  const transactionEta = currentTimestamp + timelockDelay + 1;

  return transactionEta;
}

export const getExpectedContractAddress = async (deployer: User): Promise<string> => {
  const adminAddressTransactionCount = await deployer.signer.getTransactionCount();
  const expectedContractAddress = ethers.utils.getContractAddress({
        from: deployer.address,
        nonce: adminAddressTransactionCount + 1,
  });

  return expectedContractAddress;
}