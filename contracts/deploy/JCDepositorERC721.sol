// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import { IJustCausePool } from './interfaces/protocol/IJustCausePool.sol';
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";

/**
 * @title JCDepositorERC721
 * @author JustCause
 * This is a proof of concept starter contract for lossless donations
 *
 * Aave v3 is used to generate interest for crowdfunding
 *
 * Creates an ERC721 with info regarding each Just Cause Pool depositor
 *
 * Inherets from openzeppelin ERC721 contracts
 *
 **/

contract JCDepositorERC721 is ERC721URIStorageUpgradeable {

    struct Deposit {
        uint256 balance;
        uint256 timeStamp;
        address asset;
    }

    address jcPool;
    address poolTracker;

    //key = keccak hash of depositor, pool and asset addresses
    mapping (uint256 => Deposit) deposits;

    /**
    * @dev Only Master can call functions marked by this modifier.
    **/
    modifier onlyPoolTracker(){
        require(poolTracker == msg.sender, "not the owner");
        _;
    }

    /**
    * @notice Initializes the JCDepositor Token.
    * @dev Function is invoked by the PoolTacker contract when a Pool is created.
    * @param _jcPool address of JustCausePool that is associated with this contract.
    **/
    function initialize(address _jcPool) initializer public {
        __ERC721_init("JCP Contributor Token", "JCPC");
        jcPool = _jcPool;
        poolTracker = msg.sender;
    }

    /**
    * @dev Updates balance for _tokenOwner. Creates NFT for _tokenOwner if first deposit for pool and _asset
    * @param _tokenOwner address of depositor
    * @param _amount timeStamp of token creation
    * @param _timeStamp timeStamp of token creation
    * @param _asset The address of the underlying asset of the reserve
    * @param _metaUri meta info uri for nft of JCP
    * @return bool is this the contributor's fist deposit
    **/
    function addFunds(
        address _tokenOwner,
        uint256 _amount,
        uint256 _timeStamp,
        address _asset,
        string memory _metaUri
    ) public onlyPoolTracker returns (bool) {

        //tokenId is keccak hash of depositor, pool and asset addresses
        uint256 tokenId = uint256(keccak256(abi.encodePacked(_tokenOwner, jcPool, _asset)));
        bool firstDeposit = false;

        if(_exists(tokenId)){
            deposits[tokenId].timeStamp = _timeStamp;
            deposits[tokenId].balance += _amount;
        }
        else{
            deposits[tokenId] = Deposit(_amount, _timeStamp, _asset);
            _mint(_tokenOwner, tokenId);
            _setTokenURI(tokenId, _metaUri);
            firstDeposit = true;
        }

        return firstDeposit;
    }

    /**
    * @dev Calculates tokenId from _tokenOwner, pool, and _asset. Updates balance of depositor for withdraw
    * @param _tokenOwner address of depositor
    * @param _amount amount to withdraw
    * @param _asset The address of the underlying asset of the reserve
    **/
    function withdrawFunds(address _tokenOwner, uint256 _amount, address _asset) external onlyPoolTracker{
        uint256 tokenId = uint256(keccak256(abi.encodePacked(_tokenOwner, jcPool, _asset)));
        require(_exists(tokenId), "tokenId doesn't exist");

        uint256 balance = deposits[tokenId].balance;
        require(balance >= _amount, "insufficient balance");
        balance -= _amount;
        if(balance == 0){
            deposits[tokenId].timeStamp = 0;
        }
        deposits[tokenId].balance = balance;
    }

    /**
    * @param _tokenId unique tokenId keccak hash of depositor, pool and asset addresses
    * @return Deposit struct containing info about deposit
    **/
    function getDepositInfo(uint256 _tokenId) public view returns (Deposit memory){
        return deposits[_tokenId];
    }

    /**
    * @param _tokenId unique tokenId keccak hash of depositor, pool and asset addresses
    * @return asset balance of user in pool
    **/
    function getUserBalance(uint256 _tokenId) public view returns (uint256){
        return deposits[_tokenId].balance;
    }

    /**
    * @dev function returns an int for all assets accepted by the Pool. It returns tokenIds for each asset deposited by _tokenOwner.
    * @param _tokenOwner owner to look for tokenId's
    * @return ids uint256[] of user deposits
    **/
    function getUserTokens(address _tokenOwner) external view returns(uint256[] memory){
        address[] memory assets = IJustCausePool(jcPool).getAcceptedTokens();
        uint256 len = assets.length;
        uint256[] memory ids = new uint256[](len);
        for(uint256 i = 0; i < len; i++){
            uint256 tokenId = uint256(keccak256(abi.encodePacked(_tokenOwner, jcPool, assets[i])));
            if(_exists(tokenId)){
                ids[i] = tokenId;
            }
        }
        return ids;
    }

    /**
    * @return jcPool the pool associated with this ERC721 token
    **/
    function getPool() public view returns(address){
        return jcPool;
    }

    /**
    * @dev function overrides _beforeTokenTransfer and does not allow token transfers.
    * @param from address
    * @param to address
    * @param tokenId uint token to send
    **/
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        override(ERC721Upgradeable)
    {
        require(from == address(0), "non-transferrable");
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
}