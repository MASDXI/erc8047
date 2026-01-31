const {expect} = require("chai");
const {solidityPackedKeccak256, getBytes} = require("ethers");
const {amount, frozenAmount, transferFrom, transfer, TOKEN_METADATA, CONTRACT_NAME} = require("../../utils/constant");
const {hardhat_reset, hardhat_latestBlock} = require("../../utils/network");

describe("UTXO", function () {
  async function deployTokenFixture() {
    const [owner, alice, bob, charlie, otherAccount] = await ethers.getSigners();
    const contract = await ethers.getContractFactory(CONTRACT_NAME.UTXO);
    const token = await contract.deploy(TOKEN_METADATA.NAME, TOKEN_METADATA.SYMBOL);

    return {token, owner, alice, bob, charlie, otherAccount};
  }

  afterEach(async function () {
    await hardhat_reset();
  });

  // @TODO create test cases to cover the UTXO token behavior.

  describe("Policies Enforcements Test", function () {
    it("transfer Alice to Bob", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      let tx = await token.mint(aliceAddress, amount);
      tx = await tx.wait();
      const txnId = tx.logs[0].args[0];
      const hashed = solidityPackedKeccak256(["bytes32"], [txnId]);
      const signature = await alice.signMessage(getBytes(hashed));
      expect(await token.balanceOf(aliceAddress)).to.equal(amount);
      await token.connect(alice)[transfer.utxo](bobAddress, txnId, amount, signature);
      expect(await token.balanceOf(aliceAddress)).to.equal(0);
      expect(await token.balanceOf(bobAddress)).to.equal(amount);
    });

    it("transferFrom Alice to Bob", async function () {
      const {token, owner, alice, bob} = await deployTokenFixture();
      const spenderAddress = owner.address;
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      let tx = await token.mint(aliceAddress, amount);
      tx = await tx.wait();
      const txnId = tx.logs[0].args[0];
      const hashed = solidityPackedKeccak256(["bytes32"], [txnId]);
      const signature = await alice.signMessage(getBytes(hashed));
      await token.connect(alice).approve(spenderAddress, amount);
      expect(await token.balanceOf(aliceAddress)).to.equal(amount);
      await token.connect(owner)[transferFrom.utxo](aliceAddress, bobAddress, txnId, amount, signature);
      expect(await token.balanceOf(aliceAddress)).to.equal(0);
      expect(await token.balanceOf(bobAddress)).to.equal(amount);
    });

    it("Freeze Alice Account and transferFrom", async function () {
      const {token, owner, alice, bob} = await deployTokenFixture();
      const spenderAddress = owner.address;
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      let tx = await token.mint(aliceAddress, amount);
      tx = await tx.wait();
      const txnId = tx.logs[0].args[0];
      const hashed = solidityPackedKeccak256(["bytes32"], [txnId]);
      const signature = await alice.signMessage(getBytes(hashed));
      await token.connect(alice).approve(spenderAddress, amount);
      await token.setAddressFrozen(aliceAddress, true);
      expect(await token.isFrozen(aliceAddress)).to.equal(true);
      await expect(token.connect(owner).transferFrom(aliceAddress, bobAddress, txnId, amount, signature)).to.be
        .reverted;
    });

    it("Freeze Alice Balance and transfer", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      let tx = await token.mint(aliceAddress, amount);
      tx = await tx.wait();
      const txnId = tx.logs[0].args[0];
      const hashed = solidityPackedKeccak256(["bytes32"], [txnId]);
      const signature = await alice.signMessage(getBytes(hashed));
      expect(await token.balanceOf(aliceAddress)).to.equal(amount);
      await token.freezePartialTokens(aliceAddress, frozenAmount);
      expect(await token.frozenBalanceOf(aliceAddress)).to.equal(frozenAmount);
      const amountDelta = BigInt(amount - frozenAmount);
      await token.connect(alice)[transfer.utxo](bobAddress, txnId, amountDelta, signature);
      expect(await token.balanceOf(aliceAddress)).to.equal(frozenAmount);
      expect(await token.balanceOf(bobAddress)).to.equal(amountDelta);
      // Even if signatures are invalid, the policy check executes first as a pre-transfer hook.
      await expect(
        token.connect(alice)[transfer.utxo](bobAddress, txnId, frozenAmount, signature),
      ).to.be.revertedWithCustomError(token, "BalanceFrozen");
    });

    it("Freeze Alice Balance and transferFrom", async function () {
      const {token, owner, alice, bob} = await deployTokenFixture();
      const spenderAddress = owner.address;
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      let tx = await token.mint(aliceAddress, amount);
      tx = await tx.wait();
      const txnId = tx.logs[0].args[0];
      const hashed = solidityPackedKeccak256(["bytes32"], [txnId]);
      const signature = await alice.signMessage(getBytes(hashed));
      expect(await token.balanceOf(aliceAddress)).to.equal(amount);
      await token.freezePartialTokens(aliceAddress, frozenAmount);
      expect(await token.frozenBalanceOf(aliceAddress)).to.equal(frozenAmount);
      await token.connect(alice).approve(spenderAddress, amount);
      const amountDelta = BigInt(amount - frozenAmount);
      await token.connect(owner)[transferFrom.utxo](aliceAddress, bobAddress, txnId, amountDelta, signature);
      expect(await token.balanceOf(aliceAddress)).to.equal(frozenAmount);
      expect(await token.balanceOf(bobAddress)).to.equal(amountDelta);
      // Even if signatures are invalid, the policy check executes first as a pre-transfer hook.
      await expect(
        token.connect(owner)[transferFrom.utxo](aliceAddress, bobAddress, txnId, frozenAmount, signature),
      ).to.be.revertedWithCustomError(token, "BalanceFrozen");
    });

    it("Freeze Alice Token and transfer", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      let tx = await token.mint(aliceAddress, amount);
      tx = await tx.wait();
      const txnId = tx.logs[0].args[0];
      const hashed = solidityPackedKeccak256(["bytes32"], [txnId]);
      const signature = await alice.signMessage(getBytes(hashed));
      await token.freezeToken(txnId);
      expect(await token.isTokenFrozen(txnId)).to.equal(true);
      await expect(
        token.connect(alice)[transfer.utxo](bobAddress, txnId, amount, signature),
      ).to.be.revertedWithCustomError(token, "TokenFrozen");
    });
  });
});
