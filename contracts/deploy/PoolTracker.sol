// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import { IERC20} from './interfaces/other/IERC20.sol';
import { IPool} from './interfaces/aave/IPool.sol';
import { IPoolAddressesProvider} from './interfaces/aave/IPoolAddressesProvider.sol';
import { IWETHGateway} from './interfaces/aave/IWETHGateway.sol';
import { IJustCausePool } from './interfaces/protocol/IJustCausePool.sol';
import { IJCDepositorERC721 } from './interfaces/protocol/IJCDepositorERC721.sol';
import { JCDepositorERC721 } from './JCDepositorERC721.sol';
import { JustCausePool } from './JustCausePool.sol';

import { SafeERC20 } from './libraries/SafeERC20.sol';
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

/**
 * @title PoolTracker contract
 * @author JustCause
 * @notice Main point of interaction with JustCause Protocol
 * This is a proof of concept starter contract for lossless donations
 *
 * Aave v3 is used to generate interest for crowdfunding
 *
 * PoolTracker contract controls deposit calls to Aave to make
 * approvals needed only once per token. Calls JustCause Pools for
 * withdrawals and claims
 *
 * Controls Owner/Contributor NFT creation and updates for deposits/withdrawals
 *
 * Controls JustCause Pool creation with proxy contracts
 *
 * @dev Deposits, withdraws, and claims for Aave Pools
 * @dev Generate ERC721 token
 **/

contract PoolTracker is ReentrancyGuard {

    using SafeERC20 for IERC20;

    JustCausePool immutable baseJCPool;
    JCDepositorERC721 immutable baseERC721;

    //contract addresses will point to bool if they exist
    mapping(address => bool) private isPool;
    mapping(string => address) private names;
    mapping(address => uint256) private tvl;
    mapping(address => uint256) private totalDonated;
    mapping(address => address[]) private contributors;
    mapping(address => address[]) private receivers;
    address[] private verifiedPools;
    uint256[7] fees;
    uint256 bpFee;
    address immutable multiSig;

    address immutable poolAddressesProviderAddr;
    address immutable wethGatewayAddr;

    event AddPool(address pool, string name, address receiver);
    event AddDeposit(address userAddr, address pool, address asset, uint256 amount);
    event WithdrawDeposit(address userAddr, address pool, address asset, uint256 amount);
    event Claim(address userAddr, address receiver, address pool, address asset, uint256 amount);

    /**
    * @dev Only address that are a pool can be passed to functions marked by this modifier.
    **/
    modifier onlyPools(address _pool){
        require(isPool[_pool], "not pool");
        _;
    }

    /**
    * @dev Only tokens that are accepted by Aave can be used in JCP creation
    **/
    modifier onlyAcceptedTokens(address[] memory causeAcceptedTokens){
        require(causeAcceptedTokens.length <= 10, "token list must be 10 or less");
        address poolAddr = IPoolAddressesProvider(poolAddressesProviderAddr).getPool();
        address[] memory aaveAcceptedTokens = IPool(poolAddr).getReservesList();
        for(uint8 i = 0; i < causeAcceptedTokens.length; i++){
            bool found;
            for(uint8 j = 0; j < aaveAcceptedTokens.length; j++){
                if(causeAcceptedTokens[i] == aaveAcceptedTokens[j]){
                    found = true;
                }
            }
            require(found, "tokens not approved");
        }
        _;
    }

    /**
    * @dev Only tokens that are accepted by Aave can be passed to functions marked by this modifier.
    **/
    modifier onlyAcceptedToken(address _asset){
        address poolAddr = IPoolAddressesProvider(poolAddressesProviderAddr).getPool();
        address[] memory aaveAcceptedTokens = IPool(poolAddr).getReservesList();
        bool found;
        for(uint8 j = 0; j < aaveAcceptedTokens.length; j++){
            if(_asset == aaveAcceptedTokens[j]){
                found = true;
            }
        }
        require(found, "token not approved");
        _;
    }

    /**
    * @dev Only multisig can call functions marked by this modifier.
    **/
    modifier onlyMultiSig(){
        require(multiSig == msg.sender, "not the multiSig");
        _;
    }


    /**
    * @dev Constructor.
    */
    constructor (address _poolAddressesProviderAddr, address _wethGatewayAddr, address _multiSig) {
        multiSig = _multiSig;
        baseJCPool = new JustCausePool();
        baseERC721 = new JCDepositorERC721();

        poolAddressesProviderAddr =  _poolAddressesProviderAddr;
        wethGatewayAddr = address(_wethGatewayAddr);

        fees = [0, 20, 50, 80, 100, 120, 150];
        bpFee = fees[1];
    }

    /**
    * @dev Emit AddDeposit
    * @param _asset The address of the underlying asset of t he reserve
    * @param _amount The amount of supplied assets
    * @param _pool address of JCP
    * @param _isETH bool indicating if asset is the base token of network (eth/matic/...)
    **/
    function addDeposit(
        uint256 _amount,
        address _asset,
        address _pool,
        bool _isETH
    ) onlyPools(_pool) nonReentrant() external payable {
        tvl[_asset] += _amount;
        string memory _metaHash = IJustCausePool(_pool).getMetaUri();
        address poolAddr = IPoolAddressesProvider(poolAddressesProviderAddr).getPool();

        if(_isETH){
            require(IWETHGateway(wethGatewayAddr).getWETHAddress() == _asset, "asset does not match WETHGateway");
            require(msg.value > 0, "msg.value cannot be zero");
            IWETHGateway(wethGatewayAddr).depositETH{value: msg.value}(poolAddr, _pool, 0);
        }
        else {
            require(msg.value == 0, "msg.value is not zero");
            IERC20 token = IERC20(_asset);
            require(token.allowance(msg.sender, address(this)) >= _amount, "sender not approved");
            token.safeTransferFrom(msg.sender, address(this), _amount);
            token.safeApprove(poolAddr, 0);
            token.safeApprove(poolAddr, _amount);
            IPool(poolAddr).deposit(address(token), _amount, _pool, 0);
        }
        IJustCausePool(_pool).deposit(_asset, _amount);
        bool isFirstDeposit = IJCDepositorERC721(IJustCausePool(_pool).getERC721Address()).addFunds(msg.sender, _amount, block.timestamp, _asset, _metaHash);
        if(isFirstDeposit){
            contributors[msg.sender].push(_pool);
        }
        emit AddDeposit(msg.sender, _pool, _asset, _amount);
    }

    /**
    * @dev Emit WithdrawDeposit
    * @param _asset The address of the underlying asset of the reserve
    * @param _amount The amount of withdraw assets
    * @param _pool address of JCP
    * @param _isETH bool indicating if asset is the base token of network (eth/matic/...)
    **/
    function withdrawDeposit(
        uint256 _amount,
        address _asset,
        address _pool,
        bool _isETH
    ) external  onlyPools(_pool) nonReentrant(){

        tvl[_asset] -= _amount;
        IJCDepositorERC721(IJustCausePool(_pool).getERC721Address()).withdrawFunds(msg.sender, _amount, _asset);
        IJustCausePool(_pool).withdraw(_asset, _amount, msg.sender, _isETH);
        emit WithdrawDeposit(msg.sender, _pool, _asset, _amount);
    }

    /**
    * @dev Emit Claim
    * @param _asset The address of the underlying asset of the reserve
    * @param _pool address of JCP
    * @param _isETH bool indicating if asset is the base token of network (eth/matic/...)
    **/
    function claimInterest(
        address _asset,
        address _pool,
        bool _isETH
    ) external onlyPools(_pool) nonReentrant() onlyAcceptedToken(_asset){

        uint256 amount = IJustCausePool(_pool).withdrawDonations(_asset, multiSig, _isETH, bpFee);
        totalDonated[_asset] += amount;
        emit Claim(msg.sender, IJustCausePool(_pool).getRecipient(), _pool, _asset, amount);
    }

    /**
    * @dev Emit AddPool
    * @notice Creates new JustCausePool and JCDepositorERC721 by proxy contract.
    * @param _acceptedTokens List of tokens to be accepted by JCP.
    * @param _name String name of JCP.
    * @param _about ipfs hash of pool description of JCP.
    * @param _picHash ipfs hash of pic of JCP.
    * @param _metaUri meta info uri for nft of JCP.
    * @param _receiver address of receiver of JCP donations.
    **/
    function createJCPoolClone(
        address[] calldata _acceptedTokens,
        string memory _name,
        string memory _about,
        string memory _picHash,
        string memory _metaUri,
        address _receiver
    ) external onlyAcceptedTokens(_acceptedTokens){

        require(names[_name] == address(0), "pool with name already exists");
        address jcpChild = Clones.clone(address(baseJCPool));
        address erc721Child = Clones.clone(address(baseERC721));
        bool isVerified;
        if(msg.sender == multiSig){
            verifiedPools.push(jcpChild);
            isVerified = true;
        }

        IJustCausePool(jcpChild).initialize(
            _acceptedTokens,
            _name,
            _about,
            _picHash,
            _metaUri,
            _receiver,
            poolAddressesProviderAddr,
            wethGatewayAddr,
            erc721Child,
            isVerified
        );
        IJCDepositorERC721(erc721Child).initialize(jcpChild);
        receivers[_receiver].push(jcpChild);
        names[_name] =  jcpChild;

        isPool[jcpChild] = true;
        emit AddPool(jcpChild, _name, _receiver);
    }

    function setAboutVerified(address _pool, string calldata _about) public onlyMultiSig() {
        IJustCausePool(_pool).setAbout(_about);
    }

    /**
    * @param feeKey accepts 0 - 4 as keys to set the fixed rate of fees
    **/
    function setBpFee(uint256 feeKey) public onlyMultiSig() {
        bpFee = fees[feeKey];
    }

    /**
    * @return bpFee current bpFee
    **/
    function getBpFee() public view returns(uint256) {
        return bpFee;
    }

    /**
    * @param _asset The address of the underlying asset of the reserve
    * @return tvl of the protocol for a given asset
    **/
    function getTVL(address _asset) public view returns(uint256){
        return tvl[_asset];
    }

    /**
    * @param _asset The address of the underlying asset of the reserve
    * @return totalDonation claimed donation for a given asset
    **/
    function getTotalDonated(address _asset) public view returns(uint256){
        return totalDonated[_asset];
    }

    /**
    * @return address of ERC721 for depositors, created on deployment
    **/
    function getDepositorERC721Address() public view returns(address){
        return address(baseERC721);
    }

    /**
    * @param _user address to check for receiver
    * @return address[] of pools that a user is a receiver for
    **/
    function getReceiverPools(address _user) public view returns(address[] memory){
        return receivers[_user];
    }

    /**
    * @return address of multiSig
    **/
    function getMultiSig() public view returns(address){
        return multiSig;
    }

    /**
    * @param _user The address of the underlying asset of the reserve
    * @return address[] of pools
    **/
    function getContributions(address _user) public view returns(address[] memory){
        return contributors[_user];
    }

    /**
    * @return address of aave pool
    **/
    function getPoolAddr() public view returns(address){
        address poolAddr = IPoolAddressesProvider(poolAddressesProviderAddr).getPool();
        return poolAddr;
    }

    /**
    * @return address array of aave reserve list
    **/
    function getReservesList() public view returns(address[] memory){
        address poolAddr = IPoolAddressesProvider(poolAddressesProviderAddr).getPool();
        return IPool(poolAddr).getReservesList();
    }

    /**
    * @return address of base JCP, created on deployment
    **/
    function getBaseJCPoolAddress() public view returns(address){
        return address(baseJCPool);
    }

    /**
    * @return list of verified pools
    **/
    function getVerifiedPools() public view returns(address[] memory){
        return verifiedPools;
    }

    /**
    * @param _pool address of pool
    * @return true if pool address exists
    **/
    function checkPool(address _pool) public view returns(bool){
        return isPool[_pool];
    }

    /**
    * @param _name string name of pool
    * @return pool address of a given pool name
    **/
    function getAddressFromName(string calldata _name) external view returns(address){
        return names[_name];
    }
}