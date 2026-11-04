---
title: Audit status
description: kUSDT has not been audited. What exists instead, and what the audits must cover.
---

:::danger[Not audited]
**No part of kUSDT has been audited.** Not the Kaspa covenants, not the vault, not the transaction builders. Do
not use kUSDT with funds you cannot afford to lose.
:::

## What exists today

| Part | Evidence |
|---|---|
| BridgeMint | 21 tests in Kaspa's script engine, including attacks; every test transaction checked for relay standardness |
| kUSDT token family | The KCC20 template matches the standard byte for byte; the checked-in artifact matches the source |
| KasPool | 20 tests in Kaspa's script engine, including theft attempts through a Position and through the admin path, the circuit breaker and the pause |
| KusdtVault | 85 Hardhat tests, including randomized invariant runs and non-standard tokens; reviewed line by line by the project owner against the specification |
| End to end (Kaspa) | Every Kaspa-side transaction, bridge and pool, accepted by a kaspad v2.1.0 simnet node |
| End to end (whole bridge) | `local:e2e` with a forged-mint attack caught by the monitor and its dump into the pool capped by the circuit breaker; `local:load` with concurrent deposits, unpayable burns, a refund, a burn and a refund held for a blocked address and paid once unblocked, and a blocked vault paused |
| Mainnet forks | `fork:rehearsal`: the vault against the real USDT and BSC-USD, including USDT's blacklist and BSC-USD's lack of one |

Tests show that the code does what its authors intended in the cases they thought of. They are not an audit.

## Internal security review (4 November 2026)

An internal review of the money paths, made by the project's own tooling, not an external audit. It found the
vault, the signers' checks and the covenants sound, and found problems in the off-chain followers and services,
all fixed:

| Severity | Finding | Fix |
|---|---|---|
| High | Followers adopted decoy outputs: plain outputs paying to a successor's script | Successors come only from the input's covenant-bound authorized outputs; a new `minter-lost` alarm. Regression tests in `decoys.test.ts`, `decoy_outputs.rs` and `local:load` |
| High | One unpayable burn could block every release | Per-burn backoff and the `unpayable` status |
| Medium | A stray pool-owned payer bricked the pool follower | Fixed in the pool follower |
| Medium | No refund path existed | `/sign/refund` on each signer, which follows the minter itself, and a coordinator refund loop |
| Low | Monitor RPC-error handling; the signer bearer token; health on Kaspa lag | Errors handled; the bearer is mandatory and compared in constant time; `/health` answers 503 while Kaspa lags |

**Since decided:** a recipient blocked by USDT is never paid. Wallets ask before a burn, signers refuse, and a burn
that lands anyway is held until the address is unblocked. See [Blocked recipients](/security/known-limits/#blocked-recipients).

## Are the Ethereum and BNB Chain vaults safe?

As far as testing can show, and not audited yet.

**Tested.**

- 85 vault tests: replay, signature order and malleability, reentrancy, fee-on-transfer tokens, backing never
  overdrawn, and the rate limits.
- Fork rehearsals on the real USDT and BSC-USD, including the blacklist checks.
- The internal security review found the vault sound.

**By design.**

- Backing leaves only through a release or a refund signed by 3 of 5, within the release allowance.
- The owner cannot take backing, only accrued fees. The guardian can only pause.
- No proxy and no upgrade key, so nobody can swap the code. The flip side: a bug cannot be patched. It means a
  new vault, and migrating through redemptions.

**Not yet.**

- No external audit.
- On testnet the owner is the deployer's plain key. On mainnet the deploy script refuses any owner that is not a
  contract (the Safe behind the timelock).

See the [attack vectors](/security/threat-model/#attack-vectors) for the whole bridge and the pool.

## What the audits must cover

The [mainnet checklist](/security/mainnet-checklist/) requires external audits of:

- `BridgeMint` and `KasPool`, including the SilverScript the Argent compiler generates from them;
- the vault.

## Reporting a vulnerability

The security contact and disclosure process are **to be published**.
