// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import { IERC20} from '../deploy/interfaces/other/IERC20.sol';
import { ITestToken } from '../deploy/interfaces/test/ITestToken.sol';
import { DataTypes } from "../deploy/libraries/DataTypes.sol";

contract PoolMock {

  mapping(address => DataTypes.ReserveData) internal _reserves;

  address aToken;
  address testToken;
  address[] aaveAcceptedTokens;
  uint256 constant INTEREST = 1000000000000000000;
  uint256 constant RESERVE_NORMALIZED_INCOME = 7755432354;
  mapping(address => address) aTokens;

  function setTestTokens(address _aToken, address _testToken_1, address _testToken_2, address _wethToken, address _aWethToken) external {
    aToken = _aToken;
    testToken = _testToken_1;
    aaveAcceptedTokens.push(_testToken_1);
    aaveAcceptedTokens.push(_testToken_2);
    aaveAcceptedTokens.push(_wethToken);

    aTokens[_testToken_1] = _aToken;
    aTokens[_testToken_2] = _aToken;
    aTokens[_wethToken] = _aWethToken;

    _reserves[testToken].liquidityIndex = 1234;
    _reserves[testToken].currentLiquidityRate = 1478;
    _reserves[testToken].variableBorrowIndex = 9087;
    _reserves[testToken].currentVariableBorrowRate = 9087;
    _reserves[testToken].currentStableBorrowRate = 9087;
    _reserves[testToken].lastUpdateTimestamp = 9087;
    _reserves[testToken].id = 9087;
    _reserves[testToken].aTokenAddress = aToken;
    _reserves[testToken].stableDebtTokenAddress = aToken;
    _reserves[testToken].variableDebtTokenAddress = aToken;
    _reserves[testToken].interestRateStrategyAddress = aToken;
    _reserves[testToken].accruedToTreasury = 9087;
    _reserves[testToken].unbacked = 9087;
    _reserves[testToken].isolationModeTotalDebt = 9087;

    _reserves[_wethToken].liquidityIndex = 1234;
    _reserves[_wethToken].currentLiquidityRate = 1478;
    _reserves[_wethToken].variableBorrowIndex = 9087;
    _reserves[_wethToken].currentVariableBorrowRate = 9087;
    _reserves[_wethToken].currentStableBorrowRate = 9087;
    _reserves[_wethToken].lastUpdateTimestamp = 9087;
    _reserves[_wethToken].id = 9087;
    _reserves[_wethToken].aTokenAddress = _aWethToken;
    _reserves[_wethToken].stableDebtTokenAddress = aToken;
    _reserves[_wethToken].variableDebtTokenAddress = aToken;
    _reserves[_wethToken].interestRateStrategyAddress = aToken;
    _reserves[_wethToken].accruedToTreasury = 9087;
    _reserves[_wethToken].unbacked = 9087;
    _reserves[_wethToken].isolationModeTotalDebt = 9087;
  }
    /**
   * @dev Deposits an `amount` of underlying asset into the reserve, receiving in return overlying aTokens.
   * - E.g. User deposits 100 USDC and gets in return 100 aUSDC
   * @param asset The address of the underlying asset to deposit
   * @param amount The amount to be deposited
   * @param onBehalfOf The address that will receive the aTokens, same as msg.sender if the user
   *   wants to receive them on his own wallet, or a different address if the beneficiary of aTokens
   *   is a different wallet
   * @param referralCode Code used to register the integrator originating the operation, for potential rewards.
   *   0 if the action is executed directly by the user, without any middle-man
   **/
    function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referralCode
  ) external {
      require(asset != address(0x0), "asset cannot be burn address");
      require(referralCode == 0, "test referral code must be 0");
      ITestToken(aTokens[asset]).mint(onBehalfOf, amount+INTEREST);
  }

    /**
   * @notice Withdraws an `amount` of underlying asset from the reserve, burning the equivalent aTokens owned
   * E.g. User has 100 aUSDC, calls withdraw() and receives 100 USDC, burning the 100 aUSDC
   * @param asset The address of the underlying asset to withdraw
   * @param amount The underlying amount to be withdrawn
   *   - Send the value type(uint256).max in order to withdraw the whole aToken balance
   * @param to The address that will receive the underlying, same as msg.sender if the user
   *   wants to receive it on his own wallet, or a different address if the beneficiary is a
   *   different wallet
   * @return The final amount withdrawn
   **/
  function withdraw(
    address asset,
    uint256 amount,
    address to
  ) external returns (uint256){
      require(asset != address(0x0), "asset cannot be burn address");
      ITestToken(asset).mint(to, amount);
      ITestToken(aTokens[asset]).burn(msg.sender, amount);
      return amount;
  }

  function getReservesList() external view returns (address[] memory){
    return aaveAcceptedTokens;
  }
  function getReserveData(address _asset) external view returns(DataTypes.ReserveData memory) {
    return _reserves[_asset];
  }

  function getReserveNormalizedIncome(address _asset) external pure returns(uint256) {
    require(_asset != address(0x0), "asset cannot be burn address");
    return RESERVE_NORMALIZED_INCOME;
  }
}