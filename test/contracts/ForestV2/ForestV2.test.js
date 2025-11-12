const {loadFixture} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const {anyValue} = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const {network} = require("hardhat");
const {expect} = require("chai");
const {Interface, zeroPadBytes, toBigInt, encodeBytes32String} = require("ethers");
const {amount, tokenMetadata} = require("../../utils/constant");
// const {abi} = require("../../../artifacts/contracts/abstracts/ForestTokenV2.sol/ForestTokenV2.json");

describe("ForestV2", function () {
  async function deployTokenFixture() {
    const [owner, alice, bob, charlie, dave, otherAccount] = await ethers.getSigners();
    const contract = await ethers.getContractFactory("MockForestV2");
    const token = await contract.deploy(tokenMetadata.name, tokenMetadata.symbol);

    return {token, owner, alice, bob, charlie, otherAccount};
  }

  describe("Scenarios", function () {
    it("Freeze Alice Account and safeTransferFrom", async function () {
      const {token, alice, bob} = await loadFixture(deployTokenFixture);
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      let tx = await token.mint(aliceAddress, amount);
      tx = await tx.wait();
      // Extract token id from event.
      let abi = ["event TransactionCreated(bytes32 indexed root, bytes32 id, address indexed from)"];
      let interface = new Interface(abi);
      let tokenId = interface.parseLog(tx.logs[0]).args[0];
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
      let tx = await token.mint(aliceAddress, amount);
      tx = await tx.wait();
      // Extract token id from event.
      let abi = ["event TransactionCreated(bytes32 indexed root, bytes32 id, address indexed from)"];
      let interface = new Interface(abi);
      let tokenId = interface.parseLog(tx.logs[0]).args[0];
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
      let tx = await token.mint(aliceAddress, amount);
      tx = await tx.wait();
      // Extract token id from event.
      let abi = ["event TransactionCreated(bytes32 indexed root, bytes32 id, address indexed from)"];
      let interface = new Interface(abi);
      let tokenId = interface.parseLog(tx.logs[0]).args[0];
      await token.freezeToken(tokenId);

      await expect(
        token
          .connect(alice)
          .safeTransferFrom(aliceAddress, bobAddress, toBigInt(tokenId), amount, encodeBytes32String("")),
      ).to.be.reverted;
    });

    it("Freeze at root and safeTransferFrom", async function () {
      const {token, alice, bob} = await loadFixture(deployTokenFixture);
    });

    it("Freeze at level and safeTransferFrom", async function () {
      const {token, alice, bob} = await loadFixture(deployTokenFixture);
    });
  });
});
