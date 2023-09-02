const PoolTracker = artifacts.require("PoolTracker");
const PoolAddressesProviderMock = artifacts.require("PoolAddressesProviderMock");
const PoolMock = artifacts.require("PoolMock");
const WethGatewayTest = artifacts.require("WethGatewayTest");
const TestToken = artifacts.require("TestToken");
const aTestToken = artifacts.require("aTestToken");
const JCDepositorERC721 = artifacts.require("JCDepositorERC721");
const JustCausePool = artifacts.require("JustCausePool");
const { expectRevert } = require('@openzeppelin/test-helpers');

//require("dotenv").config({path: "../.env"});

contract("JCDepositorERC721", async (accounts) => {

    const [multiSig, depositor, owner, receiver] = accounts;
    const feeIndex = 1;
    
    beforeEach(async() => {
        this.testToken = await TestToken.new();
        this.testToken_2 = await TestToken.new();
        this.notApprovedToken = await TestToken.new();
        this.wethToken = await TestToken.new();
        this.aToken = await aTestToken.new();
        this.aWethToken = await aTestToken.new();
        this.poolMock = await PoolMock.new();
        await this.poolMock.setTestTokens(this.aToken.address, this.testToken.address, this.testToken_2.address, this.wethToken.address, this.aWethToken.address,  {from: multiSig});

        this.poolAddressesProviderMock = await PoolAddressesProviderMock.new();
        await this.poolAddressesProviderMock.setPoolImpl(this.poolMock.address, {from: multiSig});

        this.wethGateway = await WethGatewayTest.new();
        await this.wethGateway.setValues(this.wethToken.address, this.aWethToken.address, {from: multiSig});

        const poolAddressesProviderAddr = this.poolAddressesProviderMock.address;
        const wethGatewayAddr = this.wethGateway.address;
        this.poolTracker = await PoolTracker.new(poolAddressesProviderAddr, wethGatewayAddr, multiSig, feeIndex);
        this.INTEREST = "1000000000000000000";
    });

    it("addFunds reverts if any address but PoolTracker calls it", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);
        const erc721Address = await jCPool.getERC721Address();
        const erc721Instance = await JCDepositorERC721.at(erc721Address);
        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        await expectRevert(
            erc721Instance.addFunds(depositor, depositAmount, 111, this.testToken.address, "metaInfo", {from: depositor}),
            "not the owner"
        );
    });

    it("addFunds updates deposits", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.wethToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, web3.utils.toWei("3", "ether"));
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        const jCPool = await JustCausePool.at(knownAddress);
        const erc721Address = await jCPool.getERC721Address();
        const erc721Instance = await JCDepositorERC721.at(erc721Address);

        const tokenIds = await erc721Instance.getUserTokens(depositor);
        const tokenId = tokenIds[0];
        const depositInfo = await erc721Instance.getDepositInfo(tokenId);

        assert.strictEqual(depositInfo.balance, depositAmount, "balance not updated");
        assert.strictEqual(depositInfo.asset, this.testToken.address, " not updated");
        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        const newBalance = web3.utils.toBN(depositAmount).add(web3.utils.toBN(depositAmount)).toString();
        const balance = await erc721Instance.getUserBalance(tokenId);
        assert.strictEqual(balance.toString(), newBalance, "balance not updated");
    });

    it("withdrawFunds reverts if tokenId does not exist", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, web3.utils.toWei("3", "ether"));
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        await expectRevert(
            this.poolTracker.withdrawDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: owner}),
            "tokenId doesn't exist"
        );
    });

    it("withdrawFunds reverts if balance is insufficient", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const overAmount = web3.utils.toWei("2", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");

        await this.testToken.mint(depositor, web3.utils.toWei("3", "ether"));
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});

        await this.testToken.mint(multiSig, web3.utils.toWei("3", "ether"));
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: multiSig});

        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        await this.poolTracker.addDeposit(overAmount, this.testToken.address, knownAddress, false, {from: multiSig});

        await expectRevert(
            this.poolTracker.withdrawDeposit(overAmount, this.testToken.address, knownAddress, false, {from: depositor}),
            "insufficient balance"
        );
    });

    it("withdrawDeposit updates deposits", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const withdrawAmount = web3.utils.toWei("10000000", "gwei");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, web3.utils.toWei("3", "ether"));
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});

        const jCPool = await JustCausePool.at(knownAddress);
        const erc721Address = await jCPool.getERC721Address();
        const erc721Instance = await JCDepositorERC721.at(erc721Address);

        const tokenIds = await erc721Instance.getUserTokens(depositor);
        const tokenId = tokenIds[0];

        const origBalance = await erc721Instance.getUserBalance(tokenId);
        await this.poolTracker.withdrawDeposit(withdrawAmount, this.testToken.address, knownAddress, false, {from: depositor});
        const newBalance = await erc721Instance.getUserBalance(tokenId);
        const valueString = web3.utils.toBN(newBalance).add(web3.utils.toBN(withdrawAmount)).toString();
        assert.strictEqual(valueString, origBalance.toString(), "balance not updated");
        await this.poolTracker.withdrawDeposit(newBalance, this.testToken.address, knownAddress, false, {from: depositor});
        const depositInfo = await erc721Instance.getDepositInfo(tokenId);
        assert.strictEqual(depositInfo.timeStamp, "0", "timeStamp updated");
    });

    it("transferFrom reverts as token is non-transferrable", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const withdrawAmount = web3.utils.toWei("10000000", "gwei");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, web3.utils.toWei("3", "ether"));
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});

        const jCPool = await JustCausePool.at(knownAddress);
        const erc721Address = await jCPool.getERC721Address();
        const erc721Instance = await JCDepositorERC721.at(erc721Address);

        const tokenIds = await erc721Instance.getUserTokens(depositor);
        const tokenId = tokenIds[0];

        await expectRevert(
            erc721Instance.transferFrom(depositor, owner, tokenId, {from: depositor}),
            "non-transferrable"
        );
    });
    it("gets contributor pools", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.wethToken.address], "Test Pool 1", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool 2", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool 3", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, web3.utils.toWei("3", "ether"));
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});

        const verifiedPools = await this.poolTracker.getVerifiedPools();
        const knownAddress_1 = verifiedPools[0];
        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress_1, false, {from: depositor});

        const knownAddress_2 = verifiedPools[1];
        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress_2, false, {from: depositor});

        const knownAddress_3 = verifiedPools[2];
        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress_3, false, {from: depositor});

        const depositList = await this.poolTracker.getContributions(depositor);

        let userDepositPools = [];
		let userBalancePools = {};

        for(let i = 0; i < depositList.length; i++){
            let jCPool = await JustCausePool.at(depositList[i]);
            let erc721Address = await jCPool.getERC721Address();
            const erc721Instance = await JCDepositorERC721.at(erc721Address);

            let tokenIds = await erc721Instance.getUserTokens(depositor);
			for(let j = 0; j < tokenIds.length; j++){
				const tokenId = tokenIds[j].toString();
				if(tokenId != "0"){
					const depositInfo = await erc721Instance.getDepositInfo(tokenId);

					userDepositPools.push(depositList[i]);
					userBalancePools[depositList[i]+depositInfo.asset] = [depositInfo.balance, depositInfo.timeStamp, depositList[i], depositInfo.asset];
				}
			}
        }
        assert.strictEqual(userDepositPools.toString(), verifiedPools.toString(), "verified and contributor pools do not match");
        const key_1 =  Object.keys(userBalancePools)[0];
        const info = userBalancePools[key_1];
        assert.strictEqual(info[0], depositAmount, "balance in incorrect");
    });
});