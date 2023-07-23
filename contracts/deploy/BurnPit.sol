// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import { IOffsetHelper} from './interfaces/toucan/IOffsetHelper.sol';
import { IERC20} from './interfaces/other/IERC20.sol';
import { IWETH} from './interfaces/other/IWETH.sol';
import { SafeERC20 } from './libraries/SafeERC20.sol';
import { IUniswapV2Router02 } from './interfaces/uniswapv2/IUniswapV2Router02.sol';

contract BurnPit {
    using SafeERC20 for IERC20;

    address[] acceptedTokens = [0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174,
                                0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619,
                                0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270];

    address public sushiRouterAddress = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    address router;

    event TokenBurned(
        uint256 balance,
        address poolToken,
        address[] tco2s,
        uint256[] amounts
    );

    event ETHBurned(
        address poolToken,
        address[] tco2s,
        uint256[] amounts
    );

    /**
     * @notice swaps all eligible tokens for pool token then calls Toucan's OffsetHelper
     * to buy and retire TCO2s
     * @param _amountsOut uint256 array representing minimum swap amounts for eligible ERC20s
     * @param _nctAddr pool token that will be used to retire TCO2s
     */
    function burnTokens(
        uint256[] memory _amountsOut,
        address _nctAddr
    ) public {
        if(address(this).balance > 0){
            swap(_nctAddr, _amountsOut[2]);
        }
        address offsetHelperAddr = 0xFAFcCd01C395e4542BEed819De61f02f5562fAEa;
        address[] memory _acceptedTokens = acceptedTokens;
        for(uint8 i = 0; i < _acceptedTokens.length; i++){
            IERC20 token = IERC20(_acceptedTokens[i]);
            uint256 tokenBalance = token.balanceOf(address(this));
            if(tokenBalance > 0){
                swap(_acceptedTokens[i], _nctAddr, tokenBalance, _amountsOut[i]);
            }
        }

        IERC20 nct = IERC20(_nctAddr);
        uint256 nctBalance = nct.balanceOf(address(this));
        if(nctBalance > 0){
            address[] memory tco2s;
            uint256[] memory amounts;
            nct.safeApprove(offsetHelperAddr, 0);
            nct.safeApprove(offsetHelperAddr, nctBalance);
            (tco2s, amounts) = IOffsetHelper(offsetHelperAddr).autoOffsetUsingPoolToken(_nctAddr, nctBalance);
            emit TokenBurned(nctBalance, _nctAddr, tco2s, amounts);
        }
    }

    receive() external payable{}

    /**
     * @notice generate path for ERC20 swap
     * @param _fromToken The ERC20 token to deposit and swap
     * @param _toToken The token to swap for (will be held within contract)
     * @return path Address array representing the router path for token swap
     */
    function generatePath(address _fromToken, address _toToken)
        internal
        view
        returns (address[] memory)
    {
        if (_fromToken == acceptedTokens[0]) {
            address[] memory path = new address[](2);
            path[0] = _fromToken;
            path[1] = _toToken;
            return path;
        } else {
            address[] memory path = new address[](3);
            path[0] = _fromToken;
            path[1] = acceptedTokens[0];
            path[2] = _toToken;
            return path;
        }
    }

    /**
     * @notice Swap ETH/MATIC tokens for NCT on SushiSwap
     * @param _toToken The token to swap for (will be held within contract)
     * @param _amountOut The amount of _toToken to be swapped
     */
    function swap(address _toToken, uint256 _amountOut) internal {
        uint256 balance = address(this).balance;

        // instantiate router
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // generate path
        address[] memory path = new address[](2);
        path[0] = address(routerSushi.WETH());
        path[1] = address(_toToken);

        // swap
        routerSushi.swapExactETHForTokens{
            value: balance
        }(_amountOut, path, address(this), block.timestamp);
    }

    /**
     * @notice Swap eligible ERC20 tokens for NCT on SushiSwap
     * @param _fromToken The ERC20 token to deposit and swap
     * @param _toToken The token to swap for (will be held within contract)
     * @param _amountIn The amount of _fromToken to be swapped
     * @param _amountOut The amount of _toToken to be swapped
     */
    function swap(
        address _fromToken,
        address _toToken,
        uint256 _amountIn,
        uint256 _amountOut
    ) internal {
        // instantiate router
        IUniswapV2Router02 routerSushi = IUniswapV2Router02(sushiRouterAddress);

        // generate path
        address[] memory path = generatePath(_fromToken, _toToken);

        // approve router
        IERC20(_fromToken).approve(sushiRouterAddress, _amountIn);

        // swap
        routerSushi.swapExactTokensForTokens(
            _amountIn,
            _amountOut,
            path,
            address(this),
            block.timestamp
        );
    }
}