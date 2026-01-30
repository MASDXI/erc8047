const {loadFixture} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const {expect} = require("chai");
const {solidityPackedKeccak256, getBytes} = require("ethers");
const {amount, freezeAmount, transferFrom, transfer, tokenMetadata} = require("../../utils/constant");

describe("UTXO", function () {
  async function deployTokenFixture() {
    const [owner, alice, bob, charlie, otherAccount] = await ethers.getSigners();
    const contract = await ethers.getContractFactory("MockUTXO");
    const token = await contract.deploy(tokenMetadata.name, tokenMetadata.symbol);

    return {token, owner, alice, bob, charlie, otherAccount};
  }

  describe("Policies Enforcements Test", function () {
    it("transfer Alice to Bob", async function () {
      const {token, alice, bob} = await loadFixture(deployTokenFixture);
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      let tx = await token.mint(aliceAddress, amount);
      tx = await tx.wait();
      const tokenId = tx.logs[0].args[0];
      const hashed = solidityPackedKeccak256(["bytes32"], [tokenId]);
      const signature = await alice.signMessage(getBytes(hashed));
      expect(await token.balanceOf(aliceAddress)).to.equal(amount);
      await token.connect(alice)[transfer.utxo](bobAddress, tokenId, amount, signature);
      expect(await token.balanceOf(aliceAddress)).to.equal(0);
      expect(await token.balanceOf(bobAddress)).to.equal(amount);
    });

    it("transferFrom Alice to Bob", async function () {
      const {token, owner, alice, bob} = await loadFixture(deployTokenFixture);
      const spenderAddress = owner.address;
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      let tx = await token.mint(aliceAddress, amount);
      tx = await tx.wait();
      const tokenId = tx.logs[0].args[0];
      const hashed = solidityPackedKeccak256(["bytes32"], [tokenId]);
      const signature = await alice.signMessage(getBytes(hashed));
      await token.connect(alice).approve(spenderAddress, amount);
      expect(await token.balanceOf(aliceAddress)).to.equal(amount);
      await token.connect(owner)[transferFrom.utxo](aliceAddress, bobAddress, tokenId, amount, signature);
      expect(await token.balanceOf(aliceAddress)).to.equal(0);
      expect(await token.balanceOf(bobAddress)).to.equal(amount);
    });

    it("Freeze Alice Account and transferFrom", async function () {
      const {token, owner, alice, bob} = await loadFixture(deployTokenFixture);
      const spenderAddress = owner.address;
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      let tx = await token.mint(aliceAddress, amount);
      tx = await tx.wait();
      // TODO Freeze the account
    });

    it("Freeze Alice Balance and transfer", async function () {
      const {token, owner, alice, bob} = await loadFixture(deployTokenFixture);
      const spenderAddress = owner.address;
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      let tx = await token.mint(aliceAddress, amount);
      tx = await tx.wait();
      // TODO Freeze the balance
    });

    it("Freeze Alice Balance and transferFrom", async function () {
      const {token, owner, alice, bob} = await loadFixture(deployTokenFixture);
      const spenderAddress = owner.address;
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      let tx = await token.mint(aliceAddress, amount);
      tx = await tx.wait();
      // TODO Freeze the balance
    });

    it("Freeze Alice Token and transfer", async function () {
      const {token, owner, alice, bob} = await loadFixture(deployTokenFixture);
      const spenderAddress = owner.address;
      const aliceAddress = alice.address;
      const bobAddress = bob.address;
      let tx = await token.mint(aliceAddress, amount);
      tx = await tx.wait();
      //  TODO Freeze the transaction
    });
  });

  // describe("Restrict", function () {
  //   it("Should restrict transfer the funds to the other account by frozen tokenId", async function () {
  //     const {token, owner, otherAccount} = await loadFixture(deployTokenFixture);
  //     const address = await owner.getAddress();
  //     const otherAddress = await otherAccount.getAddress();
  //     let tx = await token.mint(address, 1000n);
  //     tx = await tx.wait();
  //     let tokenId = tx.logs[0].args[0];
  //     let hashed = solidityPackedKeccak256(["bytes32"], [tokenId]);
  //     let signature = await owner.signMessage(getBytes(hashed));
  //     tx = await token["transfer(address,bytes32,uint256,bytes)"](otherAddress, tokenId, 100n, signature);
  //     tx = await tx.wait();
  //     tokenId = tx.logs[1].args[0];
  //     hashed = solidityPackedKeccak256(["bytes32"], [tokenId]);
  //     signature = await otherAccount.signMessage(getBytes(hashed));
  //     expect(await token.balanceOf(otherAddress)).to.equal(100n);
  //     await token.freezeToken(tokenId);
  //     await expect(
  //       token.connect(otherAccount)["transfer(address,bytes32,uint256,bytes)"](address, tokenId, 10n, signature),
  //     ).to.be.revertedWithCustomError(token, "TokenFrozen");
  //   });
  // });
});
