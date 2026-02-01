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
    const erc8047 = await ethers.getContractFactory(CONTRACT_NAME.ERC8047);
    const contract = await erc8047.deploy(TOKEN_METADATA.URI);
    const rootTokenId = await mint(contract, alice.address, amount);

    return {contract, rootTokenId, owner, alice, bob, charlie, otherAccount};
  }

  afterEach(async function () {
    await hardhat_reset();
  });

  describe("ERC1155 Conformance Test", function () {
    it("setApprovalForAll", async function () {
      const {contract, owner, alice, bob} = await deployTokenFixture();
      const ownerAddress = owner.address;
      const rootTokenId = await mint(contract, alice.address, amount);
      expect(await contract.isApprovedForAll(alice.address, ownerAddress)).to.equal(false);
      expect(await contract.connect(alice).setApprovalForAll(ownerAddress, true))
        .to.emit(contract, "ApprovalForAll")
        .withArgs(alice.address, ownerAddress, true);
      await expect(contract.connect(alice).setApprovalForAll(ZeroAddress, true))
        .to.be.revertedWithCustomError(contract, "ERC1155InvalidOperator")
        .withArgs(ZeroAddress);
      expect(await contract.isApprovedForAll(alice.address, ownerAddress)).to.equal(true);
      let tx = await contract
        .connect(owner)
        .safeTransferFrom(alice.address, bob.address, rootTokenId, partialAmount, "0x");
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      expect(await contract.balanceOf(bob.address, tokenId)).to.equal(partialAmount);
    });

    it("uri", async function () {
      const {contract, alice} = await deployTokenFixture();
      const tokenId = await mint(contract, alice.address, amount);
      expect(await contract.uri(tokenId)).to.equal(TOKEN_METADATA.URI);
      // Note: In ERC-8047 using same URI for all token ids.
      expect(await contract.uri(0)).to.equal(TOKEN_METADATA.URI);
      const newURI = `${TOKEN_METADATA.URI}test`;
      await expect(contract.setURI(newURI)).to.be.emit(contract, "URI").withArgs(newURI, 0);
    });
  });

  describe("ERC-8047", function () {
    it("tracks DAG levels, roots, parents, ownership, and supply correctly", async function () {
      const {contract, rootTokenId, alice, bob} = await deployTokenFixture();
      // supportInterface test
      expect(await contract.supportsInterface(ERC165InterfaceId)).to.equal(true);
      expect(await contract.supportsInterface(ERC1155InterfaceId)).to.equal(true);
      expect(await contract.supportsInterface(ERC5615InterfaceId)).to.equal(true);
      expect(await contract.supportsInterface(ERC8047InterfaceId)).to.equal(true);
      // latestDAGLevelOf
      expect(await contract.latestDAGLevelOf(rootTokenId)).to.equal(0);
      // do some transfer to create new tokenId.
      let tx = await contract
        .connect(alice)
        .safeTransferFrom(alice.address, bob.address, rootTokenId, partialAmount, "0x");
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      // exist
      expect(await contract.exists(0)).to.equal(false);
      expect(await contract.exists(rootTokenId)).to.equal(true);
      expect(await contract.exists(tokenId)).to.equal(true);
      // latestDAGLevelOf test
      expect(await contract.latestDAGLevelOf(0)).to.equal(0);
      expect(await contract.latestDAGLevelOf(rootTokenId)).to.equal(1);
      expect(await contract.latestDAGLevelOf(tokenId)).to.equal(1);
      // levelOf test
      expect(await contract.levelOf(0)).to.equal(0);
      expect(await contract.levelOf(rootTokenId)).to.equal(0);
      expect(await contract.levelOf(tokenId)).to.equal(1);
      // balanceOf test
      expect(await contract.balanceOf(alice.address, rootTokenId)).to.equal(partialAmount);
      expect(await contract.balanceOf(alice.address, tokenId)).to.equal(0);
      expect(await contract.balanceOf(bob.address, tokenId)).to.equal(partialAmount);
      // balanceOfBatch test
      expect(await contract.balanceOfBatch([alice.address, bob.address], [rootTokenId, tokenId])).to.deep.equal([
        partialAmount,
        partialAmount,
      ]);
      expect(await contract.balanceOfBatch([alice.address, bob.address], [tokenId, tokenId])).to.deep.equal([
        0n,
        partialAmount,
      ]);
      expect(await contract.balanceOfBatch([alice.address, bob.address], [0, 0])).to.deep.equal([0n, 0n]);
      await expect(contract.balanceOfBatch([alice.address], [rootTokenId, tokenId]))
        .to.be.revertedWithCustomError(contract, "ERC1155InvalidArrayLength")
        .withArgs(2, 1);
      // rootOf test
      expect(await contract.rootOf(0)).to.equal(0);
      expect(await contract.rootOf(rootTokenId)).to.equal(rootTokenId);
      expect(await contract.rootOf(tokenId)).to.equal(rootTokenId);
      // parentOf test
      expect(await contract.parentOf(0)).to.equal(0);
      expect(await contract.parentOf(rootTokenId)).to.equal(0);
      expect(await contract.parentOf(tokenId)).to.equal(rootTokenId);
      // ownerOf test
      expect(await contract.ownerOf(0)).to.equal(ZeroAddress);
      expect(await contract.ownerOf(rootTokenId)).to.equal(alice.address);
      expect(await contract.ownerOf(tokenId)).to.equal(bob.address);
      // tokens test
      expect(await contract.tokens(0)).to.deep.equal([0n, 0n, 0n, 0n, ZeroAddress]);
      expect(await contract.tokens(rootTokenId)).to.deep.equal([rootTokenId, 0n, partialAmount, 0n, alice.address]);
      expect(await contract.tokens(tokenId)).to.deep.equal([rootTokenId, rootTokenId, partialAmount, 1n, bob.address]);
      // totalSupply test
      expect(await contract["totalSupply(uint256)"](0)).to.equal(0);
      expect(await contract["totalSupply(uint256)"](rootTokenId)).to.equal(partialAmount);
      expect(await contract["totalSupply(uint256)"](tokenId)).to.equal(partialAmount);
      expect(await contract["totalSupply()"]()).to.equal(amount);
    });

    it("mint", async function () {
      const {contract, alice} = await deployTokenFixture();
      await expect(contract.mint(ZeroAddress, amount))
        .to.be.revertedWithCustomError(contract, "TokenInvalidReceiver")
        .withArgs(ZeroAddress);
      await expect(contract.mint(alice.address, 0)).to.be.revertedWithCustomError(contract, "TokenZeroValue");
      let tx = await contract.mint(alice.address, amount);
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      expect(tx).to.be.emit(contract, "TokenCreated").withArgs(tokenId, tokenId, alice);
      expect(await contract.balanceOf(alice.address, tokenId)).to.equal(amount);
    });

    it("burn", async function () {
      const {contract, rootTokenId, alice} = await deployTokenFixture();
      const exceedAmount = amount * 2n;
      await expect(contract.burn(alice.address, rootTokenId, exceedAmount))
        .to.be.revertedWithCustomError(contract, "TokenInsufficient")
        .withArgs(amount, exceedAmount);
      await expect(contract.burn(ZeroAddress, rootTokenId, amount)).to.be.revertedWithCustomError(
        contract,
        "TokenUnauthorized",
      );
      // before burn
      expect(await contract.balanceOf(alice.address, rootTokenId)).to.equal(amount);
      expect(await contract.balanceOf(ZeroAddress, rootTokenId)).to.equal(0);
      expect(await contract["totalSupply(uint256)"](rootTokenId)).to.equal(amount);
      expect(await contract["totalSupply()"]()).to.equal(amount);
      let tx = await contract.connect(alice).burn(alice.address, rootTokenId, amount);
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      await expect(tx)
        .to.be.emit(contract, "TransferSingle")
        .withArgs(alice.address, alice.address, ZeroAddress, rootTokenId, amount);
      await expect(tx).to.be.emit(contract, "TokenSpent").withArgs(rootTokenId, tokenId, amount);
      // after burn
      expect(await contract.balanceOf(alice.address, rootTokenId)).to.equal(0);
      expect(await contract.balanceOf(ZeroAddress, rootTokenId)).to.equal(0);
      expect(await contract["totalSupply(uint256)"](rootTokenId)).to.equal(0);
      expect(await contract["totalSupply()"]()).to.equal(0);
    });

    it("safeTransferFrom", async function () {
      const {contract, rootTokenId, alice, bob} = await deployTokenFixture();
      let tx = await contract
        .connect(alice)
        .safeTransferFrom(alice.address, bob.address, rootTokenId, partialAmount, "0x");
      tx = await tx.wait();
      const tokenId = await getCreatedTokenId(tx);
      // ERC-8047 events
      await expect(tx).to.be.emit(contract, "TokenSpent").withArgs(rootTokenId, rootTokenId, partialAmount);
      await expect(tx).to.be.emit(contract, "TokenCreated").withArgs(rootTokenId, tokenId, alice);
      // ERC-1155 events
      await expect(tx)
        .to.be.emit(contract, "TransferSingle")
        .withArgs(alice.address, alice.address, ZeroAddress, rootTokenId, partialAmount);
      await expect(tx)
        .to.be.emit(contract, "TransferSingle")
        .withArgs(alice.address, ZeroAddress, bob.address, tokenId, partialAmount);
    });

    it("safeBatchTransferFrom", async function () {
      // @TODO
    });
  });

  describe("Policies Enforcements Test", function () {
    it("Freeze Alice Account and safeTransferFrom", async function () {
      const {contract, alice, bob} = await deployTokenFixture();
      const tokenId = await mint(contract, alice.address, amount);
      await contract.setAddressFrozen(alice.address, true);
      await expect(contract.connect(alice).safeTransferFrom(alice.address, bob.address, tokenId, amount, "0x")).to.be
        .reverted;
    });

    it("Freeze Alice Balance and safeTransferFrom", async function () {
      const {contract, alice, bob} = await deployTokenFixture();
      const tokenId = await mint(contract, alice.address, amount);
      await contract.freezePartialTokens(alice.address, amount);
      await expect(contract.connect(alice).safeTransferFrom(alice.address, bob.address, tokenId, amount, "0x")).to.be
        .reverted;
    });

    it("Freeze Alice Token and safeTransferFrom", async function () {
      const {contract, alice, bob} = await deployTokenFixture();
      const tokenId = await mint(contract, alice.address, amount);
      await contract.freezeToken(toBeHex(tokenId));
      await expect(contract.connect(alice).safeTransferFrom(alice.address, bob.address, tokenId, amount, "0x")).to.be
        .reverted;
    });

    it("Freeze at root and safeTransferFrom", async function () {
      const {contract, alice, bob} = await deployTokenFixture();
      const rootTokenId = await mint(contract, alice.address, amount);
      expect(await contract.rootOf(rootTokenId)).to.equal(rootTokenId);
      tx = await contract.connect(alice).safeTransferFrom(alice.address, bob.address, rootTokenId, partialAmount, "0x");
      tx = await tx.wait();
      const tokenId1 = await getCreatedTokenId(tx);
      expect(await contract.balanceOf(alice.address, rootTokenId)).to.equal(partialAmount);
      const amountDelta = partialAmount / 2n;
      tx = await contract.connect(bob).safeTransferFrom(bob.address, alice.address, tokenId1, partialAmount / 2n, "0x");
      tx = await tx.wait();
      const tokenId2 = await getCreatedTokenId(tx);
      expect(await contract.balanceOf(bob.address, tokenId1)).to.equal(amountDelta);
      await contract.freezeToken(toBeHex(rootTokenId));
      expect(await contract.isTokenFrozen(toBeHex(rootTokenId))).to.equal(true);
      expect(await contract.isTokenFrozen(toBeHex(tokenId1))).to.equal(false);
      await expect(
        contract.connect(alice).safeTransferFrom(alice.address, bob.address, rootTokenId, partialAmount, "0x"),
      ).to.be.revertedWithCustomError(contract, "TokenFrozen");
      // Note: parent of tokenId1 is frozen then transaction are expect to be reverted.
      await expect(
        contract.connect(bob).safeTransferFrom(bob.address, alice.address, tokenId1, amountDelta, "0x"),
      ).to.be.revertedWithCustomError(contract, "TokenFrozen");
      tx = await contract.connect(alice).safeTransferFrom(alice.address, bob.address, tokenId2, amountDelta, "0x");
      tx = await tx.wait();
      const tokenId3 = await getCreatedTokenId(tx);
      await expect(tx).not.to.be.reverted;
      expect(await contract.balanceOf(alice.address, tokenId2)).to.equal(0);
      expect(await contract.balanceOf(bob.address, tokenId3)).to.equal(amountDelta);
    });

    it("Freeze at level and safeTransferFrom", async function () {
      const {contract, alice, bob} = await deployTokenFixture();
      // mint token to alice
      // alice transfer to bob 100
      // freeze level partialAmount
      // alice transfer to charlie 100
      // bob transfer to charlie 100 (level partialAmount) expect reverted
    });
  });
});
