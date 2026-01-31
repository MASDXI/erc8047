const {loadFixture} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const {anyValue} = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const {network} = require("hardhat");
const {expect} = require("chai");
const {Interface, zeroPadBytes, toBigInt, encodeBytes32String} = require("ethers");
const {amount, TOKEN_METADATA, tokenId, CONTRACT_NAME} = require("../../utils/constant");

describe("ERC8047", function () {
  async function deployTokenFixture() {
    const [owner, alice, bob, charlie, dave, otherAccount] = await ethers.getSigners();
    const contract = await ethers.getContractFactory(CONTRACT_NAME.ERC8047);
    const token = await contract.deploy(TOKEN_METADATA.NAME, TOKEN_METADATA.SYMBOL, TOKEN_METADATA.URI);

    return {token, owner, alice, bob, charlie, otherAccount};
  }

  describe("ERC8047 Behavior Specification Test", function () {
    // @TODO

    it("levelOf", async function () {
      // mint(aliceAddress)
      // transfer(root) -> new token create -> id
      // levelOf(root).equal(0)
      // levelOf(id).equal(1)
    });

    it("ownerOf", async function () {
      // mint(aliceAddress)
      // ownerOf(root).equal(aliceAddress)
    });

    it("parentOf", async function () {
      // mint(aliceAddress)
      // transfer(root) -> new token create -> id
      // transfer(id) -> new token create -> id2
      // parentOf(id2).equal(id)
    });

    it("rootOf", async function () {
      // mint(aliceAddress)
      // transfer(root) -> new token create -> id
      // roofOf(id).equal(root)
    });

    it("balanceOf", async function () {
      // mint(aliceAddress)
      // balanceOf(aliceAddress).equal(1)
      // balanceOf(bobAddress).equal(0)
    });

    it("totalSupply", async function () {
      // mint(aliceAddress)
      // mint(bobAddress)
      // totalSupply()
    });

    it("totalSupply with specific id", async function () {
      // mint(aliceAddress)
      // totalSupply(root)
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
  });

  describe("Policies Enforcements Test", function () {
    it("Freeze Alice Account and safeTransferFrom", async function () {
      const {token, alice, bob} = await loadFixture(deployTokenFixture);
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      await token.mint(aliceAddress, amount);
      await token.setAddressFrozen(aliceAddress, true);

      await expect(
        token
          .connect(alice)
          .safeTransferFrom(aliceAddress, bobAddress, toBigInt(tokenId), amount, encodeBytes32String("")),
      ).to.be.reverted;
    });

    it("Freeze Alice Balance and safeTransferFrom", async function () {
      const {token, alice, bob} = await loadFixture(deployTokenFixture);
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      await token.mint(aliceAddress, amount);
      await token.freezePartialTokens(aliceAddress, amount);

      await expect(
        token
          .connect(alice)
          .safeTransferFrom(aliceAddress, bobAddress, toBigInt(tokenId), amount, encodeBytes32String("")),
      ).to.be.reverted;
    });

    it("Freeze Alice Token and safeTransferFrom", async function () {
      const {token, alice, bob} = await loadFixture(deployTokenFixture);
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      await token.mint(aliceAddress, amount);

      await token.freezeToken(tokenId);

      await expect(
        token
          .connect(alice)
          .safeTransferFrom(aliceAddress, bobAddress, toBigInt(tokenId), amount, encodeBytes32String("")),
      ).to.be.reverted;
    });

    it("Freeze at root and safeTransferFrom", async function () {
      const {token, alice, bob} = await loadFixture(deployTokenFixture);
      // mint token to alice
      // alice transfer to bob 100
      // freeze root of DAG
      // alice transfer to charlie 100 expect reverted
      // bob transfer to charlie 100 expect reverted
    });

    it("Freeze at level and safeTransferFrom", async function () {
      const {token, alice, bob} = await loadFixture(deployTokenFixture);
      // mint token to alice
      // alice transfer to bob 100
      // freeze level 1
      // alice transfer to charlie 100
      // bob transfer to charlie 100 (level 1) expect reverted
    });
  });
});
