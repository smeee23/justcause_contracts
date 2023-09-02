const PoolTracker = artifacts.require("PoolTracker");
const PoolAddressesProviderMock = artifacts.require("PoolAddressesProviderMock");
const PoolMock = artifacts.require("PoolMock");
const TestToken = artifacts.require("TestToken");
const aTestToken = artifacts.require("aTestToken");
const JCDepositorERC721 = artifacts.require("JCDepositorERC721");
const JustCausePool = artifacts.require("JustCausePool");
const WethGatewayTest = artifacts.require("WethGatewayTest");
const { expectRevert } = require('@openzeppelin/test-helpers');

//require("dotenv").config({path: "../.env"});

contract("JustCausePool", async (accounts) => {

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
        this.RESERVE_NORMALIZED_INCOME = "7755432354";
        this.LIQUIDITY_INDEX = "1234"
    });

    it("JustCausePool reverts if initialize is called on base", async() => {
        const jCPool = await JustCausePool.at(await this.poolTracker.getBaseJCPoolAddress());
        const erc721Address = await jCPool.getERC721Address();
        await expectRevert(
            jCPool.initialize([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, this.poolMock.address, this.wethGateway.address, erc721Address, false, {from: multiSig}),
            "Cannot initialize base"
        );
    });

    it("JustCausePool initialize cannot be called twice", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);
        const erc721Address = await jCPool.getERC721Address();
        await expectRevert(
            jCPool.initialize([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, this.poolMock.address, this.wethGateway.address, erc721Address, false, {from: multiSig}),
            "Initializable: contract is already initialized"
        );
    });

    it("JustCausePool initialize reverts if name is over 60 characters", async() => {
        const name = "Test Pool gpiorgjt uhoioi oioix Test Pool gpiorgjt uhoioi ores";
        await expectRevert(
            this.poolTracker.createJCPoolClone([this.testToken.address], name, "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig}),
            "VM Exception while processing transaction: reverted with reason string 'string over character limit'"
        );
    });

    it("JustCausePool deposit can only be called from PoolTracker", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);
        await expectRevert(
            jCPool.deposit(this.testToken.address, 100000, {from: multiSig}),
            "not the owner"
        );
    });

    it("add deposit updates totalDeposits for that asset", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);
        const origDeposit = (await jCPool.getTotalDeposits(this.testToken.address)).toString();

        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        const newDeposit = await jCPool.getTotalDeposits(this.testToken.address);

        const checkAmount = newDeposit.sub(web3.utils.toBN(depositAmount)).toString();
        assert.strictEqual(checkAmount, origDeposit, "totalDeposits not updated");
    });

    it("JustCausePool withdraw can only be called from PoolTracker", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);
        await expectRevert(
            jCPool.withdraw(this.testToken.address, 100000, multiSig, false, {from: multiSig}),
            "not the owner"
        );
    });

    it("JustCausePool withdraw updates totalDeposits", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("2", "ether");
        const withdrawAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);

        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        await this.poolTracker.withdrawDeposit(withdrawAmount, this.testToken.address, knownAddress, false, {from: depositor});

        const newDeposit = await jCPool.getTotalDeposits(this.testToken.address);
        const checkAmount = web3.utils.toBN(depositAmount).sub(web3.utils.toBN(withdrawAmount)).toString();

        assert.strictEqual(newDeposit.toString(), checkAmount, "totalDeposits not updated");
    });

    it("JustCausePool withdrawDonations can only be called from PoolTracker", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);
        const bpFee = 20;
        await expectRevert(
            jCPool.withdrawDonations(this.testToken.address, multiSig, false, bpFee, {from: multiSig}),
            "not the owner"
        );
    });

    it("JustCausePool withdrawDonations updates interestEarned", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];

        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        assert.equal(await this.testToken.balanceOf(depositor), 0, "testToken balance not equal to 0");

        const origDonated = await this.poolTracker.getTotalDonated(this.testToken.address);
        await this.poolTracker.claimInterest(this.testToken.address, knownAddress, false, {from: depositor});

        const jCPool = await JustCausePool.at(knownAddress);

        const newDonted = await this.poolTracker.getTotalDonated(this.testToken.address);

        const valueString = newDonted.sub(web3.utils.toBN(origDonated)).toString();

        const totalDonated = "998000000000000000"; //this.INTEREST - 0.2% fee
        assert.strictEqual(valueString, totalDonated, "interest not updated");
    });

    it("JustCausePool withdrawDonations sends donations to receiver minus fee", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: owner})
        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});
        const knownAddress = (await this.poolTracker.getReceiverPools(receiver))[0];

        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        assert.equal(await this.testToken.balanceOf(depositor), 0, "testToken balance not equal to 0");

        await this.poolTracker.claimInterest(this.testToken.address, knownAddress, false, {from: depositor});
        const receiverBalance = await this.testToken.balanceOf(receiver);

        const paidInterest = "998000000000000000"; //this.INTEREST - 0.2% fee
        assert.strictEqual(receiverBalance.toString(), paidInterest, "receiver did not receive donations");
    });

    it("JustCausePool setAbout reverts if anyone besides PoolTracker calls", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);

        await expectRevert(
            jCPool.setAbout("NEW_ABOUT", {from: owner}),
            "not the owner"
        );
    });

    it("JustCausePool setAbout changes state variable to new about for verified pool", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);

        await this.poolTracker.updatePoolAbout(knownAddress, "NEW_ABOUT", {from: receiver});

        const testAbout = await jCPool.getAbout();
        assert.strictEqual(testAbout, "NEW_ABOUT", "about not updated");

    });

    it("JustCausePool setAbout changes state variable to new about non-verified pool", async() => {
        const receipt = await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: receiver})
        const knownAddress = receipt.logs[0].args["pool"];
        const jCPool = await JustCausePool.at(knownAddress);

        await this.poolTracker.updatePoolAbout(knownAddress, "NEW_ABOUT", {from: receiver});

        const testAbout = await jCPool.getAbout();
        assert.strictEqual(testAbout, "NEW_ABOUT", "about not updated");

    });

    it("JustCausePool setAbout changes state if multiSig calls if verified pool", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);

        await this.poolTracker.updatePoolAbout(knownAddress, "NEW_ABOUT", {from: multiSig});

        const testAbout = await jCPool.getAbout();
        assert.strictEqual(testAbout, "NEW_ABOUT", "about not updated");

    });

    it("JustCausePool setAbout reverts multiSig calls on non-verified pool", async() => {
        const receipt = await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: receiver})
        const poolAddress = receipt.logs[0].args["pool"];

        await expectRevert(
            this.poolTracker.updatePoolAbout(poolAddress, "NEW_ABOUT", {from: multiSig}),
            "not authorized"
        );
    });

    it("JustCausePool setMetaUri reverts if anyone besides the PoolTracker calls it", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);

        await expectRevert(
            jCPool.setMetaUri("NEW_META_URI", {from: owner}),
            "not the owner"
        );
    });

    it("JustCausePool setMetaUri changes state variable to new value", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);
        await this.poolTracker.updatePoolMetaUri(knownAddress, "NEW_META_URI", {from: receiver});

        let testMeta = await jCPool.getMetaUri();
        assert.strictEqual(testMeta, "NEW_META_URI", "metaUri not updated");

        await this.poolTracker.updatePoolMetaUri(knownAddress, "UPDATED_META_URI", {from: multiSig});

        testMeta = await jCPool.getMetaUri();
        assert.strictEqual(testMeta, "UPDATED_META_URI", "metaUri not updated");

    });

    it("JustCausePool getAcceptedTokens returns accepted tokens", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);
        const acceptedTokens = await jCPool.getAcceptedTokens();
        assert.isTrue(acceptedTokens.includes(this.testToken.address), "token not in list");
        assert.isTrue(acceptedTokens.includes(this.testToken_2.address), "token not in list");
    });

    it("JustCausePool getName returns name", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig})
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);
        const name = await jCPool.getName();
        assert.strictEqual(name, "Test Pool", "name incorrect");
    });

    it("JustCausePool getAbout returns about", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);
        const about = await jCPool.getAbout();
        assert.strictEqual(about, "ABOUT_HASH", "about hash incorrect");
    });

    it("JustCausePool getPicHash returns about", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);
        const picHash = await jCPool.getPicHash();
        assert.strictEqual(picHash, "picHash", "pic hash incorrect");
    });

    it("JustCausePool getMetaUri returns metaUri", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);
        const metaUri = await jCPool.getMetaUri();
        assert.strictEqual(metaUri, "metaUri", "metaUri hash incorrect");
    });

    it("JustCausePool getIsVerified returns true if multiSig creates", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: multiSig});
        const knownAddress = (await this.poolTracker.getVerifiedPools())[0];
        const jCPool = await JustCausePool.at(knownAddress);
        const isVerified = await jCPool.getIsVerified();
        assert.isTrue(isVerified, "pool is not verified");
    });

    it("JustCausePool getIsVerified returns false if other than multiSig creates", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: owner});
        const knownAddress = await this.poolTracker.getAddressFromName("Test Pool");
        const jCPool = await JustCausePool.at(knownAddress);
        const isVerified = await jCPool.getIsVerified();
        assert.isTrue((!isVerified), "pool is not verified");
    });

    it("JustCausePool getRecipient returns receiver", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: owner});
        const knownAddress = await this.poolTracker.getAddressFromName("Test Pool");
        const jCPool = await JustCausePool.at(knownAddress);
        const receiverCheck = await jCPool.getRecipient();
        assert.equal(receiverCheck, receiver, "receiver is not correct");
    });

    it("JustCausePool getPoolInfo returns all of the above pool info", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: owner});
        const knownAddress = await this.poolTracker.getAddressFromName("Test Pool");
        const jCPool = await JustCausePool.at(knownAddress);
        const poolInfo = await jCPool.getPoolInfo();

        const acceptedTokens = poolInfo[0];
        assert.isTrue(acceptedTokens.includes(this.testToken.address), "token not in list");

        const receiverCheck = poolInfo[1];
        assert.equal(receiverCheck, receiver, "receiver is not correct");

        const isVerified = poolInfo[2];
        assert.isTrue((!isVerified), "pool is not verified");

        const metaUri = poolInfo[3];
        assert.strictEqual(metaUri, "metaUri", "metaUri hash incorrect");

        const picHash = poolInfo[4];
        assert.strictEqual(picHash, "picHash", "pic hash incorrect");

        const about = poolInfo[5];
        assert.strictEqual(about, "ABOUT_HASH", "about hash incorrect");

        const name = poolInfo[6];
        assert.strictEqual(name, "Test Pool", "name incorrect");
    });


    it("JustCausePool getATokenAddress returns the aTokenAddress", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: owner});
        const knownAddress = await this.poolTracker.getAddressFromName("Test Pool");
        const jCPool = await JustCausePool.at(knownAddress);
        const aTokenAddress = await jCPool.getATokenAddress(this.testToken.address);
        assert.equal(aTokenAddress, this.aToken.address, "receiver is not correct");
    });

    it("JustCausePool getTotalDeposits returns the total deposits", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: owner});
        const knownAddress = await this.poolTracker.getAddressFromName("Test Pool");
        const jCPool = await JustCausePool.at(knownAddress);
        let totalDeposits = (await jCPool.getTotalDeposits(this.testToken.address)).toString();
        assert.strictEqual(totalDeposits, "0", "total deposits is not 0 to start");

        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});

        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        totalDeposits = (await jCPool.getTotalDeposits(this.testToken.address)).toString();
        assert.strictEqual(totalDeposits, depositAmount.toString(), "total deposits is not updated");
    });

    it("JustCausePool getUnclaimedInterest returns the unclaimed interest", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: owner});
        const knownAddress = await this.poolTracker.getAddressFromName("Test Pool");
        const jCPool = await JustCausePool.at(knownAddress);
        let unclaimed = (await jCPool.getUnclaimedInterest(this.testToken.address)).toString();
        assert.strictEqual(unclaimed, "0", "unclaimed interest is not 0 to start");

        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});

        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        unclaimed = (await jCPool.getUnclaimedInterest(this.testToken.address)).toString();
        assert.strictEqual(unclaimed, this.INTEREST, "unclaimed interest is not updated");
    });

    it("JustCausePool getClaimedInterest returns the claimed interest", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: owner});
        const knownAddress = await this.poolTracker.getAddressFromName("Test Pool");
        const jCPool = await JustCausePool.at(knownAddress);
        let claimed = (await jCPool.getClaimedInterest(this.testToken.address)).toString();
        assert.strictEqual(claimed, "0", "claimed interest is not 0 to start");

        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});

        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        await this.poolTracker.claimInterest(this.testToken.address, knownAddress, false, {from: depositor});

        claimed = (await jCPool.getClaimedInterest(this.testToken.address)).toString();
        assert.strictEqual(claimed, this.INTEREST, "claimed interest is not updated");
    });

    it("JustCausePool getATokenBalance returns the aToken balance", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: owner});
        const knownAddress = await this.poolTracker.getAddressFromName("Test Pool");
        const jCPool = await JustCausePool.at(knownAddress);
        let aTokenBalance = (await jCPool.getATokenBalance(this.testToken.address)).toString();
        assert.strictEqual(aTokenBalance, "0", "unclaimed interest is not 0 to start");

        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});

        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});
        const balanceCheck = (await this.aToken.balanceOf(knownAddress)).toString();
        aTokenBalance = (await jCPool.getATokenBalance(this.testToken.address)).toString();
        assert.strictEqual(aTokenBalance, balanceCheck, "claimed interest is not updated");
    });

    it("JustCausePool getReserveNormalizedIncome returns the aTokenAddress", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: owner});
        const knownAddress = await this.poolTracker.getAddressFromName("Test Pool");
        const jCPool = await JustCausePool.at(knownAddress);
        const reserveNormalizedIncome = await jCPool.getReserveNormalizedIncome(this.testToken.address);
        assert.strictEqual(this.RESERVE_NORMALIZED_INCOME, reserveNormalizedIncome.toString(), "reserveNormalizedIncome is incorrect");
    });

    it("JustCausePool getAaveLiquidityIndex returns the aTokenAddress", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address, this.testToken_2.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: owner});
        const knownAddress = await this.poolTracker.getAddressFromName("Test Pool");
        const jCPool = await JustCausePool.at(knownAddress);
        const liquidityIndex = await jCPool.getAaveLiquidityIndex(this.testToken.address);
        assert.strictEqual(this.LIQUIDITY_INDEX, liquidityIndex.toString(), "reserveNormalizedIncome is incorrect");
    });

    it("JustCausePool getPoolTokenInfo returns above pool token info from for asset", async() => {
        await this.poolTracker.createJCPoolClone([this.testToken.address], "Test Pool", "ABOUT_HASH", "picHash", "metaUri", receiver, {from: owner});
        const knownAddress = await this.poolTracker.getAddressFromName("Test Pool");
        const jCPool = await JustCausePool.at(knownAddress);

        const depositAmount = web3.utils.toWei("1", "ether");
        const approveAmount = web3.utils.toWei("1000000", "ether");
        await this.testToken.mint(depositor, depositAmount);
        await this.testToken.approve(this.poolTracker.address, approveAmount, {from: depositor});

        await this.poolTracker.addDeposit(depositAmount, this.testToken.address, knownAddress, false, {from: depositor});

        let poolTokenInfo = await jCPool.getPoolTokenInfo(this.testToken.address);

        const balanceCheck = (await this.aToken.balanceOf(knownAddress)).toString();
        aTokenBalance = poolTokenInfo[2].toString();
        assert.strictEqual(aTokenBalance, balanceCheck, "atoken balance is not updated");

        const unclaimed = poolTokenInfo[4].toString();
        assert.strictEqual(unclaimed, this.INTEREST, "unclaimed interest is not updated");

        const totalDeposits = poolTokenInfo[5].toString();
        assert.strictEqual(totalDeposits, depositAmount.toString(), "total deposits is not updated");

        await this.poolTracker.claimInterest(this.testToken.address, knownAddress, false, {from: depositor});

        poolTokenInfo = await jCPool.getPoolTokenInfo(this.testToken.address);

        const claimed = poolTokenInfo[3].toString();;
        assert.strictEqual(claimed, this.INTEREST, "claimed interest is not updated");

        const liquidityIndex = poolTokenInfo[0].toString();
        assert.strictEqual(this.LIQUIDITY_INDEX, liquidityIndex, "reserveNormalizedIncome is incorrect");

        const reserveNormalizedIncome = poolTokenInfo[1].toString();
        assert.strictEqual(this.RESERVE_NORMALIZED_INCOME, reserveNormalizedIncome.toString(), "reserveNormalizedIncome is incorrect");

        const aTokenAddress = poolTokenInfo[6].toString();
        assert.equal(aTokenAddress, this.aToken.address, "receiver is not correct");

    });
});