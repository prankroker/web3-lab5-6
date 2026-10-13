import { network } from "hardhat";
import fs from "fs";

async function main() {
    const { ethers, networkName } = await network.create();
    const [deployer] = await ethers.getSigners();
    console.log("Network:", networkName);
    console.log("Deployer:", deployer.address);

    const stableCoin = await ethers.deployContract("StableCoin", [deployer.address]);
    await stableCoin.waitForDeployment();
    const coinAddress = await stableCoin.getAddress();
    console.log("DziubaUSD deployed:", coinAddress);

    const priceFeedAddress = "0x694AA1769357215DE4FAC081bf1f309aDC325306";

    const stableEngine = await ethers.deployContract("StableEngine", [coinAddress, priceFeedAddress]);
    await stableEngine.waitForDeployment();
    const engineAddress = await stableEngine.getAddress();
    console.log("StableEngine deployed:", engineAddress);

    const tx = await stableCoin.transferOwnership(engineAddress);
    await tx.wait();
    console.log("Ownership transferred to StableEngine!");
    const addresses = { coinAddress, engineAddress };
    fs.writeFileSync("deployments-sepolia.json", JSON.stringify(addresses, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});