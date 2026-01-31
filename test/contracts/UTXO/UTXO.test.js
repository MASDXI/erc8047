const {expect} = require("chai");
const {amount, frozenAmount, transferFrom, transfer, TOKEN_METADATA, CONTRACT_NAME} = require("../../utils/constant");
const {hardhat_reset} = require("../../utils/network");
const {getTransactionOutput, signTransactionInput} = require("../../utils/token");

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
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const txnId = await getTransactionOutput(tx);
      const signature = await signTransactionInput(alice, txnId);
      expect(await token.balanceOf(alice.address)).to.equal(amount);
      await token.connect(alice)[transfer.utxo](bob.address, txnId, amount, signature);
      expect(await token.balanceOf(alice.address)).to.equal(0);
      expect(await token.balanceOf(bob.address)).to.equal(amount);
    });

    it("transferFrom Alice to Bob", async function () {
      const {token, owner, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const txnId = await getTransactionOutput(tx);
      const signature = await signTransactionInput(alice, txnId);
      await token.connect(alice).approve(owner.address, amount);
      expect(await token.balanceOf(alice.address)).to.equal(amount);
      await token.connect(owner)[transferFrom.utxo](alice.address, bob.address, txnId, amount, signature);
      expect(await token.balanceOf(alice.address)).to.equal(0);
      expect(await token.balanceOf(bob.address)).to.equal(amount);
    });

    it("Freeze Alice Account and transferFrom", async function () {
      const {token, owner, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const txnId = await getTransactionOutput(tx);
      const signature = await signTransactionInput(alice, txnId);
      await token.connect(alice).approve(owner.address, amount);
      await token.setAddressFrozen(alice.address, true);
      expect(await token.isFrozen(alice.address)).to.equal(true);
      await expect(token.connect(owner).transferFrom(alice.address, bob.address, txnId, amount, signature)).to.be
        .reverted;
    });

    it("Freeze Alice Balance and transfer", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const txnId = await getTransactionOutput(tx);
      const signature = await signTransactionInput(alice, txnId);
      expect(await token.balanceOf(alice.address)).to.equal(amount);
      await token.freezePartialTokens(alice.address, frozenAmount);
      expect(await token.frozenBalanceOf(alice.address)).to.equal(frozenAmount);
      const amountDelta = BigInt(amount - frozenAmount);
      await token.connect(alice)[transfer.utxo](bob.address, txnId, amountDelta, signature);
      expect(await token.balanceOf(alice.address)).to.equal(frozenAmount);
      expect(await token.balanceOf(bob.address)).to.equal(amountDelta);
      // Even if signatures are invalid, the policy check executes first as a pre-transfer hook.
      await expect(
        token.connect(alice)[transfer.utxo](bob.address, txnId, frozenAmount, signature),
      ).to.be.revertedWithCustomError(token, "BalanceFrozen");
    });

    it("Freeze Alice Balance and transferFrom", async function () {
      const {token, owner, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const txnId = await getTransactionOutput(tx);
      const signature = await signTransactionInput(alice, txnId);
      expect(await token.balanceOf(alice.address)).to.equal(amount);
      await token.freezePartialTokens(alice.address, frozenAmount);
      expect(await token.frozenBalanceOf(alice.address)).to.equal(frozenAmount);
      await token.connect(alice).approve(owner.address, amount);
      const amountDelta = BigInt(amount - frozenAmount);
      await token.connect(owner)[transferFrom.utxo](alice.address, bob.address, txnId, amountDelta, signature);
      expect(await token.balanceOf(alice.address)).to.equal(frozenAmount);
      expect(await token.balanceOf(bob.address)).to.equal(amountDelta);
      // Even if signatures are invalid, the policy check executes first as a pre-transfer hook.
      await expect(
        token.connect(owner)[transferFrom.utxo](alice.address, bob.address, txnId, frozenAmount, signature),
      ).to.be.revertedWithCustomError(token, "BalanceFrozen");
    });

    it("Freeze Alice Token and transfer", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const txnId = await getTransactionOutput(tx);
      const signature = await signTransactionInput(alice, txnId);
      await token.freezeToken(txnId);
      expect(await token.isTokenFrozen(txnId)).to.equal(true);
      await expect(
        token.connect(alice)[transfer.utxo](bob.address, txnId, amount, signature),
      ).to.be.revertedWithCustomError(token, "TokenFrozen");
    });
  });
});
