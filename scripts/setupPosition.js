import { network } from "hardhat";
import fs from "fs";

async function main() {
    const { ethers, networkName } = await network.create();
    const [borrower] = await ethers.getSigners();

    const deployments = JSON.parse(fs.readFileSync("deployments-sepolia.json", "utf-8"));
    const engine = await ethers.getContractAt("StableEngine", deployments.engineAddress);

    console.log("Borrower:", borrower.address);

    const depositAmount = ethers.parseEther("0.02");
    let tx = await engine.depositCollateral({ value: depositAmount });
    await tx.wait();
    console.log("Deposited 0.05 ETH");

    const usdValue = await engine.getUsdValue(depositAmount);
    console.log("Collateral USD Value:", ethers.formatEther(usdValue));

    const mintAmount = ethers.parseUnits("30", 18);
    tx = await engine.mintStablecoin(mintAmount);
    await tx.wait();
    console.log("Minted 30 DziubaUSD");

    let hf = await engine.getHealthFactor(borrower.address);
    console.log("Current Health Factor:", ethers.formatEther(hf));

    const reduceAmount = ethers.parseEther("0.005");
    tx = await engine.reduceCollateralForTesting(borrower.address, reduceAmount);
    await tx.wait();
    console.log("Collateral reduced by 0.01 ETH for testing");

    hf = await engine.getHealthFactor(borrower.address);
    console.log("New Health Factor:", ethers.formatEther(hf));
    if (hf < ethers.parseEther("1")) {
        console.log("Position is now UNHEALTHY and ready for liquidation!");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});