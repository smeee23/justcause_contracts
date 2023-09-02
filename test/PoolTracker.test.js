const PoolTracker = artifacts.require("PoolTracker");
const PoolAddressesProviderMock = artifacts.require("PoolAddressesProviderMock");
const PoolMock = artifacts.require("PoolMock");
const WethGatewayTest = artifacts.require("WethGatewayTest");
const TestToken = artifacts.require("TestToken");
const aTestToken = artifacts.require("aTestToken");
const JCDepositorERC721 = artifacts.require("JCDepositorERC721");
const JustCausePool = artifacts.require("JustCausePool");
const { expectRevert } = require('@openzeppelin/test-helpers');

const BN = web3.utils.BN;
//require("dotenv").config({path: "../.env"});

contract("Pool Tracker", async (accounts) => {

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
        await this.poolMock.setTestTokens(this.aToken.address, this.testToken.address, this.testToken_2.address, this.wethToken.address, this.aWethToken.address, {from: multiSig});

        this.poolAddressesProviderMock = await PoolAddressesProviderMock.new();
        await this.poolAddressesProviderMock.setPoolImpl(this.poolMock.address, {from: multiSig});

        this.wethGateway = await WethGatewayTest.new();
        await this.wethGateway.setValues(this.wethToken.address, this.aWethToken.address, {from: multiSig});

        const poolAddressesProviderAddr = this.poolAddressesProviderMock.address;
        const wethGatewayAddr = this.wethGateway.address;
        this.poolTracker = await PoolTracker.new(poolAddressesProviderAddr, wethGatewayAddr, multiSig, feeIndex);
        this.INTEREST = "1000000000000000000";
    });

    it("pools created by multiSig should be added to verified pools", async() => {
        const startPoolsLength = (await this.poolTracker.getVerifiedPools()).length;
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig});
        assert.equal(startPoolsLength + 1, (await this.poolTracker.getVerifiedPools()).length, "The pool created by multiSig was not added to verified list");
    });

    it("should add each receiver to receivers mapping on pool creation", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig});
        const receiverPools = await this.poolTracker.getReceiverPools(receiver);
        assert.equal(receiverPools.length, 1, "receiver mapping not updated");
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        assert.strictEqual(receiverPools[0], knownAddress, "The pool name did not return the correct address");
    });

    it("pools created by non-multiSig addresses should not be in verified pools", async() => {
        const startPoolsLength = (await this.poolTracker.getVerifiedPools()).length;
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: owner});
        assert.equal(startPoolsLength, (await this.poolTracker.getVerifiedPools()).length, "The pool created by non-multiSig address was added to verified list");
    });

    it("getAddressFromName should return an address based on unique name", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig});
        const testAddress = await this.poolTracker.getAddressFromName("Test Pool");
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        assert.strictEqual(testAddress, knownAddress, "The pool name did not return the correct address");
    });

    it("checkPool should return true if address is that of a pool", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const isPool = await this.poolTracker.checkPool(knownAddress);
        assert.isTrue(isPool, "known address not found");
    });

    it("createJCPoolClone should revert when passed a non-accepted token", async() =>{
        await expectRevert(
            this.poolTracker.createJCPoolClone([this.notApprovedToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig}),
            "tokens not approved"
        );
    });

    it("add deposit ends with aTokens in JustCause pool", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];

        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});

        const aTokenBalance = web3.utils.toBN(depositAmount).add(web3.utils.toBN(this.INTEREST)).toString();
        const checkAmount = (await this.aToken.balanceOf(knownAddress)).toString();
        assert.strictEqual(aTokenBalance, checkAmount, "atoken not updated");
    });
    it("add deposit reverts when _pool parameter is not a pool", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        await expectRevert(
            this.poolTracker.addDeposit(depositAmount, this.testToken.address, owner, false, {from: depositor}),
            "not pool"
        );
    });
    it("add deposit reverts when PoolTracker does not have allowance for token from depositor", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        await expectRevert(
            this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor}),
            "sender not approved"
        );
    });
    it("add deposit sends nft to depositor", async() => {
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
        assert.equal(await erc721Instance.balanceOf(depositor), 1, "balance not equal to 1");
    });
    it("add deposit updates tvl", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const origTVL = await this.poolTracker.getTVL(this.testToken.address);
        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        const newTVL = await this.poolTracker.getTVL(this.testToken.address);

        const valueString = origTVL.add(web3.utils.toBN(depositAmount)).toString();
        assert.strictEqual(valueString, newTVL.toString(), "tvl not updated");
    });

    it("add deposit updates wethGateway balance when sending native token", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.wethToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        let origBalance = await web3.eth.getBalance(this.wethGateway.address);
        await this.poolTracker.addDeposit(depositAmount, this.wethToken.address, knownAddress, true, {from: depositor, value: depositAmount});
        let newBalance = await web3.eth.getBalance(this.wethGateway.address);
        let balanceCheck = (new BN(origBalance)).add(new BN(depositAmount)).toString();
        assert.equal(balanceCheck, newBalance, "eth balance of wethGateway has not been updated");
    });

    it("add deposit reverts when sending eth, but not specifying weth as the asset parameter", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.wethToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];

        await expectRevert(
            this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, true, {from: depositor, value: depositAmount}),
            "asset does not match WETHGateway"
        );
    });

    it("add deposit reverts when isETH is true and msg.value is 0", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.wethToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("0", "ether");
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];

        let origBalance = await web3.eth.getBalance(this.wethGateway.address);

        await expectRevert(
            this.poolTracker.addDeposit(depositAmount, this.wethToken.address, knownAddress, true, {from: depositor, value: depositAmount}),
            "msg.value cannot be zero"
        );
    });

    it("add deposit reverts when isETH is false and msg.value is not 0", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.wethToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];

        let origBalance = await web3.eth.getBalance(this.wethGateway.address);

        await expectRevert(
            this.poolTracker.addDeposit(depositAmount, this.wethToken.address, knownAddress, false, {from: depositor, value: depositAmount}),
            "msg.value is not zero"
        );
    });

    it("withdrawDeposit reverts when _pool parameter is not a pool", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        await expectRevert(
            this.poolTracker.withdrawDeposit(depositAmount, this.testToken.address, owner, false, {from: depositor}),
            "not pool"
        );
    });

    it("withdrawDeposit withdraws _amount from JustCause pool", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];

        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        assert.equal(await this.testToken.balanceOf(depositor), 0, "testToken balance not equal to 0");

        await this.poolTracker.withdrawDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        assert.equal(await this.testToken.balanceOf(depositor), depositAmount, "testToken balance not equal to withdraw amount");
    });

    it("withdrawDeposit withdraws native token from WethGateway pool", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.wethToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];

        await this.poolTracker.addDeposit(depositAmount, this.wethToken.address, knownAddress, true, {from: depositor, value: depositAmount});

        let origBalance = await web3.eth.getBalance(this.wethGateway.address);

        await this.poolTracker.withdrawDeposit(depositAmount, this.wethToken.address, knownAddress, true, {from: depositor});

        let newBalance = await web3.eth.getBalance(this.wethGateway.address);
        const balanceCheck = (new BN(newBalance)).add(new BN(depositAmount)).toString();
        assert.strictEqual(balanceCheck, origBalance, "gateway balance incorrect");
    });

    it("withdrawDeposit reverts if isETH is true and asset does not match weth address", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.wethToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");

        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});

        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];

        await this.poolTracker.addDeposit(depositAmount, this.wethToken.address, knownAddress, true, {from: depositor, value: depositAmount});
        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});

        await expectRevert(
            this.poolTracker.withdrawDeposit(depositAmount, this.testToken.address, knownAddress, true, {from: depositor}),
            "asset does not match WETHGateway"
        );

    });

    it("withdrawDeposit updates jc pool atoken balance", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];

        const origATokenBalance = (await this.aToken.balanceOf(knownAddress)).toString();

        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        assert.equal(await this.testToken.balanceOf(depositor), 0, "testToken balance not equal to 0");

        await this.poolTracker.withdrawDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});

        const endATokenBalance = (await this.aToken.balanceOf(knownAddress)).sub(web3.utils.toBN(this.INTEREST)).toString();

        assert.strictEqual(origATokenBalance, endATokenBalance, "atoken balance incorrect");
    });

    it("withdrawDeposit updates tvl", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];

        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        assert.equal(await this.testToken.balanceOf(depositor), 0, "testToken balance not equal to 0");

        const origTVL = await this.poolTracker.getTVL(this.testToken.address);
        await this.poolTracker.withdrawDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        const newTVL = await this.poolTracker.getTVL(this.testToken.address);

        const valueString = origTVL.sub(web3.utils.toBN(depositAmount)).toString();
        assert.strictEqual(valueString, newTVL.toString(), "tvl not updated");
    });

    it("withdrawDeposit reverts if tvl overflows", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const overAmount = web3.utils.toWei("2", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, web3.utils.toWei("3", "ether"));
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});

        await expectRevert(
            this.poolTracker.withdrawDeposit(overAmount, this.testToken.address, knownAddress, false, {from: depositor}),
            "VM Exception while processing transaction: reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)"
        );
    });

    it("claimInterest updates totalDonated and fee is 0", async() => {
        await this.poolTracker.setBpFee(0, {from: multiSig});
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];

        const jCPool = await JustCausePool.at(knownAddress);

        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        assert.equal(await this.testToken.balanceOf(depositor), 0, "testToken balance not equal to 0");

        const origDonated = await this.poolTracker.getTotalDonated(this.testToken.address);
        await this.poolTracker.claimInterest(this.testToken.address, knownAddress, false, {from: depositor});
        const newDonted = await this.poolTracker.getTotalDonated(this.testToken.address);

        const valueString = newDonted.sub(web3.utils.toBN(origDonated)).toString();
        assert.strictEqual(valueString, this.INTEREST, "tvl not updated");
    });

    it("claimInterest updates total donated when native token is claimed and fee is 0", async() => {
        await this.poolTracker.setBpFee(0, {from: multiSig});
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.wethToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];

        await this.poolTracker.addDeposit(depositAmount, this.wethToken.address, knownAddress, true, {from: depositor, value: depositAmount});

        const origDonated = await this.poolTracker.getTotalDonated(this.wethToken.address);
        await this.poolTracker.claimInterest(this.wethToken.address, knownAddress, true, {from: depositor});
        const newDonted = await this.poolTracker.getTotalDonated(this.wethToken.address);

        const valueString = newDonted.sub(web3.utils.toBN(origDonated)).toString();

        assert.strictEqual(valueString, this.INTEREST, "tvl not updated");
    });

    it("claimInterest updates receiver balance when native token is claimed and fee is 0", async() => {
        await this.poolTracker.setBpFee(0, {from: multiSig});
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.wethToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];

        await this.poolTracker.addDeposit(depositAmount, this.wethToken.address, knownAddress, true, {from: depositor, value: depositAmount});

        const origReceiverBalance = await web3.eth.getBalance(receiver);
        await this.poolTracker.claimInterest(this.wethToken.address, knownAddress, true, {from: depositor});
        const newReceiverBalance = await web3.eth.getBalance(receiver);

        const valueString = (new BN(origReceiverBalance)).add(web3.utils.toBN(this.INTEREST)).toString();
        assert.strictEqual(valueString, newReceiverBalance, "tvl not updated");
    });

    it("claimInterest updates totalDonated non-verified pool", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: owner})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getReceiverPools(receiver))[0];

        const jCPool = await JustCausePool.at(knownAddress);

        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        assert.equal(await this.testToken.balanceOf(depositor), 0, "testToken balance not equal to 0");

        const origDonated = await this.poolTracker.getTotalDonated(this.testToken.address);
        await this.poolTracker.claimInterest(this.testToken.address, knownAddress, false, {from: depositor});
        const newDonted = await this.poolTracker.getTotalDonated(this.testToken.address);

        const valueString = newDonted.sub(web3.utils.toBN(origDonated)).toString();
        const paidInterest = "998000000000000000"; //this.INTEREST - 0.2% fee
        assert.strictEqual(valueString, paidInterest, "tvl not updated");
    });

    it("claimInterest updates total donated when native token is claimed non-verified pool", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.wethToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: owner})
        const depositAmount = web3.utils.toWei("1", "ether");
        const knownAddress = (await this.poolTracker.getReceiverPools(receiver))[0];

        await this.poolTracker.addDeposit(depositAmount, this.wethToken.address, knownAddress, true, {from: depositor, value: depositAmount});

        const origDonated = await this.poolTracker.getTotalDonated(this.wethToken.address);
        await this.poolTracker.claimInterest(this.wethToken.address, knownAddress, true, {from: depositor});
        const newDonted = await this.poolTracker.getTotalDonated(this.wethToken.address);

        const valueString = newDonted.sub(web3.utils.toBN(origDonated)).toString();
        const paidInterest = "998000000000000000"; //this.INTEREST - 0.2% fee
        assert.strictEqual(valueString, paidInterest, "tvl not updated");
    });

    it("claimInterest updates receiver balance when native token is claimed non-veridied pool", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.wethToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: owner})
        const depositAmount = web3.utils.toWei("1", "ether");
        const knownAddress = (await this.poolTracker.getReceiverPools(receiver))[0];

        await this.poolTracker.addDeposit(depositAmount, this.wethToken.address, knownAddress, true, {from: depositor, value: depositAmount});

        const origReceiverBalance = await web3.eth.getBalance(receiver);
        await this.poolTracker.claimInterest(this.wethToken.address, knownAddress, true, {from: depositor});
        const newReceiverBalance = await web3.eth.getBalance(receiver);

        const paidInterest = "998000000000000000"; //this.INTEREST - 0.2% fee
        const valueString = (new BN(origReceiverBalance)).add(web3.utils.toBN(paidInterest)).toString();
        assert.strictEqual(valueString, newReceiverBalance, "tvl not updated");
    });

    it("claimInterest reverts when isETH is true and asset is not weth address", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.wethToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];

        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});

        await expectRevert(
            this.poolTracker.claimInterest(this.testToken.address, knownAddress, true, {from: depositor}),
            "asset does not match WETHGateway"
        );
    });

    it("claimInterest reverts when _pool parameter is not a pool", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        await expectRevert(
            this.poolTracker.claimInterest(this.aToken.address, owner, false, {from: depositor}),
            "not pool"
        );
    });

    it("claimInterest reverts when _asset is not accepted by aave", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        await expectRevert(
            this.poolTracker.claimInterest(this.aToken.address, knownAddress, false, {from: depositor}),
            "token not approved"
        );
    });

    it("getMultiSig returns MULTI_SIG address", async() => {
        const validatorCheck = await this.poolTracker.getMultiSig();
        assert.equal(validatorCheck, multiSig, "multiSig not correct");
    });

    it("getBpFee returns fee", async() => {
        await this.poolTracker.setBpFee(2, {from: multiSig});
        fee = (await this.poolTracker.getBpFee()).toString();
        assert.strictEqual(fee, "50", "multiSig not correct");
    });

    it("setBpFee changes fee", async() => {
        await this.poolTracker.setBpFee(0, {from: multiSig});
        fee = (await this.poolTracker.getBpFee()).toString();
        assert.strictEqual(fee, "0", "multiSig not correct");
        await this.poolTracker.setBpFee(1, {from: multiSig});
        fee = (await this.poolTracker.getBpFee()).toString();
        assert.strictEqual(fee, "20", "multiSig not correct");
        await this.poolTracker.setBpFee(2, {from: multiSig});
        fee = (await this.poolTracker.getBpFee()).toString();
        assert.strictEqual(fee, "50", "multiSig not correct");
        await this.poolTracker.setBpFee(3, {from: multiSig});
        fee = (await this.poolTracker.getBpFee()).toString();
        assert.strictEqual(fee, "80", "multiSig not correct");
        await this.poolTracker.setBpFee(4, {from: multiSig});
        fee = (await this.poolTracker.getBpFee()).toString();
        assert.strictEqual(fee, "100", "multiSig not correct");
    });

    it("setBpFee throws error when fee index out of bounds", async() => {
        await expectRevert(
            this.poolTracker.setBpFee(9, {from: multiSig}),
            "VM Exception while processing transaction: reverted with panic code 0x32 (Array accessed at an out-of-bounds or negative index)"
        );
    });

    it("setBpFee throws error when set fee is called by anyone other than multiSig", async() => {
        await expectRevert(
            this.poolTracker.setBpFee(0, {from: depositor}),
            "not the multiSig"
        );
    });

    it("getPoolAddr  returns poolAddr address", async() => {
        const poolAddress = await this.poolTracker.getPoolAddr();
        assert.equal(this.poolMock.address, poolAddress, "multiSig not correct");
    });

    it("getReservesList returns reservesList address", async() => {
        const reservesList = (await this.poolTracker.getReservesList()).toString();
        const reservesListCheck = (await this.poolMock.getReservesList()).toString();
        assert.strictEqual(reservesListCheck, reservesList, "multiSig not correct");
    });

    it("getBaseJCPoolAddress  returns base pool address", async() => {
        const basePoolAddress = await this.poolTracker.getBaseJCPoolAddress();
        assert.ok(basePoolAddress, "base pool address not valid");
    });
});