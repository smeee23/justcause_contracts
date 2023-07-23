// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.9;

import { IERC20} from '../deploy/interfaces/other/IERC20.sol';
import { ITestToken } from '../deploy/interfaces/test/ITestToken.sol';
import { IPool } from '../deploy/interfaces/aave/IPool.sol';

contract WethGatewayTest {

    address WETH;
    address aWETH;
    mapping(address => uint256) depositors;

    event Test(address _to, uint256 amountToWithdraw);

    function setValues(address _wethAddress, address _aWethAddress) external {
        WETH = _wethAddress;
        aWETH = _aWethAddress;
    }

    function depositETH(
        address _pool,
        address _onBehalfOf,
        uint16 _referralCode
    ) external payable {
        //WETH.deposit{value: msg.value}();
        IPool(_pool).deposit(address(WETH), msg.value, _onBehalfOf, _referralCode);
    }

    /**
    * @dev withdraws the WETH _reserves of msg.sender.
    * @param _pool address of the targeted underlying pool
    * @param _amount amount of aWETH to withdraw and receive native ETH
    * @param _to address of the user who will receive native ETH
    */
    function withdrawETH(
    address _pool,
    uint256 _amount,
    address _to
    ) external {

        uint256 amountToWithdraw = _amount;
        ITestToken(aWETH).transferFrom(msg.sender, address(this), amountToWithdraw);
        IPool(_pool).withdraw(address(WETH), amountToWithdraw, address(this));
        ITestToken(aWETH).burn(msg.sender, _amount);
        _safeTransferETH(_to, amountToWithdraw);
        emit Test(_to, amountToWithdraw);
    }

    function _safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success, 'ETH_TRANSFER_FAILED');
    }

    function getWETHAddress() external view returns (address) {
        return address(WETH);
    }
}