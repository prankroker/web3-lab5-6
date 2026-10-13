// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./StableCoin.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract StableEngine {
    StableCoin public immutable sUsd;
    AggregatorV3Interface public immutable priceFeed;

    uint256 public constant COLLATERAL_RATIO = 150;
    uint256 public constant MIN_HEALTH_FACTOR = 1e18;
    uint256 public constant LIQUIDATION_BONUS = 10;

    mapping(address => uint256) public collateralDeposited;
    mapping(address => uint256) public sUsdMinted;

    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event StablecoinMinted(address indexed user, uint256 amount);
    event StablecoinBurned(address indexed user, uint256 amount);
    event Liquidated(address indexed user, address indexed liquidator, uint256 debtCovered);

    constructor(address _sUsdAddress, address _priceFeedAddress) {
        sUsd = StableCoin(_sUsdAddress);
        priceFeed = AggregatorV3Interface(_priceFeedAddress);
    }

    function depositCollateral() external payable {
        require(msg.value > 0, "Needs more than 0");
        collateralDeposited[msg.sender] += msg.value;
        emit CollateralDeposited(msg.sender, msg.value);
    }

    function mintStablecoin(uint256 _sUsdAmount) external {
        require(_sUsdAmount > 0, "Needs more than 0");
        sUsdMinted[msg.sender] += _sUsdAmount;
        _revertIfHealthFactorIsBroken(msg.sender);

        sUsd.mint(msg.sender, _sUsdAmount);
        emit StablecoinMinted(msg.sender, _sUsdAmount);
    }

    function burnStablecoin(uint256 _amount) external {
        require(_amount > 0, "Needs more than 0");
        require(sUsdMinted[msg.sender] >= _amount, "Burning more than minted");

        sUsdMinted[msg.sender] -= _amount;
        sUsd.burn(msg.sender, _amount);
        emit StablecoinBurned(msg.sender, _amount);
    }

    function withdrawCollateral(uint256 _amount) external {
        require(_amount > 0, "Needs more than 0");
        require(collateralDeposited[msg.sender] >= _amount, "Insufficient collateral");

        collateralDeposited[msg.sender] -= _amount;
        _revertIfHealthFactorIsBroken(msg.sender);

        (bool success, ) = payable(msg.sender).call{value: _amount}("");
        require(success, "ETH transfer failed");
        emit CollateralWithdrawn(msg.sender, _amount);
    }

    function liquidate(address user) external {
        uint256 userHealthFactor = getHealthFactor(user);
        require(userHealthFactor < MIN_HEALTH_FACTOR, "Health factor is ok");

        uint256 debtToCover = sUsdMinted[user];

        uint256 collateralToReward = (debtToCover * 1e18) / getUsdValue(1e18);
        uint256 totalCollateralToReward = collateralToReward + ((collateralToReward * LIQUIDATION_BONUS) / 100);

        require(collateralDeposited[user] >= totalCollateralToReward, "Not enough collateral to liquidate");

        sUsd.burn(msg.sender, debtToCover);
        sUsdMinted[user] = 0;

        collateralDeposited[user] -= totalCollateralToReward;
        (bool success, ) = payable(msg.sender).call{value: totalCollateralToReward}("");
        require(success, "ETH transfer failed");

        emit Liquidated(user, msg.sender, debtToCover);
    }

    function reduceCollateralForTesting(address user, uint256 amount) external {
        require(collateralDeposited[user] >= amount, "Amount exceeds balance");
        collateralDeposited[user] -= amount;
    }

    function getHealthFactor(address user) public view returns (uint256) {
        uint256 debt = sUsdMinted[user];
        if (debt == 0) return type(uint256).max;

        uint256 collateralValueInUsd = getUsdValue(collateralDeposited[user]);
        uint256 collateralAdjustedForThreshold = (collateralValueInUsd * 100) / COLLATERAL_RATIO;
        return (collateralAdjustedForThreshold * 1e18) / debt;
    }

    function getUsdValue(uint256 ethAmount) public view returns (uint256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid oracle price");

        uint256 adjustedPrice = uint256(price) * 1e10;
        return (ethAmount * adjustedPrice) / 1e18;
    }

    function _revertIfHealthFactorIsBroken(address user) internal view {
        uint256 userHealthFactor = getHealthFactor(user);
        require(userHealthFactor >= MIN_HEALTH_FACTOR, "Health factor is broken (under 1.0)");
    }
}