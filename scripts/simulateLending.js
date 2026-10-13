import { network } from "hardhat";

async function main() {
    const { ethers, networkName } = await network.create();

    if (networkName !== "hardhatMainnet") {
        throw new Error("Use local Hardhat network");
    }

    const [user] = await ethers.getSigners();
    console.log("Network:", networkName);
    console.log("User:", user.address);

    const stableCoin = await ethers.deployContract("StableCoin", [user.address]);
    await stableCoin.waitForDeployment();
    const coinAddress = await stableCoin.getAddress();

    const stableEngine = await ethers.deployContract("StableEngine", [coinAddress]);
    await stableEngine.waitForDeployment();
    const engineAddress = await stableEngine.getAddress();

    const tx = await stableCoin.transferOwnership(engineAddress);
    await tx.wait();
    console.log("Contracts deployed successfully");

    const depositAmount = ethers.parseEther("2.0");
    await stableEngine.depositCollateral({ value: depositAmount });
    console.log("Collateral deposited: 2.0 ETH");
    console.log("Collateral value: 4000.0 USD");

    const mintAmount = ethers.parseUnits("2666.65", 18);
    await stableEngine.mintStablecoin(mintAmount);
    console.log("DziubaUSD minted: 2666.65 DziubaUSD");

    let hf = await stableEngine.getHealthFactor(user.address);
    console.log("Health Factor:", ethers.formatEther(hf));

    console.log("Trying to withdraw 1 ETH...");
    try {
        const withdrawAmount = ethers.parseEther("1.0");
        await stableEngine.withdrawCollateral(withdrawAmount);
        console.log("Error the transaction should have failed, but it didn't :)");
    } catch (error) {
        console.log("Withdrawal reverted as expected!");
        console.log("Health Factor protection worked!");
    }

    // Крок 4
    const repayAmount = ethers.parseUnits("1000", 18);
    await stableEngine.burnStablecoin(repayAmount);
    console.log("Repaid: 1000 DziubaUSD");

    const safeWithdrawAmount = ethers.parseEther("0.5");
    await stableEngine.withdrawCollateral(safeWithdrawAmount);
    console.log("Safe withdrawal: 0.5 ETH");

    hf = await stableEngine.getHealthFactor(user.address);
    console.log("Final Health Factor:", ethers.formatEther(hf));
    console.log("Lending simulation completed successfully!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});