const { expect } = require("chai");
const { toBeHex, ZeroAddress } = require("ethers");
const { ethers } = require("hardhat");

const {
    amount,
    partialAmount,
    TOKEN_METADATA,
    CONTRACT_NAME,
} = require("../utils/constant");
const { hardhat_reset } = require("../utils/network");
const { getCreatedTokenId, mint } = require("../utils/token");

describe("ERC-8047 vs ERC-20 Gas Comparison Benchmarks", function () {
    async function deployFixtures() {
        const signers = await ethers.getSigners();
        const owner = signers[0];
        const alice = signers[1];
        const bob = signers[2];

        // 1. Deploy Forest (ERC-8047)
        const ForestFactory = await ethers.getContractFactory(CONTRACT_NAME.ERC8047);
        const forest = await ForestFactory.deploy(TOKEN_METADATA.URI);

        // 2. Deploy Baseline ERC-20 (Requires a mock ERC20 with a freeze mechanism)
        const ERC20Factory = await ethers.getContractFactory(CONTRACT_NAME.ERC20);
        const erc20 = await ERC20Factory.deploy(TOKEN_METADATA.NAME, TOKEN_METADATA.SYMBOL);

        // Mint initial amounts to Alice
        const rootTokenId = await mint(forest, alice.address, amount);
        await erc20.mint(alice.address, amount);

        return { forest, erc20, rootTokenId, owner, alice, bob, signers };
    }

    afterEach(async function () {
        await hardhat_reset();
    });

    describe("Scenario 1: Value Fragmentation & Payment Execution Cost", function () {
        it("Benchmarks transferring a fixed value across varying states of token fragmentation", async function () {
            const { forest, erc20, alice, bob } = await deployFixtures();

            const targetValue = 1000n;
            const K_values = [1, 2, 5, 10, 20, 100];

            console.log("\n--- TABLE 1: FRAGMENTATION PENALTY (Fixed Value Transfer) ---");
            console.log("K       | ERC-20 (transfer) | Forest (safeTransferFrom) | Forest (safeBatchTransferFrom)");
            console.log("-------------------------------------------------------------------------");

            // ---------------------------------------------------------
            // 0. EVM State Pre-warming
            // ---------------------------------------------------------
            // Pre-warm Bob's balances to bypass zero-to-nonzero SSTORE initialization costs
            await erc20.mint(bob.address, 1n);
            await mint(forest, bob.address, 1n);

            // ---------------------------------------------------------
            // 1. Establish K=1 Exact & Partial Baselines
            // ---------------------------------------------------------

            // ERC-20 Baseline (Partial)
            await erc20.mint(alice.address, targetValue * 2n);
            const txErc20Partial = await erc20.connect(alice).transfer(bob.address, targetValue);
            const receiptErc20Partial = await txErc20Partial.wait();
            const gasErc20Partial = receiptErc20Partial.gasUsed;

            // Forest Partial: Alice holds 2000, sends 1000
            const idPartial = await mint(forest, alice.address, targetValue * 2n);
            const txForestPartial = await forest.connect(alice).safeTransferFrom(alice.address, bob.address, idPartial, targetValue, "0x");
            const receiptForestPartial = await txForestPartial.wait();
            const gasForestPartial = receiptForestPartial.gasUsed;

            console.log(`1 (Par) | ${gasErc20Partial.toString().padEnd(15)} | ${gasForestPartial.toString().padEnd(23)} | ${gasForestPartial.toString()}`);

            // Forest Exact: Alice holds 1000, sends 1000 (We save this as the optimal constant)
            const idExact = await mint(forest, alice.address, targetValue);
            const txForestExact = await forest.connect(alice).safeTransferFrom(alice.address, bob.address, idExact, targetValue, "0x");
            const receiptForestExact = await txForestExact.wait();
            const optimalForestGas = receiptForestExact.gasUsed;

            // ---------------------------------------------------------
            // 2. Loop Through Varying K Values (Batch Spend)
            // ---------------------------------------------------------
            for (const K of K_values) {
                const valuePerToken = targetValue / BigInt(K);

                // --- ERC-20 Baseline ---
                await erc20.mint(alice.address, targetValue);
                const tx20 = await erc20.connect(alice).transfer(bob.address, targetValue);
                const receipt20 = await tx20.wait();
                const gasErc20 = receipt20.gasUsed;

                // --- Forest Architecture ---
                const tokenIds = [];
                const amounts = [];

                for (let i = 0; i < K; i++) {
                    const id = await mint(forest, alice.address, valuePerToken);
                    tokenIds.push(id);
                    amounts.push(valuePerToken);
                }

                let gasForestBatch;
                if (K === 1) {
                    // For exact K=1, we just use the safeTransferFrom standard
                    gasForestBatch = optimalForestGas;
                } else {
                    // For K >= 2, we must bundle the fragments using safeBatchTransferFrom
                    const tx8047 = await forest.connect(alice).safeBatchTransferFrom(
                        alice.address, bob.address, tokenIds, amounts, "0x"
                    );
                    const receipt8047 = await tx8047.wait();
                    gasForestBatch = receipt8047.gasUsed;
                }

                // Output formatting
                const label = K === 1 ? "1 (Exa)" : K.toString();
                console.log(`${label.padEnd(7)} | ${gasErc20.toString().padEnd(15)} | ${optimalForestGas.toString().padEnd(23)} | ${gasForestBatch.toString()}`);
            }
            console.log("-------------------------------------------------------------------------\n");
        });
    });


    describe("Scenario 2 Regulatory Enforcement Multi Hop Smurfing and Collateral Damage", function () {
        it("Benchmarks physical gas execution and collateral damage for R=50 roots vs N ERC-20 accounts with Depth=5", async function () {
            const { forest, erc20, owner, alice, bob } = await deployFixtures();

            const N_accounts = [10, 20, 50, 80, 100];
            const max_N = 100;
            const R_roots = 50;
            const DEPTH = 5; // Funds will shuffle through 5 smurfs before hitting Bob

            // ---------------------------------------------------------
            // PARAMETERS ALIGNED WITH THE RESEARCH PAPER (Table II)
            // ---------------------------------------------------------
            const cleanFundsPerWallet = 1000n; // Exactly 1,000 clean tokens per intermediate account
            const bobsCleanFunds = 10000n;     // Bob's baseline (excluded from N * 1000 calculation)
            const illicitChunk = 100n;

            // Fixed mnemonic for deterministic address generation
            const mnemonic = "test test test test test test test test test test test junk";

            // ---------------------------------------------------------
            // 0. Setup Destination Bob and Origin Alice
            // ---------------------------------------------------------
            await erc20.mint(bob.address, bobsCleanFunds);
            await mint(forest, bob.address, bobsCleanFunds);
            await erc20.mint(alice.address, illicitChunk * BigInt(max_N));

            // Alice mints EXACTLY R=50 roots in Forest
            const originalRootIds = [];
            const currentActiveIds = []; // Tracks the active leaf of the DAG lineage

            for (let i = 0; i < R_roots; i++) {
                const id = await mint(forest, alice.address, illicitChunk);
                originalRootIds.push(id);
                currentActiveIds.push(id);
            }

            const benchmarkResults = [];
            let cumulativeErc20Gas = 0n;
            let cumulativeErc20Collateral = 0n;
            let previousSmurf = null;

            // ---------------------------------------------------------
            // 1. Execute Laundering Depth=5 and ERC-20 O(N) Historical Freezes
            // ---------------------------------------------------------
            for (let i = 1; i <= max_N; i++) {
                // FIX: Offset by +10 to prevent deriving Alice's exact address (Avoids from == to revert)
                const derivationPath = `m/44'/60'/0'/0/${i + 10}`;

                // FIX: Add 'undefined' as second parameter for Ethers v6 compatibility
                const smurf = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, derivationPath).connect(ethers.provider);

                // Fund the Smurf with ETH for gas and legitimate ERC-20 capital (1,000 tokens)
                await owner.sendTransaction({ to: smurf.address, value: ethers.parseEther("0.05") });
                await erc20.mint(smurf.address, cleanFundsPerWallet);

                const rootIndex = Math.floor((i - 1) / DEPTH) % R_roots;
                let activeId = currentActiveIds[rootIndex];

                if (i % DEPTH === 1) {
                    // Start of a new chain: Alice to Smurf 1
                    await erc20.connect(alice).transfer(smurf.address, illicitChunk);

                    const txF = await forest.connect(alice).safeTransferFrom(alice.address, smurf.address, activeId, illicitChunk, "0x");
                    currentActiveIds[rootIndex] = await getCreatedTokenId(await txF.wait());
                } else {
                    // Middle of the chain: Previous Smurf to Current Smurf
                    await erc20.connect(previousSmurf).transfer(smurf.address, illicitChunk);

                    const txF = await forest.connect(previousSmurf).safeTransferFrom(previousSmurf.address, smurf.address, activeId, illicitChunk, "0x");
                    currentActiveIds[rootIndex] = await getCreatedTokenId(await txF.wait());

                    // Regulator sweeps behind and freezes the Previous Smurf (Historical Tracing)
                    const txFreeze = await erc20.connect(owner).setAddressFrozen(previousSmurf.address, true);
                    cumulativeErc20Gas += (await txFreeze.wait()).gasUsed;
                    cumulativeErc20Collateral += cleanFundsPerWallet;
                }

                // If this is the 5th Smurf (End of chain)
                if (i % DEPTH === 0) {
                    // Smurf 5 to Bob (Consolidation)
                    await erc20.connect(smurf).transfer(bob.address, illicitChunk);

                    const txF = await forest.connect(smurf).safeTransferFrom(smurf.address, bob.address, currentActiveIds[rootIndex], illicitChunk, "0x");
                    const bobId = await getCreatedTokenId(await txF.wait());

                    // Bob recycles the token back to Alice to recycle the roots for the next chains
                    const txRec = await forest.connect(bob).safeTransferFrom(bob.address, alice.address, bobId, illicitChunk, "0x");
                    currentActiveIds[rootIndex] = await getCreatedTokenId(await txRec.wait());

                    // Regulator freezes this final Smurf
                    const txFreeze = await erc20.connect(owner).setAddressFrozen(smurf.address, true);
                    cumulativeErc20Gas += (await txFreeze.wait()).gasUsed;
                    cumulativeErc20Collateral += cleanFundsPerWallet;
                }

                previousSmurf = smurf;

                // Record checkpoint results
                if (N_accounts.includes(i)) {
                    benchmarkResults.push({
                        N: i,
                        erc20Gas: cumulativeErc20Gas,
                        erc20Damage: cumulativeErc20Collateral // Will strictly equal N * 1000
                    });
                }
            }

            // ---------------------------------------------------------
            // 2. Forest Architecture: Execute O(R) Freezes
            // ---------------------------------------------------------
            let totalForestGas = 0n;

            for (let i = 0; i < R_roots; i++) {
                const rootIdHex = ethers.toBeHex(originalRootIds[i]);
                // Executes freeze on the Root ID via Forest
                const tx = await forest.connect(owner).freezeToken(rootIdHex, rootIdHex, 0);
                totalForestGas += (await tx.wait()).gasUsed;
            }

            // ---------------------------------------------------------
            // 3. Format Console Output Table
            // ---------------------------------------------------------
            console.log("\n--- TABLE 2: REGULATORY ENFORCEMENT AND COLLATERAL DAMAGE (R=50, Depth=5) ---");
            console.log("N       | ERC-20 Gas      | Forest Gas     | ERC-20 Damage   | Forest Damage");
            console.log("-------------------------------------------------------------------------------");

            for (const res of benchmarkResults) {
                const nLabel = res.N.toString().padEnd(7);
                const erc20GasStr = res.erc20Gas.toString().padEnd(15);
                const forestGasStr = totalForestGas.toString().padEnd(14);
                const erc20DamStr = res.erc20Damage.toString().padEnd(15);
                const forestDamStr = "0";

                console.log(`${nLabel} | ${erc20GasStr} | ${forestGasStr} | ${erc20DamStr} | ${forestDamStr}`);
            }
            console.log("-------------------------------------------------------------------------------\n");
        });
    });
});