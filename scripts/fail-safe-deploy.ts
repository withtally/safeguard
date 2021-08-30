import { Contract, ContractFactory } from "ethers";
import { ethers } from "hardhat";
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
import {proposerRole, executerRole, cancelerRole} from '../test/constants';

dotenvConfig({ path: resolve(__dirname, "./.env") });

async function main(): Promise<void> {
  if (!process.env.DEPLOYER_WALLET_PRIVATE_KEY) {
    return console.log("Please set your DEPLOYER_WALLET_PRIVATE_KEY in a .env file");
  }

  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  // We get the contract to deploy
  const Registry: ContractFactory = await ethers.getContractFactory("Registry");
  const registry: Contract = await Registry.deploy();
  await registry.deployed();

  const Factory: ContractFactory = await ethers.getContractFactory("SafeGuardFactory");
  const factory: Contract = await Factory.deploy(registry.address);
  await factory.deployed();

  const oneDayTimelock = 86400; // 1 day in seconds
  const safeGuardDescription = "Sample SafeGuard";

  // sample safeGuard creation using the factory
  const res = await factory
    .connect(deployer)
    .createSafeGuard(
      oneDayTimelock,
      safeGuardDescription,
      process.env.METAMASK_ADDRESS,
      [proposerRole, executerRole, cancelerRole, ],
      [
        process.env.METAMASK_ADDRESS,
        process.env.METAMASK_ADDRESS,
        process.env.METAMASK_ADDRESS,
      ],
      { gasLimit: 4000000 },
    );

  await res.wait();
  
  console.log("Contracts deployed to: ", {
    registry: registry.address,
    factory: factory.address,
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
