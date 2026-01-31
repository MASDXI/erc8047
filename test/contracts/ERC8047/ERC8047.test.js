const {expect} = require("chai");
const {toBeHex, encodeBytes32String, ZeroAddress} = require("ethers");
const {amount, partialAmount, TOKEN_METADATA, CONTRACT_NAME} = require("../../utils/constant");
const {hardhat_reset} = require("../../utils/network");
const {getCreatedTokenId} = require("../../utils/token");

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
    it("balanceOf", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      expect(await token.balanceOf(alice.address, tokenId)).to.equal(amount);
      expect(await token.balanceOf(bob.address, tokenId)).to.equal(0);
    });

    it("balanceOfBatch", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      expect(await token.balanceOfBatch([alice.address, bob.address], [tokenId, 0])).to.deep.equal([amount, 0n]);
      await expect(token.balanceOfBatch([alice.address], [tokenId, 0]))
        .to.be.revertedWithCustomError(token, "ERC1155InvalidArrayLength")
        .withArgs(2, 1);
    });

    it("safeTransferFrom", async function () {
      // @TODO
    });

    it("safeBatchTransferFrom", async function () {
      // @TODO
    });

    it("setApprovalForAll", async function () {
      const {token, owner, alice, bob} = await deployTokenFixture();
      const ownerAddress = owner.address;
      await token.mint(alice.address, amount);
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const rootToken = await getCreatedTokenId(tx);
      expect(await token.isApprovedForAll(alice.address, ownerAddress)).to.equal(false);
      expect(await token.connect(alice).setApprovalForAll(ownerAddress, true))
        .to.emit(token, "ApprovalForAll")
        .withArgs(alice.address, ownerAddress, true);
      await expect(token.connect(alice).setApprovalForAll(ZeroAddress, true))
        .to.be.revertedWithCustomError(token, "ERC1155InvalidOperator")
        .withArgs(ZeroAddress);
      expect(await token.isApprovedForAll(alice.address, ownerAddress)).to.equal(true);
      tx = await token.connect(owner).safeTransferFrom(alice.address, bob.address, rootToken, partialAmount, "0x");
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      expect(await token.balanceOf(bob.address, tokenId)).to.equal(partialAmount);
    });

    it("uri", async function () {
      const {token, alice} = await deployTokenFixture();
      await token.mint(alice.address, amount);
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      expect(await token.uri(tokenId)).to.equal(TOKEN_METADATA.URI);
      // Note: In ERC-8047 using same URI for all token ids.
      expect(await token.uri(0)).to.equal(TOKEN_METADATA.URI);
      const newURI = `${TOKEN_METADATA.URI}test`;
      await expect(token.setURI(newURI)).to.be.emit(token, "URI").withArgs(newURI, 0);
    });
  });

  describe("ERC-5615 Conformance Test", function () {
    it("exists", async function () {
      const {token, alice} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      expect(await token.exists(tokenId)).to.equal(true);
      expect(await token.exists(0)).to.equal(false);
    });

    it("totalSupply", async function () {
      const {token, alice} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      expect(await token["totalSupply(uint256)"](tokenId)).to.equal(amount);
      expect(await token["totalSupply(uint256)"](0)).to.equal(0);
    });
  });

  describe("ERC-8047 Behavior Specification Test", function () {
    it("mint", async function () {
      const {token, alice} = await deployTokenFixture();
      await expect(token.mint(ZeroAddress, amount))
        .to.be.revertedWithCustomError(token, "TokenInvalidReceiver")
        .withArgs(ZeroAddress);
      await expect(token.mint(alice.address, 0)).to.be.revertedWithCustomError(token, "TokenZeroValue");
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      expect(tx).to.be.emit(token, "TokenCreated").withArgs(tokenId, tokenId, alice);
      expect(await token.balanceOf(alice.address, tokenId)).to.equal(amount);
    });

    it("burn", async function () {
      // @TODO
    });

    it("levelOf", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const rootToken = await getCreatedTokenId(tx);
      expect(await token.latestDAGLevelOf(rootToken)).to.equal(0);
      tx = await token.connect(alice).safeTransferFrom(alice.address, bob.address, rootToken, partialAmount, "0x");
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      await expect(tx).to.be.emit(token, "TokenSpent").withArgs(rootToken, rootToken, partialAmount);
      await expect(tx).to.be.emit(token, "TokenCreated").withArgs(rootToken, tokenId, alice);
      expect(await token.latestDAGLevelOf(tokenId)).to.equal(1);
      expect(await token.balanceOf(alice.address, tokenId)).to.equal(0);
      expect(await token.balanceOf(bob.address, tokenId)).to.equal(partialAmount);
    });

    it("levelOf", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const rootToken = await getCreatedTokenId(tx);
      tx = await token.connect(alice).safeTransferFrom(alice.address, bob.address, rootToken, partialAmount, "0x");
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      await expect(tx).to.be.emit(token, "TokenSpent").withArgs(rootToken, rootToken, partialAmount);
      await expect(tx).to.be.emit(token, "TokenCreated").withArgs(rootToken, tokenId, alice);
      expect(await token.levelOf(rootToken)).to.equal(0);
      expect(await token.levelOf(tokenId)).to.equal(1);
    });

    it("ownerOf", async function () {
      const {token, alice} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      expect(await token.ownerOf(tokenId)).to.equal(alice.address);
    });

    it("parentOf", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const rootToken = await getCreatedTokenId(tx);
      expect(await token.parentOf(rootToken)).to.equal(0);
      tx = await token.connect(alice).safeTransferFrom(alice.address, bob.address, rootToken, partialAmount, "0x");
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      await expect(tx).to.be.emit(token, "TokenSpent").withArgs(rootToken, rootToken, partialAmount);
      await expect(tx).to.be.emit(token, "TokenCreated").withArgs(rootToken, tokenId, alice);
      expect(await token.parentOf(tokenId)).to.equal(rootToken);
    });

    it("rootOf", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const rootToken = await getCreatedTokenId(tx);
      expect(await token.rootOf(rootToken)).to.equal(rootToken);
      tx = await token.connect(alice).safeTransferFrom(alice.address, bob.address, rootToken, partialAmount, "0x");
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      await expect(tx).to.be.emit(token, "TokenSpent").withArgs(rootToken, rootToken, partialAmount);
      await expect(tx).to.be.emit(token, "TokenCreated").withArgs(rootToken, tokenId, alice);
      expect(await token.rootOf(tokenId)).to.equal(rootToken);
    });

    it("tokens", async function () {
      // @TODO
    });

    it("totalSupply", async function () {
      const {token, alice} = await deployTokenFixture();
      await token.mint(alice.address, amount);
      expect(await token["totalSupply()"]()).to.equal(amount);
    });

    it("safeTransferFrom", async function () {
      // mint(alice.address)
      // transfer(root) -> new token create -> id
      // transfer(root) -> new token create -> id2
      // levelOf(root).equal(0)
      // levelOf(id).equal(partialAmount)
      // levelOf(id2).equal(partialAmount)
      // totalSupply(root).equal(0)
      // totalSupply(id).equal(500)
      // totalSupply(id2).equal(500)
    });

    it("safeBatchTransferFrom", async function () {
      // mint(alice.address)
      // transfer(root) -> new token create -> id
      // levelOf(root).equal(0)
      // levelOf(id).equal(partialAmount)
      // totalSupply(root).equal(0)
      // totalSupply(id2).equal(1000)
    });
  });

  describe("Policies Enforcements Test", function () {
    it("Freeze Alice Account and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      await token.setAddressFrozen(alice.address, true);
      await expect(token.connect(alice).safeTransferFrom(alice.address, bob.address, tokenId, amount, "0x")).to.be
        .reverted;
    });

    it("Freeze Alice Balance and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      await token.freezePartialTokens(alice.address, amount);
      await expect(token.connect(alice).safeTransferFrom(alice.address, bob.address, tokenId, amount, "0x")).to.be
        .reverted;
    });

    it("Freeze Alice Token and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      await token.freezeToken(toBeHex(tokenId));
      await expect(token.connect(alice).safeTransferFrom(alice.address, bob.address, tokenId, amount, "0x")).to.be
        .reverted;
    });

    it("Freeze at root and safeTransferFrom", async function () {
      const {token, alice, bob} = await deployTokenFixture();
      let tx = await token.mint(alice.address, amount);
      tx = await tx.wait();
      const rootToken = await getCreatedTokenId(tx);
      expect(await token.rootOf(rootToken)).to.equal(rootToken);
      tx = await token.connect(alice).safeTransferFrom(alice.address, bob.address, rootToken, partialAmount, "0x");
      tx = await tx.wait();
      const tokenId1 = await getCreatedTokenId(tx);
      expect(await token.balanceOf(alice.address, rootToken)).to.equal(partialAmount);
      const amountDelta = partialAmount / 2n;
      tx = await token.connect(bob).safeTransferFrom(bob.address, alice.address, tokenId1, partialAmount / 2n, "0x");
      tx = await tx.wait();
      const tokenId2 = await getCreatedTokenId(tx);
      expect(await token.balanceOf(bob.address, tokenId1)).to.equal(amountDelta);
      await token.freezeToken(toBeHex(rootToken));
      expect(await token.isTokenFrozen(toBeHex(rootToken))).to.equal(true);
      expect(await token.isTokenFrozen(toBeHex(tokenId1))).to.equal(false);
      await expect(
        token.connect(alice).safeTransferFrom(alice.address, bob.address, rootToken, partialAmount, "0x"),
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
