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
| BridgeMint | 22 tests in Kaspa's script engine, including attacks; every test transaction checked for relay standardness |
| kUSDT token family | The KCC20 template matches the standard byte for byte; the checked-in artifact matches the source |
| KasPool | 23 tests in Kaspa's script engine, including theft attempts through a Position and through the admin path, the circuit breaker and the pause |
| KusdtVault | 102 Hardhat tests, including randomized invariant runs and non-standard tokens; reviewed line by line by the project owner against the specification |
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

## External review (5 November 2026)

An outside reviewer sent twelve questions and findings. Each is answered below; the code changes are in the
mainnet release candidates since commit `1e3f969` (the current one is `mainnet-v0.9.8-rc.7`). This is still not an audit.

| # | Finding | Response |
|---|---|---|
| 1 | 3 of 5 signers can release USDT without a burn, up to 250 000 per vault at once | True, and the largest risk in v1. Bounded by each vault's release allowance (at most 500 000 per vault in any 24 hours). The monitor alarms on a release with no burn at once and pauses. Signers can now keep their keys in an HSM or KMS ([Operations](/developers/operations/#signer-keys-in-an-hsm-or-kms)). The zero-knowledge upgrade covers deposits only; releases stay federated until the EVM side can verify Kaspa ([Known limits](/security/known-limits/#the-bridge-is-federated)) |
| 2 | The vault owner is de facto control, and nobody can cancel a bad proposal | The owner is now an OpenZeppelin AccessManager whose admin is the Safe: 48-hour delays, cancellers who can cancel any queued change, and a monitor that alarms the moment a change is queued and can cancel it ([Governance](/security/governance/)) |
| 3 | Three signer sets can drift apart | A rotation runbook with tools (`rotate-plan`, `govern-sign`, `govern-submit`) and a local rehearsal; the monitor accepts only announced sets ([Rotating a signer](/developers/operations/#rotating-a-signer)) |
| 4 | The testnet runs all signers on one host | True; mainnet needs five independent operators, each with its own node and RPCs. The mainnet packages are built for that, and five operators are lined up |
| 5 | A burn is final after about 100 seconds, before a payout of up to 250 000 | Larger burns now wait longer: 10 minutes above 10 000 kUSDT, an hour above 100 000 ([Finality](/protocol/finality/#larger-burns-wait-longer)) |
| 6 | Forged kUSDT can be dumped into other pools | True; kUSDT transfers cannot be paused. The monitor now serves a fixed-shape signal for integrators, `GET /api/v1/signal` ([The monitor](/security/monitor/#the-integrators-signal)) |
| 7 | One monitor, one guardian; recovery takes 48 hours | Two monitors may share the guardian key (it can only pause). The vault's `setGuardian` and `unpause` now wait about 6 hours, not 48 ([A stolen guardian key](/developers/operations/#a-stolen-guardian-key)) |
| 8 | No audit; the source is not public | No auditor is booked yet. The repository stays private: auditors and operators get access to it, and the covenants' compiled artifacts and the deployment record let anyone check the pinned covenant IDs against what is on-chain ([Verify the template](/developers/verify-template/)) |
| 9 | One token, two vaults | Rebalancing through the bridge's own paths ([Rebalancing the vaults](/developers/operations/#rebalancing-the-vaults)) |
| 10 | Small redemptions lose KAS and can be lost entirely | True of hand-built transactions; the wallet and the web app refuse a burn at or below the fee and warn above 20 % |
| 11 | Round trips can use up the pool's sell room | Fixed: the circuit breaker counts the net flow ([KasPool](/contracts/kaspool/#why-it-counts-the-net-flow)) |
| 12 | A burn to a blacklisted address is held indefinitely | Intended, decided on 4 November 2026: a redirect power would be a new theft path and would help a blocked party evade the block. The legal review should confirm it |

## Outside source review of the services (5 November 2026)

A second outside review read the off-chain services and filed three findings. None touches the covenants or the vault. All three were confirmed in the code and fixed the same day, in commit `4a037d0`:

| # | Finding | Fix |
|---|---|---|
| 1 | The RPCs had to agree on only some fields of a deposit, not its `sender`, which a refund pays | Every field of a deposit, and of every release and refund, must agree across a service's RPCs |
| 2 | Redemption reports were first-writer-wins and unverified: a wrong first report could strand someone's burn | Claims are checked against the coordinator's node, which decides; a client's transaction can no longer edit the token index ([Reporting a burn](/protocol/coordinator-api/#reporting-a-burn)) |
| 3 | The monitor failed open: one unreadable RPC stopped the whole check, the pause included | Each chain is checked on its own, INV-1 is never judged on partial backing, and a chain unreadable for 10 minutes pauses everything ([The monitor](/security/monitor/#when-it-cannot-read-a-chain)) |

Checking finding 1 turned up the same gap in the releases and refunds the monitor reads (only their amounts were compared); it is fixed with it.

## Third outside review (6 November 2026)

A third review read the code at commit `a0ab050`. Each finding was checked against the code. Four are fixed in commit `57af0de`; one is accepted as a documented limit. This is still not an audit.

| # | Severity as reported | Finding | Response |
|---|---|---|---|
| 1 | High | `set_signers` (4 of 5) replaces the signer set and the minter's guardian together, so the quorum the pause polices can remove it | Accepted by the project owner: the covenant does not change. The same 4 keys can already unpause and raise the limits, so this adds little to what 4 keys can do. It needs 4 of 5 keys, and the vaults' and the pool's guardians are not theirs to change ([Four or five signer keys](/security/threat-model/#four-or-five-signer-keys)) |
| 2 | High | After a reorg that flipped a skip and a mint, a signer's follower kept a minter state that no longer existed, and signed a refund from its old skip record: the depositor would keep the kUSDT and get the USDT back | Fixed: the follower undoes the moves the dropped blocks accepted, and a refund needs the minter it follows to be unspent on its own node |
| 3 | Medium | The owner's events, the queued operations and the vault's signers came from one RPC, so a lying RPC could hide an owner action | Fixed: every RPC must agree. Checking it found that one RPC saying "already paused" could also stop the pause: that now takes every RPC, and a pause or a cancel goes through each RPC in turn |
| 4 | Medium | `POST /redeems` kept every unproved claim for good, with a node lookup each pass | Fixed: claims nobody has proved are capped, get a bounded share of each pass and expire. Checking it found they also counted as pending burns in the public supply: they no longer do |
| 5 | Medium | The JSON parser rewrote text inside strings, and rounded a large integer standing alone | Fixed: it reads JSON's own structure. The two low findings in the same code (a marker a string could collide with, a comparison that showed a secret's length) are fixed with it |

## Fourth outside review (7 November 2026)

Each finding was checked against the code, and all five are fixed, in commit `a7ded23` on `main`. The current release candidate, `mainnet-v0.9.8-rc.7`, predates them. This is still not an audit.

| # | Severity as reported | Finding | Fix |
|---|---|---|---|
| 1 | High | The deploy's confirmation and its AccessManager rule read a plan's `target`, while its Kaspa network and its RPCs decide where it goes | The word and the rule now follow the network, and a plan whose name and network disagree is refused. Checking it found a wider path: rehearsals use chain IDs 1 and 56 on purpose, so a rehearsal plan pointed at real RPCs passed the chain ID check. A rehearsal now runs on local RPCs only |
| 2 | Medium | The JSON parser still rounded integers written with a fraction or an exponent | Every integer stays exact in any notation, and one too large for any amount stays text, which BigInt refuses. It remains this project's own parser, tested against `JSON.parse` on random documents, rather than a new dependency in the wallet and the web app |
| 3 | Medium | The committed bytecode couldn't be reproduced offline: the compiler was named at two commits, the reference sources weren't in the repository, and nothing recorded what built it | One compiler commit, the reference's `.ag` files checked in unchanged, a record of what built the bytecode, and a CI job that recompiles and compares ([Build and test](/developers/build-and-test/)). The bytecode itself did not change |
| 4 | Low | `requestJson` still used the `@@bigint` marker a string could collide with | It writes BigInt values directly, with no marker |
| 5 | Low | WalletConnect's connect could wait for ever once the QR code showed | Every stage has a limit, 5 minutes with the code up, and the visitor can stop waiting from the wallet menu |

## Are the Ethereum and BNB Chain vaults safe?

As far as testing can show, and not audited yet.

**Tested.**

- 102 vault tests: replay, signature order and malleability, reentrancy, fee-on-transfer tokens, backing never
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
  contract (an AccessManager whose admin is the Safe).

See the [attack vectors](/security/threat-model/#attack-vectors) for the whole bridge and the pool.

## What the audits must cover

The [mainnet checklist](/security/mainnet-checklist/) requires external audits of:

- `BridgeMint` and `KasPool`, including the SilverScript the Argent compiler generates from them;
- the vault.

## Reporting a vulnerability

The security contact and disclosure process are **to be published**.
