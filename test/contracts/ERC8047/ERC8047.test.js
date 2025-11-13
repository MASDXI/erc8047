const {loadFixture} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const {anyValue} = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const {network} = require("hardhat");
const {expect} = require("chai");
const {Interface, zeroPadBytes, toBigInt, encodeBytes32String} = require("ethers");
const {amount, tokenMetadata, tokenId} = require("../../utils/constant");
// const {abi} = require("../../../artifacts/contracts/abstracts/ForestTokenV2.sol/ForestTokenV2.json");

describe("ERC8047", function () {
  async function deployTokenFixture() {
    const [owner, alice, bob, charlie, dave, otherAccount] = await ethers.getSigners();
    const contract = await ethers.getContractFactory("MockERC8047");
    const token = await contract.deploy(tokenMetadata.name, tokenMetadata.symbol);

    return {token, owner, alice, bob, charlie, otherAccount};
  }

  describe("Scenarios", function () {
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
