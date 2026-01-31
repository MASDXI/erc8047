const {anyValue} = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const {expect} = require("chai");
const {toBeHex, toBigInt, encodeBytes32String, ZeroAddress} = require("ethers");
const {amount, TOKEN_METADATA, tokenId, CONTRACT_NAME} = require("../../utils/constant");
const {hardhat_reset} = require("../../utils/network");
const {getChildTokenId} = require("../../utils/token");

describe("ERC8047", function () {
  async function deployTokenFixture() {
    const [owner, alice, bob, charlie, dave, otherAccount] = await ethers.getSigners();
    const contract = await ethers.getContractFactory(CONTRACT_NAME.ERC8047);
    const token = await contract.deploy(TOKEN_METADATA.URI);

    return {token, owner, alice, bob, charlie, otherAccount};
  }

  afterEach(async function () {
    await hardhat_reset();
  });

  describe("ERC1155 Conformance Test", function () {
    it("balanceOf", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getChildTokenId(tx);
      expect(await token.balanceOf(alice.address, tokenId)).to.equal(amount);
      expect(await token.balanceOf(bob.address, tokenId)).to.equal(0);
    });

    it("balanceOfBatch", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getChildTokenId(tx);
      expect(await token.balanceOfBatch([alice.address, bob.address], [tokenId, 0])).to.deep.equal([amount, 0n]);
      await expect(token.balanceOfBatch([alice.address], [tokenId, 0]))
        .to.be.revertedWithCustomError(token, "ERC1155InvalidArrayLength")
        .withArgs(2, 1);
    });

    it("setApprovalForAll", async function () {
      const {token, owner, alice} = await deployTokenFixture();

      const ownerAddress = owner.address;
      await token.mint(alice.address, amount);
      expect(await token.isApprovedForAll(alice.address, ownerAddress)).to.equal(false);
      expect(await token.connect(alice).setApprovalForAll(ownerAddress, true))
        .to.emit(token, "ApprovalForAll")
        .withArgs(alice.address, ownerAddress, true);
      await expect(token.connect(alice).setApprovalForAll(ZeroAddress, true))
        .to.be.revertedWithCustomError(token, "ERC1155InvalidOperator")
        .withArgs(ZeroAddress);
      expect(await token.isApprovedForAll(alice.address, ownerAddress)).to.equal(true);
    });

    it("uri", async function () {
      const {token, alice} = await deployTokenFixture();
      await token.mint(alice.address, amount);
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getChildTokenId(tx);
      expect(await token.uri(tokenId)).to.equal(TOKEN_METADATA.URI);
      // Note: In ERC-8047 using same URI for all token ids.
      expect(await token.uri(0)).to.equal(TOKEN_METADATA.URI);
      const newURI = `${TOKEN_METADATA.URI}test`;
      await expect(token.setURI(newURI)).to.be.emit(token, "URI").withArgs(newURI, 0);
    });
  });

  describe("ERC5615 Conformance Test", function () {
    it("exists", async function () {
      const {token, alice} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getChildTokenId(tx);
      expect(await token.exists(tokenId)).to.equal(true);
      expect(await token.exists(0)).to.equal(false);
    });

    it("totalSupply", async function () {
      const {token, alice} = await deployTokenFixture();

      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getChildTokenId(tx);
      expect(await token["totalSupply(uint256)"](tokenId)).to.equal(amount);
      expect(await token["totalSupply(uint256)"](0)).to.equal(0);
    });
  });

  describe("ERC8047 Behavior Specification Test", function () {
    it("levelOf", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const rootToken = await getChildTokenId(tx);
      x = await token.connect(alice).safeTransferFrom(alice.address, bob.address, rootToken, 1, "0x");
      tx = await tx.wait();
      const tokenId = await getChildTokenId(tx);
      await expect(tx).to.be.emit(token, "TokenCreated").withArgs(rootToken, tokenId, alice);
      expect(await token.levelOf(rootToken)).to.equal(0);
      expect(await token.levelOf(tokenId)).to.equal(1);
    });

    it("ownerOf", async function () {
      const {token, alice} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getChildTokenId(tx);
      expect(await token.ownerOf(tokenId)).to.equal(alice.address);
    });

    it("parentOf", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const rootToken = await getChildTokenId(tx);
      // pointing to self if the token is root.
      expect(await token.parentOf(rootToken)).to.equal(0);
      tx = await token.connect(alice).safeTransferFrom(alice.address, bob.address, rootToken, 1, "0x");
      tx = await tx.wait();
      const tokenId = await getChildTokenId(tx);
      await expect(tx).to.be.emit(token, "TokenCreated").withArgs(rootToken, tokenId, alice);
      expect(await token.parentOf(tokenId)).to.equal(rootToken);
    });

    it("rootOf", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const rootToken = await getChildTokenId(tx);
      // pointing to self if the token is root.
      expect(await token.rootOf(rootToken)).to.equal(rootToken);
      tx = await token.connect(alice).safeTransferFrom(alice.address, bob.address, rootToken, 1, "0x");
      tx = await tx.wait();
      const tokenId = await getChildTokenId(tx);
      await expect(tx).to.be.emit(token, "TokenCreated").withArgs(rootToken, tokenId, alice);
      expect(await token.rootOf(tokenId)).to.equal(rootToken);
    });

    it("totalSupply", async function () {
      const {token, alice} = await deployTokenFixture();
      await token.mint(alice.address, amount);
      expect(await token["totalSupply()"]()).to.equal(amount);
    });

    it("safeTransferFrom partial", async function () {
      // mint(alice.address)
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
      // mint(alice.address)
      // transfer(root) -> new token create -> id
      // levelOf(root).equal(0)
      // levelOf(id).equal(1)
      // totalSupply(root).equal(0)
      // totalSupply(id2).equal(1000)
    });

    // @TODO safeBatchTransferFrom partial

    // @TODO safeBatchTransferFrom full
  });

  describe("Policies Enforcements Test", function () {
    it("Freeze Alice Account and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      await token.mint(alice.address, amount);
      await token.setAddressFrozen(alice.address, true);
      await expect(
        token.connect(alice).safeTransferFrom(alice.address, bob.address, tokenId, amount, encodeBytes32String("")),
      ).to.be.reverted;
    });

    it("Freeze Alice Balance and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      await token.mint(alice.address, amount);
      await token.freezePartialTokens(alice.address, amount);
      await expect(
        token.connect(alice).safeTransferFrom(alice.address, bob.address, tokenId, amount, encodeBytes32String("")),
      ).to.be.reverted;
    });

    it("Freeze Alice Token and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      await token.mint(alice.address, amount);
      await token.freezeToken(toBeHex(tokenId));
      await expect(
        token.connect(alice).safeTransferFrom(alice.address, bob.address, tokenId, amount, encodeBytes32String("")),
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
