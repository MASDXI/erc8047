const {anyValue} = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const {expect} = require("chai");
const {toBeHex, toBigInt, encodeBytes32String} = require("ethers");
const {amount, TOKEN_METADATA, tokenId, CONTRACT_NAME} = require("../../utils/constant");
const {hardhat_reset} = require("../../utils/network");

describe("ERC8047", function () {
  async function deployTokenFixture() {
    const [owner, alice, bob, charlie, dave, otherAccount] = await ethers.getSigners();
    const contract = await ethers.getContractFactory(CONTRACT_NAME.ERC8047);
    const token = await contract.deploy(TOKEN_METADATA.NAME, TOKEN_METADATA.SYMBOL, TOKEN_METADATA.URI);

    return {token, owner, alice, bob, charlie, otherAccount};
  }

  afterEach(async function () {
    await hardhat_reset();
  });

  describe("ERC5615 Conformance Test", function () {
    it("exists", async function () {
      const {token, alice} = await deployTokenFixture();
      const aliceAddress = alice.address;
      await token.mint(aliceAddress, amount);
      expect(await token.exists(tokenId)).to.equal(true);
      expect(await token.exists(0)).to.equal(false);
    });

    it("totalSupply", async function () {
      const {token, alice} = await deployTokenFixture();
      const aliceAddress = alice.address;
      await token.mint(aliceAddress, amount);
      expect(await token["totalSupply(uint256)"](tokenId)).to.equal(amount);
      expect(await token["totalSupply(uint256)"](0)).to.equal(0);
    });
  });

  describe("ERC8047 Behavior Specification Test", function () {
    it("levelOf", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const aliceAddress = alice.address;
      await token.mint(aliceAddress, amount);
      expect(await token.levelOf(toBigInt(0))).to.equal(0);
    });

    it("ownerOf", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const aliceAddress = alice.address;
      await token.mint(aliceAddress, amount);
      expect(await token.ownerOf(tokenId)).to.equal(aliceAddress);
    });

    it("parentOf", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const aliceAddress = alice.address;
      await token.mint(aliceAddress, amount);
      expect(await token.parentOf(tokenId)).to.equal(0);
      // transfer token and then parent of the new token point to the previous spent token
    });

    it("rootOf", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const aliceAddress = alice.address;
      await token.mint(aliceAddress, amount);
      // pointing to self if the token is root.
      expect(await token.rootOf(tokenId)).to.equal(tokenId);
      // pointing to root if the token is not root.
      // perform transfer and check root of new token.
    });

    it("balanceOf", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const aliceAddress = alice.address;
      await token.mint(aliceAddress, amount);
      expect(await token.balanceOf(aliceAddress, tokenId)).to.equal(amount);
    });

    it("totalSupply", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const aliceAddress = alice.address;
      await token.mint(aliceAddress, amount);
      expect(await token["totalSupply()"]()).to.equal(amount);
    });

    it("safeTransferFrom partial", async function () {
      // mint(aliceAddress)
      // transfer(root) -> new token create -> id
      // transfer(root) -> new token create -> id2
      // levelOf(root).equal(0)
      // levelOf(id).equal(1)
      // levelOf(id2).equal(1)
      // totalSupply(root).equal(0)
      // totalSupply(id).equal(500)
      // totalSupply(id2).equal(500)
    });

    it("safeTransferFrom full", async function () {
      // mint(aliceAddress)
      // transfer(root) -> new token create -> id
      // levelOf(root).equal(0)
      // levelOf(id).equal(1)
      // totalSupply(root).equal(0)
      // totalSupply(id2).equal(1000)
    });

    // @TODO batch
  });

  describe("Policies Enforcements Test", function () {
    it("Freeze Alice Account and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      await token.mint(aliceAddress, amount);
      await token.setAddressFrozen(aliceAddress, true);

      await expect(
        token.connect(alice).safeTransferFrom(aliceAddress, bobAddress, tokenId, amount, encodeBytes32String("")),
      ).to.be.reverted;
    });

    it("Freeze Alice Balance and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      await token.mint(aliceAddress, amount);
      await token.freezePartialTokens(aliceAddress, amount);

      await expect(
        token.connect(alice).safeTransferFrom(aliceAddress, bobAddress, tokenId, amount, encodeBytes32String("")),
      ).to.be.reverted;
    });

    it("Freeze Alice Token and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      await token.mint(aliceAddress, amount);

      await token.freezeToken(toBeHex(tokenId));

      await expect(
        token.connect(alice).safeTransferFrom(aliceAddress, bobAddress, tokenId, amount, encodeBytes32String("")),
      ).to.be.reverted;
    });

    it("Freeze at root and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      // mint token to alice
      // alice transfer to bob 100
      // freeze root of DAG
      // alice transfer to charlie 100 expect reverted
      // bob transfer to charlie 100 expect reverted
    });

    it("Freeze at level and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      // mint token to alice
      // alice transfer to bob 100
      // freeze level 1
      // alice transfer to charlie 100
      // bob transfer to charlie 100 (level 1) expect reverted
    });
  });
});
