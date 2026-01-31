const {expect} = require("chai");
const {amount, frozenAmount, TOKEN_METADATA, CONTRACT_NAME} = require("../../utils/constant");
const {hardhat_reset} = require("../../utils/network");

// skipping ERC20 behavior test because inherit from @openzeppelin/contracts
describe("ERC20", function () {
  async function deployTokenFixture() {
    const [owner, alice, bob, charlie, dave, otherAccount] = await ethers.getSigners();
    const contract = await ethers.getContractFactory(CONTRACT_NAME.ERC20);
    const token = await contract.deploy(TOKEN_METADATA.NAME, TOKEN_METADATA.SYMBOL);

    return {token, owner, alice, bob, charlie, dave, otherAccount};
  }

  afterEach(async function () {
    await hardhat_reset();
  });

  describe("Policies Enforcements Test", function () {
    it("Alice should not be able to transfer to Bob after freeze", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      await token.mint(alice.address, amount);
      await token.setAddressFrozen(alice.address, true);
      expect(await token.isFrozen(alice.address)).to.equal(true);
      await expect(token.connect(alice).transfer(bob.address, amount)).to.be.reverted;
    });

    it("Alice should not be able to transferFrom to Bob after freeze", async function () {
      const {token, owner, alice, bob} = await deployTokenFixture();
      await token.mint(alice.address, amount);
      await token.connect(alice).approve(owner.address, amount);
      await token.setAddressFrozen(alice.address, true);
      expect(await token.isFrozen(alice.address)).to.equal(true);
      await expect(token.connect(owner).transferFrom(alice.address, bob.address, amount)).to.be.reverted;
    });

    /** it's cover partial freeze */
    it("Alice should not be able to transfer to Bob after freeze balance", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      await token.mint(alice.address, amount);
      await token.freezePartialTokens(alice.address, frozenAmount);
      expect(await token.frozenBalanceOf(alice.address)).to.equal(frozenAmount);
      const amountDelta = BigInt(amount - frozenAmount);
      await expect(token.connect(alice).transfer(bob.address, amountDelta)).not.to.be.reverted;
      expect(await token.balanceOf(bob.address)).to.equal(amountDelta);
      await expect(token.connect(alice).transfer(bob.address, frozenAmount)).to.be.revertedWithCustomError(
        token,
        "BalanceFrozen",
      );
    });

    it("Freeze Alice Balance and transferFrom to Bob after freeze balance", async function () {
      const {token, owner, alice, bob} = await deployTokenFixture();
      await token.mint(alice, amount);
      await token.connect(alice).approve(owner.address, amount);
      await token.freezePartialTokens(alice.address, frozenAmount);
      expect(await token.frozenBalanceOf(alice.address)).to.equal(frozenAmount);
      const amountDelta = BigInt(amount - frozenAmount);
      await expect(token.connect(owner).transferFrom(alice.address, bob.address, amountDelta)).not.to.be.reverted;
      expect(await token.balanceOf(bob.address)).to.equal(amountDelta);
      await expect(token.connect(alice).transfer(bob.address, frozenAmount)).to.be.revertedWithCustomError(
        token,
        "BalanceFrozen",
      );
    });
  });
});
