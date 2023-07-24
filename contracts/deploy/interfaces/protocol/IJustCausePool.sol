// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IJustCausePool {

    /**
    * @notice Initializes the JustCause Pool proxy contracts.
    * @dev Function is invoked by the PoolTacker contract when a JustCausePool proxy is created.
    * @param _acceptedTokens List of tokens to be accepted by JCP.
    * @param _name String name of JCP.
    * @param _about ipfs hash of pool description of JCP.
    * @param _picHash ipfs hash of pic of JCP.
    * @param _metaUri meta info uri for nft of JCP.
    * @param _receiver address of receiver of JCP donations.
    * @param _erc721Addr address of nft contract for pool.
    * @param _isVerified indicates whether JCP is verified
    **/
    function initialize(address[] memory _acceptedTokens, string calldata _name, string calldata _about, string calldata _picHash, string calldata _metaUri, address _receiver, address _poolAddressesProviderAddr, address _wethGatewayAddr, address _erc721Addr, bool _isVerified) external;

    /**
    * @notice Only called by PoolTracker.
    * @dev Function updates total deposits.
    * @param _assetAddress The address of the underlying asset of the reserve
    * @param _amount The amount of supplied assets
    **/
    function deposit(address _assetAddress, uint256 _amount) external;

    /**
    * @notice Only called by PoolTracker.
    * @dev Function withdraws from Aave pools, exchanging this contracts aTokens
    * for reserve tokens for user deposits.
    * @param _assetAddress The address of the underlying asset of the reserve
    * @param _amount The amount of withdraw assets
    * @param _depositor The address making the deposit
    * @param _isETH bool indicating if asset is the base token of network (eth/matic/...)
    **/
    function withdraw(address _assetAddress, uint256 _amount, address _depositor, bool _isETH) external;

    /**
    * @notice Only called by PoolTracker.
    * @dev Function claims donations for receiver. Calls Aave pools exchanging this
    * contracts aTokens for reserve tokens for interestEarned amount.
    * Calculates interestEarned and subtracts 0.2% fee from claim amount.
    * @param _assetAddress The address of the underlying asset of the reserve
    * @param _feeAddress The address that collects the 0.2% protocol fee
    * @param _isETH bool indicating if asset is the base token of network (eth/matic/...)
    * @param _bpFee fee rate paid to the protocol
    **/
    function withdrawDonations(address _assetAddress, address _feeAddress, bool _isETH, uint256 _bpFee) external returns(uint256);

    /**
    * @param _about new about reference for pool
    **/
    function setAbout(string calldata _about) external;

    /**
    * @param _metaUri updated metaUri reference for pool
    **/
    function setMetaUri(string calldata _metaUri) external;

    /**
    * @return acceptedTokens List of tokens to be accepted by JCP.
    **/
    function getAcceptedTokens() external view returns(address[] memory);

    /**
    * @return name String name of JCP.
    **/
    function getName() external view returns(string calldata);

    /**
    * @return about ipfs hash of pool description of JCP.
    **/
    function getAbout() external view returns(string calldata);

    /**
    * @return picHash ipfs hash of pic of JCP.
    **/
    function getPicHash() external view returns(string calldata);

    /**
    * @return metaUri meta info uri for nft of JCP.
    **/
    function getMetaUri() external view returns(string calldata);

    /**
    * @return isVerified indicates whether JCP is verified
    **/
    function getIsVerified() external view returns(bool);

    /**
    * @return receiver address of receiver of JCP donations.
    **/
    function getRecipient() external view returns(address);

    /**
    * @return erc721Addr address of receiver of JCP donations.
    **/
    function getERC721Address() external view returns(address);

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
    function getPoolInfo() external view returns (address[] memory, address, bool, string calldata, string calldata, string calldata, string calldata);

    /**
    * @param _assetAddress The address of the underlying asset of the reserve
    * @return aTokenAddress address of Aave's aToken for asset
    **/
    function getATokenAddress(address _assetAddress) external view returns(address aTokenAddress);

    /**
    * @param _assetAddress The address of the underlying asset of the reserve
    * @return totalDeposit total assets deposited in pool
    **/
    function getTotalDeposits(address _assetAddress) external view returns(uint256);

    /**
    * @param _assetAddress The address of the underlying asset of the reserve
    * @return unclaimedInterest accrued interest that has not yet been claimed
    **/
    function getUnclaimedInterest(address _assetAddress) external view returns (uint256);

    /**
    * @param _assetAddress The address of the underlying asset of the reserve
    * @return claimedInterest interest that has been claimed (no longer in contract)
    **/
    function getClaimedInterest(address _assetAddress) external view returns (uint256);

    /**
    * @param _assetAddress The address of the underlying asset of the reserve
    * @return aTokenBalance Pool balance of aToken for the asset
    **/
    function getATokenBalance(address _assetAddress) external view returns (uint256);

    /**
    * @param _assetAddress The address of the underlying asset of the reserve
    * @return normalizedIncome reserve's normalized income
    */
    function getReserveNormalizedIncome(address _assetAddress) external view returns(uint256);

    /**
    * @param _assetAddress The address of the underlying asset of the reserve
    * @return liquidityIndex reserve's liquidity index
    */
    function getAaveLiquidityIndex(address _assetAddress) external view returns(uint256 liquidityIndex);

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
    function getPoolTokenInfo(address _asset) external view returns(uint256, uint256, uint256, uint256, uint256, uint256, address);
}