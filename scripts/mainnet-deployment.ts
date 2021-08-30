import { Contract, ContractFactory } from "ethers";
// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import {proposerRole, executerRole, cancelerRole} from '../test/constants';

async function main(): Promise<void> {
  // Hardhat always runs the compile task when running scripts through it.
  // If this runs in a standalone fashion you may want to call compile manually
  // to make sure everything is compiled
  // await run("compile");

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
  console.log("Registry and Factory mainnet addresses deployed to: ", {
    registry: registry.address,
    factory: factory.address,
  });

  const res = await factory
    .connect(deployer)
    .createSafeGuard(
      oneDayTimelock,
      safeGuardDescription,
      process.env.METAMASK_ADDRESS,
      [proposerRole, executerRole, cancelerRole],
      [
        process.env.METAMASK_ADDRESS,
        process.env.METAMASK_ADDRESS,
        process.env.METAMASK_ADDRESS,
      ],
      { gasLimit: 4000000 },
    );

  await res.wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
