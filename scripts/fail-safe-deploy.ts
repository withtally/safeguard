import { Contract, ContractFactory } from "ethers";
import { ethers } from "hardhat";
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";

// utils
import { getExpectedContractAddress } from "../test/utils";

dotenvConfig({ path: resolve(__dirname, "./.env") });

async function main(): Promise<void> {
  if (!process.env.METAMASK_ADDRESS) {
    return console.log("Please set your METAMASK_ADDRESS in a .env file");
  } 
  const metamaskAddress = process.env.METAMASK_ADDRESS;
  const safeAddress = process.env.SAFE_ADDRESS;
  const timelockDelay = 300; // 5 minutes

  // We define the timelock contract Factory
  const Timelock: ContractFactory = await ethers.getContractFactory("Timelock");

  // We construct the user with the expected signer
  const currentSignerUser = {
    signer: Timelock.signer,
    address: metamaskAddress,
  };

  // Get RolManager contract expected deploy address
  const expectedRolManagerContractAddress = await getExpectedContractAddress(currentSignerUser);

  const timelock: Contract = await Timelock.deploy(expectedRolManagerContractAddress, timelockDelay);
  await timelock.deployed();

  const RolManager: ContractFactory = await ethers.getContractFactory("RolManager");
  const rolManager: Contract = await RolManager.deploy(timelock.address, safeAddress);
  await rolManager.deployed();

  const Token: ContractFactory = await ethers.getContractFactory("Comp");
  const token: Contract = await Token.deploy(safeAddress);
  await token.deployed();

  console.log("Contracts deployed to: ", {
    timelock: timelock.address,
    rolManager: rolManager.address,
    token: token.address,
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
