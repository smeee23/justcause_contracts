// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IJCDepositorERC721{

    struct Deposit {
        uint256 balance;
        uint256 timeStamp;
        address asset;
    }

    /**
    * @notice Initializes the JustCause Pool.
    * @dev Function is invoked by the PoolTacker contract when a Pool is created.
    * @param _jcPool address of JustCause Pool that is associated with this contract.
    **/
    function initialize(address _jcPool) external;

    /**
    * @dev Creates NFT for depositor if first deposit for pool and asset
    * @param _tokenOwner address of depositor
    * @param _timeStamp timeStamp of token creation
    * @param _metaUri meta info uri for nft of JCP
    * @param _asset The address of the underlying asset of the reserve
    * @return tokenId unique tokenId keccak hash of depositor, pool and asset addresses
    **/
    function addFunds(
        address _tokenOwner,
        uint256 _amount,
        uint256 _timeStamp,
        address _asset,
        string memory _metaUri
    ) external returns (bool);


    /**
    * @dev Withdraw balance for depositor
    * @param _tokenOwner address of depositor
    * @param _amount amount to withdraw
    * @param _asset The address of the underlying asset of the reserve
    **/
    function withdrawFunds(
        address _tokenOwner,
        uint256 _amount,
        address _asset
    ) external;


    /**
    * @param _tokenId unique tokenId keccak hash of depositor, pool and asset addresses
    * @return Deposit struct containing info about deposit
    **/
    function getDepositInfo(uint256 _tokenId) external view returns (Deposit memory);

    /**
    * @param _tokenId unique tokenId keccak hash of depositor, pool and asset addresses
    * @return asset balance of user in pool
    **/
    function getUserBalance(uint256 _tokenId) external view returns (uint256);

    /**
    * @dev contract returns all token ids that this user has deposits for
    * @param _tokenOwner owner to look for tokenId's
    * @return asset balance of user in pool
    **/
    function getUserTokens(address _tokenOwner) external view returns(uint256[] memory);

     /**
    * @return jcPool the pool associated with this ERC721 token
    **/
    function getPool() external view returns(address);
}