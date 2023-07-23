// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IPoolTracker {

  event AddPool(address pool, string name, address receiver);
  event AddDeposit(address userAddr, address pool, address asset, uint256 amount);
  event WithdrawDeposit(address userAddr, address pool, address asset, uint256 amount);
  event Claim(address userAddr, address receiver, address pool, address asset, uint256 amount);
  event Test(address[] aaveAccepted, address[] causeAccepted );


  /**
    * @dev Emit AddDeposit
    * @param _asset The address of the underlying asset of the reserve
    * @param _amount The amount of supplied assets
    * @param _pool address of JCP
    * @param _isETH bool indicating if asset is the base token of network (eth/matic/...)
  **/
  function addDeposit(uint256 _amount, address _asset, address _pool, bool _isETH) external payable;

  /**
    * @dev Emit WithdrawDeposit
    * @param _asset The address of the underlying asset of the reserve
    * @param _amount The amount of withdraw assets
    * @param _pool address of JCP
    * @param _isETH bool indicating if asset is the base token of network (eth/matic/...)
  **/
  function withdrawDeposit(uint256 _amount, address _asset, address _pool, bool _isETH) external;

  /**
  * @dev Emit Claim
  * @param _asset The address of the underlying asset of the reserve
  * @param _pool address of JCP
  * @param _isETH bool indicating if asset is the base token of network (eth/matic/...)
  **/
  function claimInterest(address _asset, address _pool, bool _isETH) external;


  /**
  * @dev Emit AddPool
  * @notice Creates JCP proxy
  * @param _acceptedTokens List of tokens to be accepted by JCP.
  * @param _name String name of JCP.
  * @param _about ipfs hash of pool description of JCP.
  * @param _picHash ipfs hash of pic of JCP.
  * @param _metaUri meta info uri for nft of JCP.
  * @param _receiver address of receiver of JCP donations.
  **/
  function createJCPoolClone(
      address[] memory _acceptedTokens,
      string  memory _name,
      string  memory _about,
      string  memory _picHash,
      string memory  _metaUri,
      address _receiver
  ) external;

    /**
    * @param feeKey accepts 0 - 4 as keys to set the fixed rate of fees
    **/
    function setBpFee(uint256 feeKey) external;

    /**
    * @return bpFee current bpFee
    **/
    function getBpFee() external view returns(uint256);

  /**
  * @param _asset The address of the underlying asset of the reserve
  * @return tvl of the protocol for a given asset
  **/
  function getTVL(address _asset) external view returns(uint256);

  /**
  * @param _asset The address of the underlying asset of the reserve
  * @return total claimed donation for a given asset
  **/
  function getTotalDonated(address _asset) external view returns(uint256);

  /**
  * @return address of ERC721 for depositors, created on deployment
  **/
  function getDepositorERC721Address() external view returns(address);

  /**
  * @param _user address to check for receiver
  * @return address[] of pools that a user is a receiver for
  **/
  function getReceiverPools(address _user) external view returns(address[] memory);

  /**
  * @return address of validator
  **/
  function getMultiSig() external view returns(address);

  /**
  * @param _user The address of the underlying asset of the reserve
  * @return address[] of pools
  **/
  function getContributions(address _user) external view returns(address[] memory);

  /**
    * @return address of aave pool
    **/
    function getPoolAddr() external view returns(address);

    /**
    * @return address array of aave reserve list
    **/
    function getReservesList() external view returns(address[] memory);

    /**
    * @return address of base JCP, created on deployment
    **/
    function getBaseJCPoolAddress() external view returns(address);

    /**
    * @return list of verified pools
    **/
    function getVerifiedPools() external view returns(address[] memory);
    /**
    * @param _pool address of pool
    * @return true if pool address exists
    **/
    function checkPool(address _pool) external view returns(bool);

    /**
    * @param _name string name of pool
    * @return pool address of a given pool name
    **/
    function getAddressFromName(string memory _name) external view returns(address);
}