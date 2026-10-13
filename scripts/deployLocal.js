import { network } from "hardhat";

async function main() {
    const { ethers, networkName } = await network.create();

    if (networkName !== "hardhatMainnet") {
        throw new Error("Use local Hardhat network");
    }

    const [deployer] = await ethers.getSigners();

    console.log("Network:", networkName);
    console.log("Deployer:", deployer.address);

    const stableCoin = await ethers.deployContract(
        "StableCoin",
        [deployer.address]
    );
    await stableCoin.waitForDeployment();
    const coinAddress = await stableCoin.getAddress();
    console.log("StableCoin deployed:", coinAddress);

    // 2. Deploy StableEngine
    const stableEngine = await ethers.deployContract(
        "StableEngine",
        [coinAddress]
    );
    await stableEngine.waitForDeployment();
    const engineAddress = await stableEngine.getAddress();
    console.log("StableEngine deployed:", engineAddress);

    const tx = await stableCoin.transferOwnership(engineAddress);
    await tx.wait();
    console.log("Ownership transferred!");

    // 4. Verify ownership
    const newOwner = await stableCoin.owner();
    console.log("StableCoin owner:", newOwner);

    if (newOwner.toLowerCase() !== engineAddress.toLowerCase()) {
        throw new Error("Ownership transfer failed");
    }

    const ethPrice = await stableEngine.mockEthUsdPrice();
    console.log(
        "Mock ETH price:",
        ethers.formatEther(ethPrice),
        "USD"
    );

    console.log("Local deployment successful!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});