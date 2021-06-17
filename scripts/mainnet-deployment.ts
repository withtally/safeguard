import { Contract, ContractFactory } from "ethers";
// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main(): Promise<void> {
  // Hardhat always runs the compile task when running scripts through it.
  // If this runs in a standalone fashion you may want to call compile manually
  // to make sure everything is compiled
  // await run("compile");

  if (!process.env.DEPLOYER_WALLET_PRIVATE_KEY) {
    return console.log("Please set your DEPLOYER_WALLET_PRIVATE_KEY in a .env file");
  }

  if (
    !process.env.UNISWAP_MULTISIG_ADDRESS ||
    !process.env.STABLE_MULTISIG_ADDRESS ||
    !process.env.KEN_PERSONAL_ADDRESS ||
    !process.env.BORIS_PERSONAL_ADDRESS
  ) {
    return console.log("ERROR - Please set all the assignment addresses (multisigs, personal) in a .env the file");
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

  const proposerRole = "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1";
  const executerRole = "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63";
  const cancelerRole = "0xebfdca8e46c0b8dacf9989ee613e35727eadd20a1d5e5ad01a53968c7e5fe07a";

  const uniswapMultisigAddress = process.env.UNISWAP_MULTISIG_ADDRESS;
  const theStableMultisigAddress = process.env.STABLE_MULTISIG_ADDRESS;
  const kenPersonalAddress = process.env.KEN_PERSONAL_ADDRESS;
  const borisPersonalAddress = process.env.BORIS_PERSONAL_ADDRESS;

  const oneDayTimelock = 86400; // 1 day in seconds
  const safeGuardDescription = "Unisap Grants SafeGuard - The Stable";
  console.log("Registry and Factory mainnet addresses deployed to: ", {
    registry: registry.address,
    factory: factory.address,
  });

  const res = await factory
    .connect(deployer)
    .createSafeGuard(
      oneDayTimelock,
      safeGuardDescription,
      uniswapMultisigAddress,
      [proposerRole, executerRole, cancelerRole, proposerRole, executerRole, cancelerRole, executerRole, cancelerRole],
      [
        uniswapMultisigAddress,
        uniswapMultisigAddress,
        uniswapMultisigAddress,
        theStableMultisigAddress,
        theStableMultisigAddress,
        kenPersonalAddress,
        borisPersonalAddress,
        borisPersonalAddress,
      ],
      { gasLimit: 4000000 },
    );

  const txReceipt = await res.wait();
  console.log("Firs deploymet tx Receipt: ", {
    txReceipt,
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
