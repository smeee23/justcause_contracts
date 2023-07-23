// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import { IERC20} from './interfaces/other/IERC20.sol';
import { IPool} from './interfaces/aave/IPool.sol';
import { IPoolAddressesProvider} from './interfaces/aave/IPoolAddressesProvider.sol';
import { IWETHGateway} from './interfaces/aave/IWETHGateway.sol';
import { SafeERC20 } from './libraries/SafeERC20.sol';
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title JustCausePool contract
 * @author JustCause
 * This is a contract for lossless donations using Aave v3 on Polygon

   Aave v3 is used to generate interest for crowdfunding

   Contributors deposit tokens into JustCause Pools which deposit
   them into Aave lending protocol

   The interest earned is directed to the receiver associated with
   the Pool

   When Contributors need access to their funds they withdraw original deposit
   and interest accrued is left behind for the receiver to claim

   Functions withdraw() and withdrawDonations() directly call the aave Pool

   Deposits are done through the PoolTracker contract to minimize approvals

 * @dev To be covered by a proxy contract
 * @dev deposits, withdraws, withdrawDonations controlled by the PoolTracker contract (Master)
 **/

contract JustCausePool is Initializable {

    using SafeERC20 for IERC20;

    mapping(address => uint256) private totalDeposits;
    mapping(address => uint256) private interestWithdrawn;
    bool private isBase;

    address poolAddressesProviderAddr;

    address wethGatewayAddr;
    address erc721Addr;

    address[] acceptedTokens;

    address receiver;
    address poolTracker;
    string name;
    string about;
    string picHash;
    string metaUri;
    bool isVerified;

    /**
    * @dev Only tokens that are on the accepted list can be passed
    * to functions marked by this modifier.
    **/
    modifier onlyAllowedTokens(address _tokenAddr){
        bool isAccepted;
        for (uint8 i = 0; i < acceptedTokens.length; i++){
            if(_tokenAddr == acceptedTokens[i]){
                isAccepted = true;
                break;
            }
        }
        require(isAccepted, "token not accepted by jcpool");
        _;
    }

    /**
    * @dev Only Receiver can call functions marked by this modifier.
    **/
    modifier onlyReceiver(){
        require(receiver == msg.sender, "not the receiver");
        _;
        
    }

    /**
    * @dev Only Receiver can call functions marked by this modifier.
    **/
    modifier onlyReceiverOrPoolTrackerVerified(){
        require(receiver == msg.sender ||
                (isVerified && 
                poolTracker == msg.sender), "not authorized");
        _;
    }

    /**
    * @dev Only Master can call functions marked by this modifier.
    **/
    modifier onlyPoolTracker(){
        require(poolTracker == msg.sender, "not the owner");
        _;
    }

    /**
    * @dev Limits string (pool name) to x characters when passed to
    * functions marked by this modifier.
    **/
    modifier strLength(string memory _str, uint8 _limit ){
        bytes memory strBytes = bytes(_str);
        if(strBytes.length > _limit){
            revert("string over character limit");
        }
        _;
    }

    /**
   * @dev Constructor.
   */
    constructor () {
        isBase = true;
    }

    /**
    * @notice Initializes the JustCause Pool proxy contracts.
    * @dev Function is invoked by the PoolTacker contract when a Pool is created.
    * @param _acceptedTokens List of tokens to be accepted by JCP.
    * @param _name String name of JCP.
    * @param _about ipfs hash of pool description of JCP.
    * @param _picHash ipfs hash of pic of JCP.
    * @param _metaUri meta info uri for nft of JCP.
    * @param _receiver address of receiver of JCP donations.
    * @param _poolAddressesProviderAddr address of Aave pool addresses provider
    * @param _wethGatewayAddr address of Aave WETH gateway
    * @param _erc721Addr address of contributor pool NFT
    * @param _isVerified indicates whether JCP is verified
    **/
    function initialize(
        address[] memory _acceptedTokens,
        string memory _name,
        string memory _about,
        string memory _picHash,
        string memory _metaUri,
        address _receiver,
        address _poolAddressesProviderAddr,
        address _wethGatewayAddr,
        address _erc721Addr,
        bool _isVerified

    ) external strLength(_name, 30) initializer() {

        require(isBase == false, "Cannot initialize base");
        require(receiver == address(0), "Initialize already called");

        receiver = _receiver;
        poolTracker = msg.sender;
        name = _name;
        about = _about;
        picHash = _picHash;
        metaUri = _metaUri;
        isVerified = _isVerified;

        poolAddressesProviderAddr = _poolAddressesProviderAddr;
        wethGatewayAddr = _wethGatewayAddr;
        erc721Addr = _erc721Addr;
        acceptedTokens = _acceptedTokens;
    }

    /**
    * @notice Only called by PoolTracker.
    * @dev Function updates total deposits.
    * @param _assetAddress The address of the underlying asset of the reserve
    * @param _amount The amount of supplied assets
    **/
    function deposit(address _assetAddress, uint256 _amount) external  onlyPoolTracker onlyAllowedTokens(_assetAddress){
        totalDeposits[_assetAddress] += _amount;
    }

    /**
    * @notice Only called by PoolTracker.
    * @dev Function withdraws from Aave pools, exchanging this contracts aTokens
    * for reserve tokens for user deposits.
    * @param _assetAddress The address of the underlying asset of the reserve
    * @param _amount The amount of withdraw assets
    * @param _depositor The address making the deposit
    * @param _isETH bool indicating if asset is the base token of network (eth/matic/...)
    **/
    function withdraw(
        address _assetAddress,
        uint256 _amount,
        address _depositor,
        bool _isETH
    ) external onlyPoolTracker {
        address poolAddr = IPoolAddressesProvider(poolAddressesProviderAddr).getPool();
        totalDeposits[_assetAddress] -= _amount;
        if(!_isETH){
            IPool(poolAddr).withdraw(_assetAddress, _amount, _depositor);
        }
        else{
            address wethAddress = IWETHGateway(wethGatewayAddr).getWETHAddress();
            require(wethAddress == _assetAddress, "asset does not match WETHGateway");
            address aTokenAddress = getATokenAddress(wethAddress);
            IERC20(aTokenAddress).safeApprove(wethGatewayAddr, 0);
            IERC20(aTokenAddress).safeApprove(wethGatewayAddr, _amount);
            IWETHGateway(wethGatewayAddr).withdrawETH(poolAddr, _amount, _depositor);
        }
    }

    /**
    * @notice Only called by PoolTracker.
    * @dev Function claims donations for receiver. Calls Aave pools exchanging this
    * contracts aTokens for reserve tokens for interestEarned amount.
    * Calculates interestEarned and subtracts 0.2% fee from claim amount.
    * @param _assetAddress The address of the underlying asset of the reserve
    * @param _feeAddress The address that collects the 0.2% protocol fee
    * @param _isETH bool indicating if asset is the base token of network (eth/matic/...)
    * @param _bpFee fee rate paid to the protocol 0 - 0.4%
    **/
    function withdrawDonations(
        address _assetAddress,
        address _feeAddress,
        bool _isETH,
        uint256 _bpFee)
     external onlyPoolTracker returns(uint256){
        address aTokenAddress = getATokenAddress(_assetAddress);
        uint256 aTokenBalance = IERC20(aTokenAddress).balanceOf(address(this));
        uint256 interestEarned = aTokenBalance - totalDeposits[_assetAddress];
        interestWithdrawn[_assetAddress] += interestEarned;
        uint256 donated = interestEarned;
        address poolAddr = IPoolAddressesProvider(poolAddressesProviderAddr).getPool();

        if(!_isETH){
            if(_bpFee == 0){
                IPool(poolAddr).withdraw(_assetAddress, interestEarned, receiver);
            }
            else{
                uint256 feeValue = calcSplit(interestEarned, _bpFee);
                uint256 newValue = interestEarned - feeValue;
                IPool(poolAddr).withdraw(_assetAddress, newValue, receiver);
                IPool(poolAddr).withdraw(_assetAddress, feeValue, _feeAddress);
                donated = newValue;
            }
        }
        else{
            require(IWETHGateway(wethGatewayAddr).getWETHAddress() == _assetAddress, "asset does not match WETHGateway");
            IERC20(aTokenAddress).safeApprove(wethGatewayAddr, 0);
            IERC20(aTokenAddress).safeApprove(wethGatewayAddr, interestEarned);
            if(_bpFee == 0){
                IWETHGateway(wethGatewayAddr).withdrawETH(poolAddr, interestEarned, receiver);
            }
            else{
                uint256 feeValue = calcSplit(interestEarned, _bpFee);
                uint256 newValue = interestEarned - feeValue;
                IWETHGateway(wethGatewayAddr).withdrawETH(poolAddr, newValue, receiver);
                IWETHGateway(wethGatewayAddr).withdrawETH(poolAddr, feeValue, _feeAddress);
                donated = newValue;
            }
        }

        return donated;
    }

    /**
    * @dev function calculates the fee paid out to protocol for non-verified pools
    * @param _amount the amount to be split
    * @param _bpFee basis points (parts per 10,000) ex. 20 = 0.2%
    * @return uint256 fee to be paid from amount
    **/
    function calcSplit(uint256 _amount, uint256 _bpFee) internal pure returns(uint256) {
        uint256 feeValue = (_amount * _bpFee) / 10000; // % in basis points (parts per 10,000)
        require(feeValue != 0, "not enough funds to claim");
        return feeValue;
    }

    /**
    * @param _about new about reference for pool
    * @param _metaUri updated metaUri reference for pool
    **/
    function setAbout(string memory _about, string memory _metaUri) external onlyReceiver(){
        about = _about;
        metaUri = _metaUri;
    }

    /**
    * @param _metaUri updated metaUri reference for pool
    **/
    function setMetaUri(string memory _metaUri) external onlyReceiver(){
        metaUri = _metaUri;
    }

    /**
    * @return acceptedTokens list of accepted tokens
    **/
    function getAcceptedTokens() external view returns(address[] memory){
        return acceptedTokens;
    }

    /**
    * @return name String name of JCP.
    **/
    function getName() external view returns(string memory){
        return name;
    }

    /**
    * @return about ipfs hash of pool description of JCP.
    **/
    function getAbout() external view returns(string memory){
        return about;
    }

    /**
    * @return picHash ipfs hash of pic of JCP.
    **/
    function getPicHash() external view returns(string memory){
        return picHash;
    }

    /**
    * @return metaUri meta info uri for nft of JCP.
    **/
    function getMetaUri() external view returns(string memory){
        return metaUri;
    }

    /**
    * @return isVerified indicates whether JCP is verified
    **/
    function getIsVerified() external view returns(bool){
        return isVerified;
    }

    /**
    * @return receiver address of receiver of JCP donations.
    **/
    function getRecipient() external view returns(address){
        return receiver;
    }

    /**
    * @return erc721Addr address of the NFT contract for this Pool.
    **/
    function getERC721Address() external view returns(address){
        return erc721Addr;
    }

    /**
    * @notice Returns general pool information
    * @return acceptedTokens List of tokens to be accepted by JCP.
    * @return name String name of JCP.
    * @return about ipfs hash of pool description of JCP.
    * @return picHash ipfs hash of pic of JCP.
    * @return metaUri meta info uri for nft of JCP.
    * @return receiver address of receiver of JCP donations.
    * @return isVerified indicates whether JCP is verified
    **/
    function getPoolInfo() external view returns (address[] memory, address, bool, string memory, string memory, string memory, string memory){
        return (acceptedTokens, receiver, isVerified, metaUri, picHash, about, name);
    }

    /**
    * @param _assetAddress The address of the underlying asset of the reserve
    * @return aTokenAddress address of Aave's aToken for asset
    **/
    function getATokenAddress(address _assetAddress) public view returns(address aTokenAddress){
        address poolAddr = IPoolAddressesProvider(poolAddressesProviderAddr).getPool();
        aTokenAddress = IPool(poolAddr).getReserveData(_assetAddress).aTokenAddress;
    }

    /**
    * @param _assetAddress The address of the underlying asset of the reserve
    * @return totalDeposit total assets deposited in pool
    **/
    function getTotalDeposits(address _assetAddress) public view returns(uint256){
        return totalDeposits[_assetAddress];
    }

    /**
    * @param _assetAddress The address of the underlying asset of the reserve
    * @return unclaimedInterest accrued interest that has not yet been claimed
    **/
    function getUnclaimedInterest(address _assetAddress) public view returns (uint256){
        address aTokenAddress = getATokenAddress(_assetAddress);
        uint256 aTokenBalance = IERC20(aTokenAddress).balanceOf(address(this));
        return aTokenBalance - totalDeposits[_assetAddress];
    }

    /**
    * @param _assetAddress The address of the underlying asset of the reserve
    * @return claimedInterest interest that has been claimed (no longer in contract)
    **/
    function getClaimedInterest(address _assetAddress) public view returns (uint256){
        return interestWithdrawn[_assetAddress];
    }

    /**
    * @param _assetAddress The address of the underlying asset of the reserve
    * @return aTokenBalance Pool balance of aToken for the asset
    **/
    function getATokenBalance(address _assetAddress) public view returns (uint256){
        address aTokenAddress = getATokenAddress(_assetAddress);
        return IERC20(aTokenAddress).balanceOf(address(this));
    }

    /**
    * @param _assetAddress The address of the underlying asset of the reserve
    * @return normalizedIncome reserve's normalized income
    */
    function getReserveNormalizedIncome(address _assetAddress) public view returns(uint256){
        address poolAddr = IPoolAddressesProvider(poolAddressesProviderAddr).getPool();
        return IPool(poolAddr).getReserveNormalizedIncome(_assetAddress);
    }

    /**
    * @param _assetAddress The address of the underlying asset of the reserve
    * @return liquidityIndex reserve's liquidity index
    */
    function getAaveLiquidityIndex(address _assetAddress) public view returns(uint256 liquidityIndex){
        address poolAddr = IPoolAddressesProvider(poolAddressesProviderAddr).getPool();
        liquidityIndex = IPool(poolAddr).getReserveData(_assetAddress).liquidityIndex;
    }

    /**
    * @notice Returns asset specific pool information
    * @param _asset The address of the underlying asset of the reserve
    * @return liquidityIndex reserve's liquidity index
    * @return normalizedIncome reserve's normalized income
    * @return aTokenBalance Pool balance of aToken for the asset
    * @return claimedInterest interest that has been claimed (no longer in contract)
    * @return unclaimedInterest accrued interest that has not yet been claimed
    * @return totalDeposit total assets deposited in pool
    * @return aTokenAddress address of Aave's aToken for asset
    */
    function getPoolTokenInfo(address _asset) external view returns(uint256, uint256, uint256, uint256, uint256, uint256, address){
        return(getAaveLiquidityIndex(_asset), getReserveNormalizedIncome(_asset), getATokenBalance(_asset),
                getClaimedInterest(_asset), getUnclaimedInterest(_asset), getTotalDeposits(_asset), getATokenAddress(_asset));
    }
}