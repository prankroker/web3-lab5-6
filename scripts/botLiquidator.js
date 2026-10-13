import { network } from "hardhat";
import fs from "fs";

async function main() {
    const { ethers } = await network.create();
    const [liquidator] = await ethers.getSigners();

    const deployments = JSON.parse(fs.readFileSync("deployments-sepolia.json", "utf-8"));
    const engine = await ethers.getContractAt("StableEngine", deployments.engineAddress);

    const borrowerAddress = liquidator.address;

    console.log("Starting Liquidator Bot...");
    console.log("Monitoring borrower:", borrowerAddress);

    setInterval(async () => {
        try {
            const hf = await engine.getHealthFactor(borrowerAddress);
            const formattedHf = Number(ethers.formatEther(hf));

            console.log(`[${new Date().toLocaleTimeString()}] HF: ${formattedHf}`);

            if (formattedHf < 1.0) {
                console.log("TOXIC POSITION DETECTED! Initiating liquidation...");

                const tx = await engine.liquidate(borrowerAddress);
                console.log("Transaction sent. Waiting for confirmation...");

                const receipt = await tx.wait();
                console.log(`✅ Liquidation successful! Transaction Hash: ${receipt?.hash}`);

                process.exit(0);
            }
        } catch (error) {
            console.error("Error checking position:", error.message);
        }
    }, 12000);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});