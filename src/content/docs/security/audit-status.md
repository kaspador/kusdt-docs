---
title: Audit status
description: kUSDT has not been audited. What exists instead, and what the audits must cover.
---

:::danger[Not audited]
**No part of kUSDT has been audited.** Not the Kaspa covenants, not the vault, not the transaction builders. Do
not use kUSDT with funds you cannot afford to lose.
:::

The code that holds users' money, and the wallet, are public to read and rebuild:
[github.com/kaspador/kusdt-open](https://github.com/kaspador/kusdt-open).

## What exists today

| Part | Evidence |
|---|---|
| BridgeMint | Tests in Kaspa's script engine, including attacks; every test transaction checked for relay standardness (175 Rust tests in all, with the pool's and the builders') |
| kUSDT token family | The KCC20 template matches the standard byte for byte; the checked-in artifact matches the source |
| KasPool | Tests in Kaspa's script engine, including theft attempts through a Position and through the admin path, the circuit breaker and the pause |
| KusdtVault | 209 Hardhat tests, including randomized invariant runs and non-standard tokens; reviewed line by line by the project owner against the specification |
| Services, deployer, clients | Unit tests: services 672 (one of them an expected failure), deployer and test tools 118, protocol 57, Kaspa client 60, web app 249, wallet 227 |
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
mainnet release candidates since commit `1e3f969` (the current one is `mainnet-v0.9.8-rc.25`). This is still not an audit.

| # | Finding | Response |
|---|---|---|
| 1 | 3 of 5 signers can release USDT without a burn, up to 250 000 per vault at once | True, and the largest risk in v1. Bounded by each vault's release allowance (under 750 000 per vault in any 24 hours, see [Limits](/protocol/limits/#most-that-can-move-in-a-window)). The monitor alarms on a release with no burn at once and pauses. Signers can now keep their keys in an HSM or KMS ([Operations](/developers/operations/#signer-keys-in-an-hsm-or-kms)), which stops a key being copied, not a signer host someone took over from having any mint, governance action, release or refund signed: the HSM is given only a 32-byte digest (run 21, R21-CRYPTO-6), and checking what it signs would need the message's fields. The zero-knowledge upgrade covers deposits only; releases stay federated until the EVM side can verify Kaspa ([Known limits](/security/known-limits/#the-bridge-is-federated)) |
| 2 | The vault owner is de facto control, and nobody can cancel a bad proposal | The owner is now an OpenZeppelin AccessManager whose admin is the Safe: 48-hour delays, cancellers who can cancel any queued vault change (and, since rc.16, the Safe's power-adding changes to the manager itself), and a monitor that alarms the moment a change is queued and can cancel it ([Governance](/security/governance/)) |
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

Each finding was checked against the code, and all five are fixed, in commit `a7ded23` on `main`, and in the release candidates since `mainnet-v0.9.8-rc.8`. This is still not an audit.

| # | Severity as reported | Finding | Fix |
|---|---|---|---|
| 1 | High | The deploy's confirmation and its AccessManager rule read a plan's `target`, while its Kaspa network and its RPCs decide where it goes | The word and the rule now follow the network, and a plan whose name and network disagree is refused. Checking it found a wider path: rehearsals use chain IDs 1 and 56 on purpose, so a rehearsal plan pointed at real RPCs passed the chain ID check. A rehearsal now runs on local RPCs only |
| 2 | Medium | The JSON parser still rounded integers written with a fraction or an exponent | Every integer stays exact in any notation, and one too large for any amount stays text, which BigInt refuses. It remains this project's own parser, tested against `JSON.parse` on random documents, rather than a new dependency in the wallet and the web app |
| 3 | Medium | The committed bytecode couldn't be reproduced offline: the compiler was named at two commits, the reference sources weren't in the repository, and nothing recorded what built it | One compiler commit, the reference's `.ag` files checked in unchanged, a record of what built the bytecode, and a CI job that recompiles and compares ([Build and test](/developers/build-and-test/)). The bytecode itself did not change |
| 4 | Low | `requestJson` still used the `@@bigint` marker a string could collide with | It writes BigInt values directly, with no marker |
| 5 | Low | WalletConnect's connect could wait for ever once the QR code showed | Every stage has a limit, 5 minutes with the code up, and the visitor can stop waiting from the wallet menu |

## Mint retries (7 November 2026)

An outside reviewer reported that a failed mint could leave the signers and the coordinator on different batches
for good, and the public testnet stopped minting the same day for that reason. It touches neither the covenants nor
the vault, and is fixed in commit `e8e8d71`, in the release candidates since `mainnet-v0.9.8-rc.9`.

| Severity | Finding | Fix |
|---|---|---|
| High (liveness) | A signer signs one batch per starting nonce and refuses any other. If the first request timed out after the signers had recorded it, and another deposit arrived, every retry asked for a larger batch and was refused, and that chain's failure kept the other chain from minting | The coordinator saves the batch before it asks and asks for exactly it until the minter moves past it. If the signers say they signed another one, it tries the shorter lengths, which is all two batches at one nonce can differ in. Each chain gets its own turn, and a mint request waits 120 seconds for the signers |

On the testnet, three BNB testnet deposits went final within ten seconds, and the first request (one deposit) took
the signers 35 to 95 seconds over a slow RPC. The fix recovered it without touching the signers' records. The same
incident showed a second limit: a signer or monitor that restarts reads every deposit again from the vault's first
block, so its RPCs must keep logs that far back. Some free RPCs keep only a few days.

**Since `mainnet-v0.9.8-rc.10`:**
- **Limits that fit together.** Checking the launch values against the signers' agreed daily limit (25 000 kUSDT)
  showed that a deposit or a burn larger than a signer's limit, or a batch of deposits adding up to more, would
  be accepted by the vaults and then never signed. The deployer now refuses vault limits that don't fit the
  signers' ([Limits](/protocol/limits/#at-the-mainnet-launch)), and the coordinator splits a batch that every
  signer finds over its limit.
- **Restarts read only new blocks.** Each signer and monitor keeps the deposits it read, so a restart no longer
  needs RPCs with the whole history.
- **A mint the monitor can't check fails closed:** after `failClosedMs` it is the `unverifiable` alarm, and
  everything pauses, as for a chain it can't read.

An internal review of these changes found a way the batch split could stall a chain, and a way the saved deposits
could be written mid-scan. Both are fixed in the candidate. It is not an outside review.

## Fifth review (8 November 2026)

Eight findings, each checked against the code. All were real, and all are fixed in `mainnet-v0.9.8-rc.11`. The first changes
the vault contract, and no outside review has seen that change. This is still not an audit.

| # | Severity as reported | Finding | Fix |
|---|---|---|---|
| 1 | P1 | The allowance is drawn when a payout is queued, and nothing capped the queue: payouts left waiting for days could all be paid in one block | The queue holds at most one allowance ([Limits](/protocol/limits/#how-an-allowance-works)) |
| 2 | P1 | A signer's record and charge changed in memory before the save. After a failed save, a retry found the record and signed with nothing on disk, and a restart forgot both | Recorded, charged and on disk, or none of it. Saves now reach the disk before the signature is given |
| 3 | P1 | A follower more than 100 000 DAA behind threw away what it had just fetched, and stalled for good | What it holds ages by its own position, not the network's |
| 4 | P1 | During a Kaspa catch-up, a queued payout whose status could not be read raised nothing, so the pause could be missed | It counts as still queued, and fails closed |
| 5 | P2 | A transaction's payload named the recipient, unchecked against what the burn commits to. A wrong one became final, could never be paid, and a correct report came too late | A recipient or chain the burn doesn't commit to is not recorded. Checking it found that a burn naming a chain the bridge doesn't have could block every other redemption: also fixed |
| 6 | P2 | One malformed signature threw away the whole round, so one bad signer could stop the bridge | It costs only that signer, and each signer counts once |
| 7 | P2 | Unused fields a client sent in a token state were stored, past the limits on claims | Only the state's own fields are kept, each checked. Checking it found that another spelling of a burn's outpoint (an uppercase id, or an index past 2³²) could hold a real burn as invalid: an outpoint now has one spelling |
| 8 | P2 | An empty bearer file turned off a signer's login check | An empty token refuses to start |

## Attack testing (8 November 2026)

After the fifth review, each part of the system was attacked in turn, and every claimed bug had to be proven by a failing test: the vault, the Kaspa covenants, the signer, the coordinator, the monitor, and the wallet, web app and deployer. The real services were also run as separate processes and killed outright at bad moments, with RPCs that stalled, failed and lied. This is **internal** testing: it is not an audit and no outside party has checked it. All of it is in `mainnet-v0.9.8-rc.12`. **The covenants, the vault and the services all changed, and no outside review has seen those changes.**

**The most serious findings, all fixed:**

| Severity | Finding | Fix |
|---|---|---|
| High | A Kaspa transaction id does not cover its signature scripts, so a miner could publish a rewritten body. A real governance transaction rewritten as a skip could make a signer sign a refund of a deposit that was minted | A follower accepts a body only if its program hashes to the spent script and its signatures verify against the held signer set |
| High | The pool's circuit breaker read a clock with no lower bound, so idle windows could be stacked into one dump. A first redesign could still be drained by repeated buys and sells | The clock is now the age of the pool's UTXO, which consensus proves. The reference rises only with that age, and used room is never forgiven |
| High | One crafted Kaspa transaction could make the coordinator and the monitor lose the rest of a scanned batch | A bad state decodes to nothing, and each transaction is handled on its own |
| High | One frozen or hung RPC could leave the monitor blind while it reported healthy, or delay the pause past the payout wait | A frozen head and sustained Kaspa lag fail closed, every RPC call has a hard deadline, and pauses run at the same time and are replaced if stuck |
| High | A deposit a lagging RPC had not indexed was skipped for good and stalled its chain | The coordinator reads a tail again, needs its RPCs to agree, and checks for gaps in the deposit nonces |
| High | `verify --plan` never compared the signers with the reviewed plan | It compares them on the deployment, the minter and both vaults |
| Medium | Three keys could void a signed governance action through `set_value` | `set_value` needs 4 of 5 |

**Since then (9 and 10 November 2026):** three more rounds, the last over the whole codebase by threat. No critical finding. 15 high: 13 are fixed, and 2 are open and listed under [Known limits](/security/known-limits/) (one party can use up the signers' daily limit, since addressed for deposits by a fee that rises with use, see [Round 10](#round-10-10-november-2026) and after; USDT sent straight to a vault is lost). The fixes of the last round were themselves attacked before the release candidate, three times for the wallet, and what that found is fixed. Two rounds in a row with no critical or high finding, the rule before mainnet, have not been reached.

Smaller fixes: a watcher could garble a pending governance transaction; one chain's RPC outage stopped the other's work; burns could be given up on; funding coins could leak; the wallet accepted a mistyped address and trusted the coordinator for the fee; the vault's allowance now counts the whole amount.

**What held up:** random-sequence testing of the vault found no bug in it. Under real kills, every deposit was minted exactly once, every burn was paid once, and the books agreed to the unit. Three stolen keys queueing a payout while the monitor was down were stopped when it came back inside the wait.

**What is still open.** The final design of the pool's circuit breaker passed its tests and a randomized test through the real script engine, but the last independent attempt to break it did not complete, so it has had no independent adversarial review. It should have a human review before the pool holds real value. A deep reorg of more than 20 DAA does not roll back the coordinator's view of the pool or positions; that surfaces as an alarm and fails closed. Attackers working from the code can miss things: this testing lowers the risk, it does not end it.

## Round 10 (10 November 2026)

A tenth internal round, over the whole codebase by threat, on `mainnet-v0.9.8-rc.15`. Eight reviewers were set to
it and seven ran. **The one for the covenants did not run, so the covenants were not reviewed in this round.** It is
internal testing, not an audit.

No critical finding. Three areas had no high finding either: the vault's owner and the launch (8 low), double
minting and replay (3 low), and forged minting (1 medium, 2 low). The six high findings were in the services (3),
the monitor's judging of payouts (1), the coordinator's payout queue (1) and the web app (1). All six are fixed,
each with tests:

| # | Where | Finding | Fix |
|---|---|---|---|
| 1 | Monitor | Any kUSDT output owned by a script hash was recorded as a possible burn, for good. Someone moving a few units through their own script could grow the monitor's state, for network fees alone, until it could no longer be saved and the monitor died in every round | A record lasts only while its output is unspent. A real burn can never be spent, so real burns are kept |
| 2 | Monitor and services | One RPC answer, small on the wire and huge once unpacked, ended the process. A monitor that died in every round started with fresh clocks each time, so it never failed closed: nothing was judged or paused | RPC answers are asked for uncompressed, refused if compressed, and cut off at 16 MB. A monitor that starts three times over 5 minutes without finishing a round pauses everything and raises `crash-loop` ([The monitor](/security/monitor/#a-monitor-that-keeps-dying)) |
| 3 | Coordinator API | Request bodies that were opened and never finished could hold more memory than the coordinator has, so it was killed and restarted for as long as the sender liked | Bodies are limited in size, in number and per client, and must arrive within 10 seconds |
| 4 | Monitor | With three stolen signer keys: a refund of a deposit that Kaspa never skipped could stay unjudged until it was paid, if one of the monitor's Kaspa rounds failed every two minutes (one RPC naming a block time ahead of the others was enough to fail a round) | A failed round no longer restarts the refund's grace; such a refund is judged in the second up-to-date round; any queued payout still unjudged at two thirds of its wait fails closed |
| 5 | Coordinator | Burns that could never be paid (empty ones, borrowable states moved again and again, dust below the fee) were recorded and took their turn ahead of real burns. A few a second were enough to hold payouts back | Only plain burns above zero are recorded, and burns below the fee are set aside all at once |
| 6 | Web app | A WalletConnect session written into the page's storage could come to count as the visitor's own wallet, and the bridge-back form then filled in its address as theirs | A stored session never counts as your own address. Only a wallet that approved the connection during this visit does; otherwise you connect again or type the address |

**Still open from this round:** the coordinator keeps every record and its kUSDT index in memory, and the monitor
keeps real burns for good. Both can be grown on purpose, at a real cost in KAS, until the service stops. It is a
stall, with no funds at risk, and it is to be fixed before mainnet
([Known limits](/security/known-limits/#the-coordinator-keeps-everything-in-memory)).

**Two rounds in a row with no critical or high finding, the rule before mainnet, have not been reached.** This round
found six high, so the count starts again. Its fixes, the changed vault, the changed minter and the new pool
covenant have had no round of their own, and no outside review has seen them.

## An operator's review of rc.15 (10 November 2026)

One of the bridge's operators reviewed `mainnet-v0.9.8-rc.15` with tests of their own. It is a review from outside
the team that writes the code, not an audit.

**Its verdict: not ready for mainnet yet.** In the contracts it found no way to steal money, to mint kUSDT without
three signers, to mint twice for one deposit, to be paid twice for one burn, or to take USDT out of a vault without
three signers or the vault's owner. **It did not test the signer, the coordinator and the monitor programs, nor the
wallet and the site**, and it names the three services as its largest gap.

It listed ten things to fix or decide before mainnet, A to J. This is what was done about each:

| | Point | What was done |
|---|---|---|
| A | The pool's first deposit asks for no signature, so anyone holding a little kUSDT could open the pool with dust and keep its sell brake almost shut | Fixed in the new pool covenant: the first deposit, and a deposit into an emptied pool, need the pool admin's signature |
| B | The Safe is the whole owner: whoever controls it could empty a vault about 48 hours after their first move, and neither a canceller nor a pause stopped that. One lost key on the Safe that needs all its owners would lock that vault's owner for good | Partly. The cancellers can now cancel the Safe's power-adding calls, so a stolen Safe needs 48 hours from the cancellers' last cancel, and 96 only while they cancel every try until they are removed ([Governance](/security/governance/#kusdtvault-evm-the-owner); the first wording, "about 96 hours", was corrected in round 12). Since round 11 they can also cancel the removal of the Safe's own roles, so a pause that outlasts the Safe's keys takes as long. The pause itself does not: a holder of the Safe's keys pauses at once and cancels every unpause while it holds them. The Ethereum Safe goes from 3 of 3 to 2 of 3, as on BNB Chain (the owner's decision of 13 November; Daybreak [1]), and that change is the transaction that proves every key works: all three current owners approve `changeThreshold(2)`, Safe transaction hash `0xfec31923ea32d148c976a441da800e12b1bf5d2864ed748643872960675be3fa` at nonce 0, two signing it in the Safe app and the third executing it from their own account. Still open, both on the launch list: that transaction (until it is executed, the Ethereum Safe needs all three owners, and one lost key would lock that vault's owner for good), and writing down who holds each Safe key |
| C | Launch day: while a vault is launched, the launching key alone has full power over it for a short time. The review planted six kinds of back door in that window, and each worked afterwards | Each of the six is now planted in a test, and the launch check (`mainnet:verify`) fails on it. Still to do on launch day: someone other than the deployer reads both chains before any money goes in (launch list) |
| D | Cancelling a bad payout did not kill it: anyone could queue it again with the same three signatures until the signers were replaced, and the runbook gave "cancel" alone as the remedy | Fixed in the vault: a cancelled payout stays cancelled until the owner reinstates it ([KusdtVault](/contracts/kusdt-vault/#cancelled-payouts)). The runbook lines are corrected |
| E | The wording "25 000 USDT of releases per vault per day" is not a hard daily cap: after a quiet time about twice that left a vault in 24 hours in the review's test | The wording is corrected on the [Limits](/protocol/limits/#at-the-mainnet-launch) page and on the launch list. The numbers are unchanged |
| F | A team action on the minter can be sent again with a smaller age. Delay only: built-up mint allowance is thrown away | Fixed in the minter: the signers of a team action now sign the age it claims, as a mint's signers do, so a copy with another age fails the signature check. The cost is that a signed age is also a wait when a mint lands first, so the signing tools show the age, sign a rotation, a recovery proposal and a veto for age 0 (which never waits), and take `--age 0` for any other action. What remains is under [Known limits](/security/known-limits/#a-governance-action-credits-the-mint-allowance-only-up-to-the-age-its-signers-signed) |
| G | Four of the five signers could set limits so large that the minter stopped for good | Fixed in the minter: `set_limits` refuses values above the lifetime cap |
| H | Anyone could keep the pool's sell brake shut. Sells are delayed, no money is lost | Addressed in the new pool covenant: the least claim while more than half of the cap is in use, the public `tick`, and the keeper. What is left is under [Known limits](/security/known-limits/#pool-transactions-wait-a-few-seconds-while-more-than-half-of-the-cap-is-in-use) |
| I | One party can use up the daily mint limit, and every later deposit then waits | Partly. The deposit fee now rises with the day's deposits ([Fees](/protocol/fees/#the-rising-deposit-fee)). The bridge-back direction still costs only the flat fee. Showing users the queue before they deposit, which the review also asked for, is not built yet |
| J | A vault on the USDT issuer's block list still takes deposits while nothing can leave it. Only a pause stops them | Unchanged. The monitor raises `vault-blocked` and pauses. Still to do: make sure that alarm reaches a person (launch list) |

The fixes in rows A, B, D, G and H change the vault, its owner setup and both covenants. **No outside review has
seen those changes**, and the review above was of rc.15, before them.

**Not run on these changes yet:** the local end-to-end run, the failure scenarios and the browser tests. The unit
suites ran.

## Round 11 (11 November 2026)

An eleventh internal round, over the whole codebase by threat, on `mainnet-v0.9.8-rc.16`. Eight reviewers ran, the
one for the covenants among them this time, and each finding of medium or higher was checked by a second reviewer.
It is internal testing, not an audit.

No critical finding, and no way found to take funds. **Seven high findings, all of them stalls**, and twelve medium.
They are fixed in `mainnet-v0.9.8-rc.17`, each with tests, except where the table says what is left:

| # | Where | Finding | Fix |
|---|---|---|---|
| 1 | Services (all followers) | A miner with a small share of the hashrate could make a follower lose the one copy of a pool or minter transaction that proves the move. The monitor then paused everything, and the other services stayed on a spent state until an operator rebuilt them | The scanner remembers what it dropped and reads the block again before it hands the move out. Every follower reads the block a second time before it gives a move up |
| 2 | Monitor, signers, coordinator | Coins sent in bulk to the address of the minter, the pool or a waiting burn made that address unreadable on the node. The monitor paused everything after 5 minutes, or the burn could not be paid | The monitor no longer counts an unreadable address as a failure. Signers and the coordinator take a burn from the accepted transactions they followed. [What is left](/security/known-limits/#an-address-that-holds-too-many-coins-cannot-be-listed) |
| 3 | Pool and minter on Kaspa | A transaction that ordinary nodes keep and no block can take could hold the pool's or the minter's coin in their mempools for up to 24 hours, a pause included | The services, the wallet and the web app recognise such a transaction and never build behind it; the services outbid it or send through extra nodes the operators set. It is a rule of the node, so it is not closed: [what is left](/security/known-limits/#a-spend-of-the-pool-or-the-minter-that-no-block-can-take) |
| 4 | Coordinator API | One public read could be made dear enough, by filling an address with coins, to keep the coordinator from its own work | Such reads are shared, kept and held to a budget of time |
| 5 | Monitor | Its public status had no limit of any kind and was built again for every request, on the process that judges and pauses | Each answer is built once a second, lists are bounded, and requests are counted per client |
| 6 | Coordinator and monitor | Both asked their node for its whole mempool. A large mempool ended the process, the monitor's before its pause was built | They ask only for the address they follow, and the monitor sends its pause before it asks anything. Long answers are refused before they are in memory |
| 7 | Web app | An action went on asking the wallet with the old form's values after its page was left, so a deposit could be asked for an address no longer on screen | An action stops when its page is left, and the site says where it stopped |

The medium findings fixed in the same release include: a `tick` of a pool that was never opened (a **new pool
covenant**, its second in two days), a signer that could be asked to sign a mint the minter had already passed, a
false alarm after the owner cancelled a refund, one failed node read that counted as "no burn", and a pool
transaction the wallet reported as done before the node had accepted it.

**Not closed, and listed under Known limits:** the parked transaction of row 3; a burn at a filled address needs
three signers that read its block; a flood from very many addresses at once still reaches the monitor's process;
the wallet uses the same keys on test networks and on mainnet.

**Not covered by this round or its fixes:** the node behaviour behind rows 1, 2, 3 and 6 was read in the Kaspa
node's source and reproduced in unit tests, not on a network. No real flood was sent at any service. The new pool
covenant and the changed access manager have had no outside review.

**Two rounds in a row with no critical or high finding, the rule before mainnet, have not been reached.** This round
found seven high, so the count starts again.

## Round 12 (11 November 2026)

A twelfth internal round, over the whole codebase by threat, on `mainnet-v0.9.8-rc.17`. Eight reviewers ran, and
each finding of medium or higher was checked by a second reviewer. It is internal testing, not an audit.

No critical finding, and no way found to take funds, to mint without a deposit or to pay without a burn. **Two high
findings, both stalls, and both inside the fixes of round 11.** Six medium. They are fixed in `mainnet-v0.9.8-rc.18`,
each with tests:

| # | Where | Finding | Fix |
|---|---|---|---|
| 1 | Services (the check of mempool transactions added in rc.17) | For every locked input of a waiting pool transaction the check read a whole address that the transaction named, with no bound, inside the coordinator's main loop. One transaction that is never mined, with thousands of inputs, slowed mints and payouts to a crawl while the health check stayed green | The check reads no address a judged transaction names. It looks at four locked inputs at most, has one deadline, and the coordinator's loop does not wait for it |
| 2 | Coordinator API | `GET /pool` read the pool's own address on every request, in the line the mint and payout loops' reads wait in. With the pool's address filled with coins, one request a second stopped the follower, and with it mints and payouts | The route reads no address: the pool's age comes from the follower's state. What the API asks the node has connections of its own |

The medium findings: an outsider could stock burns at one filled address and pause everything at will on a monitor
rebuilt from a checkpoint (a rebuilt monitor is now given the list of unpaid burns); coins sent to the genesis
minter's or pool's address made the launch verification fail for good; the verification passed a launch record with
a wrong age for the minter, after which no mint could be mined; a list request with ever new sender names filled
the coordinator's memory; one kUSDT output at a filled address took all of a holder's kUSDT out of the wallet; and
the wallet and the web app took the coordinator's word on whether a vault can pay a burn now, which the vault itself
answers.

**Not covered:** as in round 11, the node behaviour these fixes rest on was read in the Kaspa node's source and
reproduced in unit tests, not on a network.

**Two rounds in a row with no critical or high finding, the rule before mainnet, have not been reached.** This round
found two high, so the count starts again. Its fixes have had no round of their own.

## Round 13 (11 November 2026)

A thirteenth internal round, over the whole codebase by threat, on `mainnet-v0.9.8-rc.18`. Eight reviewers ran, and
each finding of medium or higher was checked by a second reviewer. It is internal testing, not an audit.

No critical finding, and no way found to take funds, to mint without a deposit or to pay without a burn. The
payouts area found nothing at all. **One high finding, a stall**, and four medium. They are fixed in
`mainnet-v0.9.8-rc.19`, each with tests:

| # | Where | Finding | Fix |
|---|---|---|---|
| 1 | Monitor | Once the monitor doubted its own record of the guardian's coins, every Kaspa pause asked for the guardian's whole address. An outsider who had filled that public address, and moved the pool so a pause was refused, blocked every Kaspa pause of the minter and the pool on every monitor. The vaults' pauses still worked | A pause is paid from the coins the monitor keeps when the address cannot be read; a refusal caused by a moved pool or minter coin no longer puts the guardian's coins in doubt |

The medium findings: an outsider could replace the coordinator's mint with a copy and then evict the copy, and the
coordinator waited two minutes before sending it again (it now sends at once); a slow read of the funding address
could bring back a coin the coordinator had already spent; anyone holding the launch plan could fill the genesis
minter's address so that the launch script never finished (it now proves its outputs without listing the address);
and above what the coordinator can read in one answer, one filled address hid all of a holder's kUSDT in a fresh
wallet (the coordinator now answers the rest, and lists what it cannot check apart).

**Also in rc.19:** the coordinator's public API and the monitor's public status each run as a process of their own,
answering from files the money processes write. A flood of requests can take the public answers down, but no longer
reaches the processes that mint, pay and pause ([Known limits](/security/known-limits/)). This is new code with no
review round of its own yet.

**An outside tool:** the Kaspa red-team tool (kasperolabs, v0.17.2), run locally on the five covenants and on seven
real testnet transactions, found nothing. It could not build a spend of the minter or the pool on its own, so it
tested them only through the real transactions; signed paths and the minter's governance were not tested by it.

**Two rounds in a row with no critical or high finding, the rule before mainnet, have not been reached.** This round
found one high, so the count starts again.

## Rounds 14 and 15 (11 November 2026)

Two more internal rounds, both over the whole codebase by threat, both on `mainnet-v0.9.8-rc.19`. Nine reviewers ran
in each, one of them on the new public processes and their deployment, and each finding of medium or higher was
checked by a second reviewer. Round 15 was told what round 14 had found and asked for what it missed. It is internal
testing, not an audit.

**Round 14** found no critical or high finding, and no way to take funds, to mint without a deposit or to pay
without a burn. It found four medium findings, all stalls: waiting transactions that pay an address could make the
services' look at that address fail, so the pool keeper stopped and the coordinator's mint check failed; one page
could hold up the wallet's answers to every other site; a backward step of the server's clock made the public status
look fresh while it was frozen; and a log answer too large for the services' own size cap was never asked again in
smaller pieces, so the deposit scan failed at that range for good. It also found 17 low findings.

**Round 15** found no critical finding and no way to take funds, but **one high finding, a stall**, and five medium:

| # | Where | Finding | Fix |
|---|---|---|---|
| 1 | Coordinator | The pool's liquidity positions were kept with no bound in the coordinator's state file, written whole at every save. Hundreds of thousands of dust positions, each costing an outsider about 0.2 KAS and recoverable, ran the coordinator out of memory during a save, so it stopped minting and paying and failed again at every start | The positions live in a file of their own, at most 50,000 of them; past that, positions with the fewest shares are left out of the list (they still belong to their holders and can be redeemed) and new dust is turned away at no cost. Measured with 300,000 dust positions under the mainnet memory limit: the slowest save took 42 ms |

The medium findings: after a burst of deposits the services kept asking each RPC for a few blocks at a time for good,
so later deposit reads became slow enough to stall mints (each read now starts at the full range again); a
coordinator rebuilt from an empty state asked for a refund of every past deposit and could hold real refunds back for
hours (it now learns from its starting point which deposits were minted); outputs that are not burns could push a
waiting burn out of every service's list of burns (real burns are now kept first); the wallet used the lowest base
fee any of its RPCs named, so one wrong RPC could make every deposit too cheap to be included (it now uses the
highest, and says when its RPCs disagree); and the coordinator's public freshness was its own timer, so a coordinator
whose Kaspa node had stopped still looked healthy (freshness now comes from when it last read each chain). It also
found 20 low findings.

Every finding of both rounds is fixed in `mainnet-v0.9.8-rc.20`, each with tests, except a few parts written as
known limits ([Known limits](/security/known-limits/)). No contract or covenant changed: the vaults and the five
covenants are the same as in rc.19.

The failure tests of rc.20 itself found one more, a stall: when the monitor's RPC stopped at an old block, the monitor
took a deposit it could not see yet for a missing one and paused everything for an honest mint. It now calls a deposit
missing only when the vault had taken that deposit's number by the block its RPCs serve, and fails closed if a mint
stays past that count. Round 16 found that this left a forged mint on a clock that other rounds started over, and
kept honest mints behind a lagging RPC on it too: since then every open mint has a fail-closed clock of its own, from
when the monitor saw it ([Monitor](/security/monitor/#each-mint-has-its-own-clock)).

**Two rounds in a row with no critical or high finding, the rule before mainnet, have not been reached.** Round 14
was the first round without one; round 15 found one, so the count starts again with the next round, on rc.20.

## Round 16 (12 November 2026)

An internal round over the whole codebase by threat, on `mainnet-v0.9.8-rc.20`. Ten reviewers ran: nine by risk
area, and one that read every change made since rc.19, hunk by hunk. Each finding of medium or higher was checked by
a second reviewer. It is internal testing, not an audit.

It found no critical finding and no way for an outsider to take funds. It found **four high findings, two defects**,
both in the monitor, the guardian that pauses everything when it sees a mint or a payout that nothing backs. Both
are about a forged mint, which needs three of the five signer keys; the monitor is the line behind the signers:

| # | Where | Finding | Fix |
|---|---|---|---|
| 1 | Monitor | Found three times. One RPC that kept changing its answer about an old deposit made the monitor read that chain's deposit history again, each time from the start. Mints waiting for that read were on no failure clock, so a forged mint could go unjudged, with no alarm, for as long as the RPC kept it up | Every open mint has a fail-closed clock of its own, from when the monitor saw it. While a history is read, mints are checked by their own deposit number. An RPC that changes its answer counts as failing: once a day it may make the monitor read its history again, and after that it is distrusted for a day |
| 2 | Monitor | rc.20's own fix (the deposit count) left a forged mint of a number nobody deposited on the mints step's shared clock. Any round that ran out of time with other mints started that clock over, so a pile of slow mints kept the forged one from its alarm | The same clock of its own, which no other mint's check and no step's success moves |

Four medium findings: the shared clock could also pause everything for honest mints behind an RPC 20 to 30 seconds
behind (fixed by the same clock); the monitor's depth rule by total, from round 15, could be stricter than the
signers after a relayer outage, a payout signed again or a lowered payout delay, so it called an honest payout early
and paused everything (two findings; it now brackets when each payout was first signed and never counts more than
the signers do); and one frozen RPC of the coordinator stalled mints on its chain while its health stayed green (the
health now names the chain, or the RPC, that stopped moving). It also found 24 low findings.

**Changed on purpose:** a forged mint of a number nobody deposited now pauses everything when its own clock runs out
(`failClosedMs`, 5 minutes by default), where rc.20 paused it after about two and a half minutes. That is still well
inside the 10 minute payout wait ([Monitor](/security/monitor/#each-mint-has-its-own-clock)).

Every finding is fixed in `mainnet-v0.9.8-rc.21`, each with tests, except a few parts written as known limits
([Known limits](/security/known-limits/)). No contract or covenant changed: the vaults and the five covenants are the
same as in rc.19.

**The rule before mainnet, and a change to it.** The rule is two rounds in a row with no critical or high finding.
On 12 November 2026 the owner changed how a high finding counts: one that needs three or more of the five signer
keys stolen (or their holders colluding) is still fixed before launch, but it no longer starts the count again. A
critical finding still does, whatever it needs, and so does a high one that works with fewer keys. By that rule
round 16 is the first round in a row; all four of its high findings needed three signer keys. **Two rounds in a row
have not been reached.** Round 17 runs on rc.22, the next candidate, which also changes the covenants: an outside
review of rc.19 showed that the remedy for a pool or minter spend that no block can take does not work ([Known
limits](/security/known-limits/#a-spend-of-the-pool-or-the-minter-that-no-block-can-take)).

## An outside review of rc.19, and rc.22 (12 November 2026)

An outside reviewer ran rc.19 on real Kaspa nodes (kaspad 2.1.0, the version mainnet uses), with real reorgs,
floods of nearly a million requests, crash storms on every service, and a second node that builds blocks. It is an
outside test of the running system, not a code audit. What held: crash storms, the Kaspa node killed and restarted,
the floods, filled addresses, copied mints, real reorgs, two monitors on one key, mixed versions, the upgrade, the
launch rehearsal, the wallet and the web app in a real browser.

It found **one high finding by the owner's bar, a stall that anyone can cause**: a spend of the pool's coin that a
node accepts and no block takes, held in the nodes for hours for the cost of one ordinary fee, so that nobody could
trade and the pool's pause on Kaspa could not land (the vaults' pauses still worked, and nothing could be taken). The
same should work on the minter's coin. It was known since round 11, with a remedy (extra Kaspa nodes that build
blocks) that rested on reading the node's source; the reviewer ran it, and it does not work. **Fixed in
`mainnet-v0.9.8-rc.22` by a change to the pool's and the minter's covenants:** every `Pool` and minter entry now checks every input of
its transaction (a position's `transfer` does not, by design: it is the owner's own, claims no age and never spends
the pool's coin), so a pool or minter spend that a node accepts is one a block can take ([Known
limits](/security/known-limits/#a-spend-of-the-pool-or-the-minter-that-no-block-can-take)). The covenants' code was
written by the reviewer to a design the team approved, checked against the node's source, and tested in the
covenant engine, and the compiled covenants were rebuilt byte for byte from it. What it costs: at most 8 inputs in a
pool or minter transaction, funding only from plain single-key coins, and pool fees about a quarter higher. The pool
and the minter have new covenant IDs, so the public testnet starts again with a new kUSDT and a new pool.

It also found that the health checks stayed "OK" while three signers were cut off from their Kaspa node, and three
low findings. The health checks of the coordinator had already been fixed in rc.20 and rc.21; a signer's own
`/health` and the coordinator's naming of signers that hold payouts up are new in rc.22, with a clearer message for a
wrong claims setting and fewer fee coins dropped by the monitor after a refused pause. rc.22's own failure tests found
one more, low: the new health text quoted a signer's error, which could name its Kaspa node's address on a public
page. Fixed before the tag.

rc.22 also adds the [Terms of Service](/reference/terms/), which the web app and the wallet ask users to accept.

**Since then:** the reviewer ran their two-node scenario on the rc.22 tag with two kaspad 2.1.0 nodes on a private
network. The node refused the parked spend in all three cases, and the pool's pause landed (20 of 20 checks).

## Round 17, and a second outside review (12 November 2026)

**Round 17**, an internal round over the whole codebase by threat on `mainnet-v0.9.8-rc.22`, ten reviewers, found no
critical, high or medium finding: 19 low findings, three of which need three stolen signer keys. All 19 are fixed in
`mainnet-v0.9.8-rc.23`, each with tests. By the owner's rule (a high finding that needs three or more signer keys does
not start the count again), round 16 and round 17 are **two rounds in a row with no critical or high finding**, the
rule set before mainnet. It is internal testing, not an audit.

**A second outside review of rc.22** (the same reviewer, five reviewers by area, each finding with a test they ran)
found no critical finding and no way for an outsider to take funds. It found one medium finding: a burst of thousands
of small forged payouts, which needs three stolen signer keys, could hold the monitor's pause back past the payout
wait, because every alarm saved the whole state before the pause was sent. It also found eleven low findings
(including, on their own testnet, the monitor's pauses on Kaspa landing late while its node could not follow
Kaspa) and five of note. These are open in rc.23 and fixed in the next candidate, rc.24, which also raises the
mainnet launch limits to 50 000 a day. Round 18 runs on rc.24 as a confirmation round.

## The second outside review's deep round, and rc.24 (13 November 2026)

The same reviewer then ran a **deep round** on rc.22, re-checked on rc.23: nine reviewers, each following one threat
through the whole codebase, with executed tests, and a red-team tool that judged 80 246 hostile transactions in Kaspa's
own consensus engine. It found **no critical and no high finding**, and no way to take money without backing, to get
past a covenant check, to mint or pay twice through a reorg, or to skip a governance delay.

It found two medium findings:

- a Kaspa node too slow to answer one large read stopped every service from following the chain for good, and the
  monitors then paused the bridge;
- a minter address filled with many small coins kept the signers' governance tool from submitting anything, the veto
  of a recovery included.

It also found 29 low findings and 18 of note. One low finding is accepted by the owner with no covenant change: after a
governance action that lowers the minter's own deposit, whoever submits it first keeps the freed KAS (at most the
operators' own deposit, never user money).

**`mainnet-v0.9.8-rc.24`** fixes both mediums and every other finding of the review, each with tests that fail on the
code before it. Among them:

- the services read a slow node block by block, checked against a real node (the same results, through reorgs and
  restarts);
- governance proves the minter's coin from the blocks the operator's own node accepted;
- the monitor's pause stays fast under a burst of thousands of forged payouts, and its state stays small;
- vault pauses use a bounded fee, and a vault pause that does not land is raised and sent again.

It also carries an owner decision: **an outage of a monitor's own machine no longer pauses the bridge by itself.** A
monitor back from an outage, or with its whole network gone, says on `/health` that it is not guarding while it
catches up, and the other monitor and the payout wait cover that time. A node that stops making progress still fails
closed. While it catches up it pauses at once only on what it can already see: since run 21 (R21-MON2-1) a release,
judged from its node's UTXO set as soon as that node is at the network's tip (rc.24 judged none until its own reading
had caught up, so a forged release queued as it came back could be paid); what the vaults show (owner calls nobody
announced, other signers) as soon as it reads them; a forged mint, a refund with no skip and governance nobody
announced only once its own reading of Kaspa has reached them. Since run 21's decision 12 (the owner's) a queued
payout still unjudged at two thirds of its wait pauses while catching up too, and a mint read late has its graces
from when the chain accepted it. See
[The monitor](/security/monitor/#when-its-own-machine-is-away-or-offline) and
[Known limits](/security/known-limits/#a-monitor-whose-own-network-is-cut).

Round 18 runs on rc.24. This is internal and outside testing, not an independent audit.

## The owner's decisions on the 21st review (14 November 2026)

The 21st review left sixteen choices for the team: a new contract, a rule change, or a choice about money and risk.
On 14 November 2026 the owner took the reviewers' advice on each. Changed for the next release candidate:

- each vault's deposit fee meter is a quarter of the signers' daily limit, 12 500 USDT at the launch, instead of half:
  deposits spread over the day no longer keep the whole limit in use at the plain fee
  ([Fees](/protocol/fees/#the-rising-deposit-fee));
- the Kaspa mint allowance at genesis is twice the signers' daily limit, 100 000 kUSDT, instead of 500 000
  ([Limits](/protocol/limits/#at-the-mainnet-launch));
- the web app's WalletConnect library now uses a zod without the 11 high advisories;
- the Ethereum Safe goes to 2 of 3, as on BNB Chain (on the launch list);
- a monitor that is catching up after an outage pauses for a queued payout it still cannot judge at two thirds of
  its wait, and a mint it reads late is timed from when the chain accepted it;
- every service restarts by itself when it hangs, and the Kaspa nodes and Caddy have health checks;
- a signer that refuses a payout because its daily limit is full now proves it with a signed list of its charges,
  so two lying signers can no longer hold every payout for a day.

Accepted for the launch, each with what is planned later, on
[Known limits](/security/known-limits/#accepted-for-the-launch): one shared daily limit, a recipient blocked after
its payout was queued, both vaults backing kUSDT together, cancelling a flood of forged payouts 50 at a time, mint
signatures that don't fix the KAS amounts, the pool's rules, the testnet signers' shared connection, one wallet for
testnet and mainnet with the API process on the coordinator's node, and a catching-up monitor that cannot pause the
minter or the pool.

## Round 18, the 21st review, and rc.25 (14 November 2026)

**Round 18**, our internal round over the whole codebase on `mainnet-v0.9.8-rc.24` (eleven reviewers, one of them on
the monitor alone), found no critical and no high finding: one medium (one RPC that answered logs but failed its
other reads kept a monitor catching up, and off guard, for up to hours) and 31 low. Rounds 16, 17 and 18 are three
rounds in a row with no critical or high finding.

**The 21st review**, by the outside team, of rc.24 with OpenAI Daybreak's report checked, found no way to take
money: one high that needs three stolen signer keys, five medium, and about 60 low or of note. Every finding that
code could settle is fixed in their pull requests, and the owner decided the rest (above).

**`mainnet-v0.9.8-rc.25`** carries both: every round 18 finding fixed (where the outside team had fixed the same thing,
one fix kept), every 21st-review fix, and the owner's decisions. Its whole test gate passed, including 361 checks of
real processes under faults. This is internal and outside testing, not an independent audit.

## The payout wait (7 November 2026)

Added after the fourth review, from research on how bridges lost funds: every payout now waits in the vault, and a
pause within the wait stops it. See [The wait](/protocol/redemptions-and-releases/#the-wait). It is the first change to
the vault contract since 0.9.0, and **no outside review has seen it yet**. Its own tests, the local run in which three
stolen keys queue a payout and the monitor stops it, and the mainnet rehearsal all pass, on local chains only.

## Are the Ethereum and BNB Chain vaults safe?

As far as testing can show, and not audited yet.

**Tested.**

- 209 vault tests: replay, signature order and malleability, reentrancy, fee-on-transfer tokens, backing never
  overdrawn, and the rate limits.
- Fork rehearsals on the real USDT and BSC-USD, including the blacklist checks.
- The internal security review found the vault sound.

**By design.**

- Backing leaves only through a release or a refund signed by 3 of 5, within the release allowance.
- The owner cannot take backing, only accrued fees. The guardian can only pause.
- No proxy and no upgrade key, so nobody can swap the code. The flip side: a bug cannot be patched. It means a
  new deployment (new vaults and a new kUSDT covenant together, never a new vault under the old kUSDT: a burn
  names no vault, so the new one would pay every earlier burn again), and migrating through redemptions.

**Not yet.**

- No external audit.
- On testnet the owner is the deployer's plain key. On mainnet the deploy script refuses any owner that is not a
  contract (an AccessManager whose admin is the Safe).

See the [attack vectors](/security/threat-model/#attack-vectors) for the whole bridge and the pool.

## What the audits must cover

The [mainnet checklist](/security/mainnet-checklist/) lists external audits as still open: kUSDT launches without
them. They must cover:

- `BridgeMint` and `KasPool`, including the SilverScript the Argent compiler generates from them;
- the vault.

## Reporting a vulnerability

The security contact is the Telegram group [t.me/trestly](https://t.me/trestly). Don't post the details of a
vulnerability there: say you have one and ask an admin for a private channel.
