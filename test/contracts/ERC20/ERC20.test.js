const {loadFixture} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const {expect} = require("chai");
const {amount, frozenAmount, tokenMetadata} = require("../../utils/constant");

// skipping ERC20 behavior test because inherit from @openzeppelin/contracts
describe("ERC20", function () {
  async function deployTokenFixture() {
    const [owner, alice, bob, charlie, dave, otherAccount] = await ethers.getSigners();
    const contract = await ethers.getContractFactory("MockERC20");
    const token = await contract.deploy(tokenMetadata.name, tokenMetadata.symbol);

    return {token, owner, alice, bob, charlie, dave, otherAccount};
  }

  describe("Policies Enforcements Test", function () {
    it("Freeze Alice Account and transfer", async function () {
      const {token, alice, bob} = await loadFixture(deployTokenFixture);
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      await token.mint(aliceAddress, amount);
      await token.setAddressFrozen(aliceAddress, true);
      expect(await token.isFrozen(aliceAddress)).to.equal(true);
      await expect(token.connect(alice).transfer(bobAddress, amount)).to.be.reverted;
    });

    it("Freeze Alice Account and transferFrom", async function () {
      const {token, owner, alice, bob} = await loadFixture(deployTokenFixture);
      const spenderAddress = owner.address;
      const aliceAddress = alice.address;
      await token.mint(aliceAddress, amount);
      await token.connect(alice).approve(spenderAddress, amount);
      await token.setAddressFrozen(aliceAddress, true);
      expect(await token.isFrozen(aliceAddress)).to.equal(true);
      await expect(token.connect(owner).transferFrom(aliceAddress, bob.address, amount)).to.be.reverted;
    });

    it("Freeze Alice Balance and transfer", async function () {
      const {token, alice, bob} = await loadFixture(deployTokenFixture);
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      await token.mint(aliceAddress, amount);
      await token.freezePartialTokens(aliceAddress, frozenAmount);
      expect(await token.frozenBalanceOf(aliceAddress)).to.equal(frozenAmount);
      await expect(token.connect(alice).transfer(bobAddress, amount - frozenAmount)).not.to.be.reverted;
      await expect(token.connect(alice).transfer(bobAddress, frozenAmount)).to.be.reverted;
    });

    it("Freeze Alice Balance and transferFrom", async function () {
      const {token, owner, alice, bob} = await loadFixture(deployTokenFixture);
      const spenderAddress = owner.address;
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      await token.mint(alice, amount);
      await token.connect(alice).approve(spenderAddress, amount);
      await token.freezePartialTokens(aliceAddress, frozenAmount);
      expect(await token.frozenBalanceOf(aliceAddress)).to.equal(frozenAmount);
      await expect(token.connect(owner).transferFrom(aliceAddress, bobAddress, amount - frozenAmount)).not.to.be
        .reverted;
      await expect(token.connect(owner).transferFrom(aliceAddress, bobAddress, frozenAmount)).to.be.reverted;
    });
  });
});
