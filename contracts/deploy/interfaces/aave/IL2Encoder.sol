// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import { DataTypes } from "../../libraries/DataTypes.sol";

interface IL2Encoder {
    function encodeSupplyParams(
        address asset,
        uint256 amount,
        uint16 referralCode
    ) external view returns (bytes32);

    function encodeSupplyWithPermitParams(
        address asset,
        uint256 amount,
        uint16 referralCode,
        uint256 deadline,
        uint8 permitV,
        bytes32 permitR,
        bytes32 permitS
    ) external view returns (bytes32, bytes32, bytes32);

    function encodeWithdrawParams(address asset, uint256 amount) external view returns (bytes32);

    function encodeBorrowParams(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode
    ) external view returns (bytes32);

    function encodeRepayParams(
        address asset,
        uint256 amount,
        uint256 interestRateMode
    ) external view returns (bytes32);

    function encodeRepayWithPermitParams(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint256 deadline,
        uint8 permitV,
        bytes32 permitR,
        bytes32 permitS
    ) external view returns (bytes32, bytes32, bytes32);

    function encodeRepayWithATokensParams(
        address asset,
        uint256 amount,
        uint256 interestRateMode
    ) external view returns (bytes32);

    function encodeSwapBorrowRateMode(address asset, uint256 interestRateMode)
        external
        view
        returns (bytes32);

    function encodeRebalanceStableBorrowRate(address asset, address user) external view returns (bytes32);

    function encodeSetUserUseReserveAsCollateral(address asset, bool useAsCollateral)
        external
        view
        returns (bytes32);

    function encodeLiquidationCall(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover,
        bool receiveAToken
    ) external view returns (bytes32, bytes32);
}