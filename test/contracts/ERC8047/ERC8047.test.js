const {expect} = require("chai");
const {toBeHex, ZeroAddress} = require("ethers");
const {
  amount,
  partialAmount,
  TOKEN_METADATA,
  CONTRACT_NAME,
  ERC165InterfaceId,
  ERC1155InterfaceId,
  ERC5615InterfaceId,
  ERC8047InterfaceId,
} = require("../../utils/constant");
const {hardhat_reset} = require("../../utils/network");
const {getCreatedTokenId, mint} = require("../../utils/token");

describe("ERC-8047", function () {
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
    it("setApprovalForAll", async function () {
      const {token, owner, alice, bob} = await deployTokenFixture();
      const ownerAddress = owner.address;
      await token.mint(alice.address, amount);
      const rootTokenId = await mint(token, alice.address, amount);
      expect(await token.isApprovedForAll(alice.address, ownerAddress)).to.equal(false);
      expect(await token.connect(alice).setApprovalForAll(ownerAddress, true))
        .to.emit(token, "ApprovalForAll")
        .withArgs(alice.address, ownerAddress, true);
      await expect(token.connect(alice).setApprovalForAll(ZeroAddress, true))
        .to.be.revertedWithCustomError(token, "ERC1155InvalidOperator")
        .withArgs(ZeroAddress);
      expect(await token.isApprovedForAll(alice.address, ownerAddress)).to.equal(true);
      tx = await token.connect(owner).safeTransferFrom(alice.address, bob.address, rootTokenId, partialAmount, "0x");
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      expect(await token.balanceOf(bob.address, tokenId)).to.equal(partialAmount);
    });

    it("uri", async function () {
      const {token, alice} = await deployTokenFixture();
      const tokenId = await mint(token, alice.address, amount);
      expect(await token.uri(tokenId)).to.equal(TOKEN_METADATA.URI);
      // Note: In ERC-8047 using same URI for all token ids.
      expect(await token.uri(0)).to.equal(TOKEN_METADATA.URI);
      const newURI = `${TOKEN_METADATA.URI}test`;
      await expect(token.setURI(newURI)).to.be.emit(token, "URI").withArgs(newURI, 0);
    });
  });

  describe("ERC-8047", function () {
    it("mint", async function () {
      const {token, alice} = await deployTokenFixture();
      await expect(token.mint(ZeroAddress, amount))
        .to.be.revertedWithCustomError(token, "TokenInvalidReceiver")
        .withArgs(ZeroAddress);
      await expect(token.mint(alice.address, 0)).to.be.revertedWithCustomError(token, "TokenZeroValue");
      const tokenId = await mint(token, alice.address, amount);
      expect(tx).to.be.emit(token, "TokenCreated").withArgs(tokenId, tokenId, alice);
      expect(await token.balanceOf(alice.address, tokenId)).to.equal(amount);
    });

    it("burn", async function () {
      // @TODO
    });

    it("tracks DAG levels, roots, parents, ownership, and supply correctly", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      // supportInterface test
      expect(await token.supportsInterface(ERC165InterfaceId)).to.equal(true);
      expect(await token.supportsInterface(ERC1155InterfaceId)).to.equal(true);
      expect(await token.supportsInterface(ERC5615InterfaceId)).to.equal(true);
      expect(await token.supportsInterface(ERC8047InterfaceId)).to.equal(true);
      // expect(await token.supportsInterface("0x4e1273f4")).to.equal(true);
      const rootTokenId = await mint(token, alice.address, amount);
      // latestDAGLevelOf
      expect(await token.latestDAGLevelOf(rootTokenId)).to.equal(0);
      // safeTransferFrom
      tx = await token.connect(alice).safeTransferFrom(alice.address, bob.address, rootTokenId, partialAmount, "0x");
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      // exist
      expect(await token.exists(0)).to.equal(false);
      expect(await token.exists(rootTokenId)).to.equal(true);
      expect(await token.exists(tokenId)).to.equal(true);
      // latestDAGLevelOf test
      expect(await token.latestDAGLevelOf(0)).to.equal(0);
      expect(await token.latestDAGLevelOf(rootTokenId)).to.equal(1);
      expect(await token.latestDAGLevelOf(tokenId)).to.equal(1);
      // levelOf test
      expect(await token.levelOf(0)).to.equal(0);
      expect(await token.levelOf(rootTokenId)).to.equal(0);
      expect(await token.levelOf(tokenId)).to.equal(1);
      // balanceOf test
      expect(await token.balanceOf(alice.address, rootTokenId)).to.equal(partialAmount);
      expect(await token.balanceOf(alice.address, tokenId)).to.equal(0);
      expect(await token.balanceOf(bob.address, tokenId)).to.equal(partialAmount);
      // balanceOfBatch test
      expect(await token.balanceOfBatch([alice.address, bob.address], [rootTokenId, tokenId])).to.deep.equal([
        partialAmount,
        partialAmount,
      ]);
      expect(await token.balanceOfBatch([alice.address, bob.address], [tokenId, tokenId])).to.deep.equal([
        0n,
        partialAmount,
      ]);
      expect(await token.balanceOfBatch([alice.address, bob.address], [0, 0])).to.deep.equal([0n, 0n]);
      await expect(token.balanceOfBatch([alice.address], [rootTokenId, tokenId]))
        .to.be.revertedWithCustomError(token, "ERC1155InvalidArrayLength")
        .withArgs(2, 1);
      // rootOf test
      expect(await token.rootOf(0)).to.equal(0);
      expect(await token.rootOf(rootTokenId)).to.equal(rootTokenId);
      expect(await token.rootOf(tokenId)).to.equal(rootTokenId);
      // parentOf test
      expect(await token.parentOf(0)).to.equal(0);
      expect(await token.parentOf(rootTokenId)).to.equal(0);
      expect(await token.parentOf(tokenId)).to.equal(rootTokenId);
      // ownerOf test
      expect(await token.ownerOf(0)).to.equal(ZeroAddress);
      expect(await token.ownerOf(rootTokenId)).to.equal(alice.address);
      expect(await token.ownerOf(tokenId)).to.equal(bob.address);
      // tokens test
      // @TODO
      // expect(await token.tokens(0)).to.equal(object);
      // expect(await token.ownerOf(rootTokenId)).to.equal(object);
      // expect(await token.ownerOf(tokenId)).to.equal(object);
      // totalSupply test
      expect(await token["totalSupply(uint256)"](0)).to.equal(0);
      expect(await token["totalSupply(uint256)"](rootTokenId)).to.equal(partialAmount);
      expect(await token["totalSupply(uint256)"](tokenId)).to.equal(partialAmount);
      expect(await token["totalSupply()"]()).to.equal(amount);
    });

    it("safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const rootTokenId = await mint(token, alice.address, amount);
      tx = await token.connect(alice).safeTransferFrom(alice.address, bob.address, rootTokenId, partialAmount, "0x");
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      // ERC-1155 events
      await expect(tx)
        .to.be.emit(token, "TransferSingle")
        .withArgs(alice.address, alice.address, ZeroAddress, rootTokenId, partialAmount);
      await expect(tx)
        .to.be.emit(token, "TransferSingle")
        .withArgs(alice.address, ZeroAddress, bob.address, tokenId, partialAmount);
      // ERC-8047 events
      await expect(tx).to.be.emit(token, "TokenSpent").withArgs(rootTokenId, rootTokenId, partialAmount);
      await expect(tx).to.be.emit(token, "TokenCreated").withArgs(rootTokenId, tokenId, alice);
    });

    it("safeBatchTransferFrom", async function () {
      // @TODO
    });
  });

  describe("Policies Enforcements Test", function () {
    it("Freeze Alice Account and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const tokenId = await mint(token, alice.address, amount);
      await token.setAddressFrozen(alice.address, true);
      await expect(token.connect(alice).safeTransferFrom(alice.address, bob.address, tokenId, amount, "0x")).to.be
        .reverted;
    });

    it("Freeze Alice Balance and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const tokenId = await mint(token, alice.address, amount);
      await token.freezePartialTokens(alice.address, amount);
      await expect(token.connect(alice).safeTransferFrom(alice.address, bob.address, tokenId, amount, "0x")).to.be
        .reverted;
    });

    it("Freeze Alice Token and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const tokenId = await mint(token, alice.address, amount);
      await token.freezeToken(toBeHex(tokenId));
      await expect(token.connect(alice).safeTransferFrom(alice.address, bob.address, tokenId, amount, "0x")).to.be
        .reverted;
    });

    it("Freeze at root and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      const rootTokenId = await mint(token, alice.address, amount);
      expect(await token.rootOf(rootTokenId)).to.equal(rootTokenId);
      tx = await token.connect(alice).safeTransferFrom(alice.address, bob.address, rootTokenId, partialAmount, "0x");
      tx = await tx.wait();
      const tokenId1 = await getCreatedTokenId(tx);
      expect(await token.balanceOf(alice.address, rootTokenId)).to.equal(partialAmount);
      const amountDelta = partialAmount / 2n;
      tx = await token.connect(bob).safeTransferFrom(bob.address, alice.address, tokenId1, partialAmount / 2n, "0x");
      tx = await tx.wait();
      const tokenId2 = await getCreatedTokenId(tx);
      expect(await token.balanceOf(bob.address, tokenId1)).to.equal(amountDelta);
      await token.freezeToken(toBeHex(rootTokenId));
      expect(await token.isTokenFrozen(toBeHex(rootTokenId))).to.equal(true);
      expect(await token.isTokenFrozen(toBeHex(tokenId1))).to.equal(false);
      await expect(
        token.connect(alice).safeTransferFrom(alice.address, bob.address, rootTokenId, partialAmount, "0x"),
      ).to.be.revertedWithCustomError(token, "TokenFrozen");
      // Note: parent of tokenId1 is frozen then transaction are expect to be reverted.
      await expect(
        token.connect(bob).safeTransferFrom(bob.address, alice.address, tokenId1, amountDelta, "0x"),
      ).to.be.revertedWithCustomError(token, "TokenFrozen");
      tx = await token.connect(alice).safeTransferFrom(alice.address, bob.address, tokenId2, amountDelta, "0x");
      tx = await tx.wait();
      const tokenId3 = await getCreatedTokenId(tx);
      await expect(tx).not.to.be.reverted;
      expect(await token.balanceOf(alice.address, tokenId2)).to.equal(0);
      expect(await token.balanceOf(bob.address, tokenId3)).to.equal(amountDelta);
    });

    it("Freeze at level and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      // mint token to alice
      // alice transfer to bob 100
      // freeze level partialAmount
      // alice transfer to charlie 100
      // bob transfer to charlie 100 (level partialAmount) expect reverted
    });
  });
});
