---
title: Following covenant states
description: How the monitor, the coordinator and the wallet learn the state of BridgeMint, the pool and the positions without trusting anyone.
---

The monitor, the coordinator, the signers and the wallet all need the current state of BridgeMint, the pool and the liquidity
positions. None of them takes it on trust. They follow each covenant from transaction to transaction, from the
chain itself.

## The problem

A covenant UTXO shows only a hash: its locking script is `OP_BLAKE2B <hash of R> OP_EQUAL`, where `R` is the
program with its state inside (see [States and templates](/concepts/states-and-templates/)). Nobody can read the
state of an unspent covenant UTXO from the UTXO itself.

## Reading a spend

When a covenant UTXO is spent, the spending input reveals its program `R` as the last push of its signature
script. So a follower:

1. reads the **spent state** from `R`, at the state location the program's layout gives;
2. computes the **successor state** from the entry's arguments, by the covenant's own arithmetic, mirrored in
   code (for BridgeMint, for example, the refilled allowance, the advanced nonce and the reduced `remaining`);
3. computes the successor's locking script with the transaction builder's core;
4. **adopts the successor only if that script is one of the outputs the spending input authorizes in the
   family**: an output bound to the same covenant ID with that input as its authorizing input (KIP-20), in the
   covenant's order.

A plain output that merely pays to the same script is a **decoy**: anyone can create one, and it carries no
covenant ID. Followers ignore it. The internal security review found that followers had adopted such decoys; they
now take successors only from covenant-bound authorized outputs (regression tests:
`bridge/packages/protocol/src/decoys.test.ts`, `bridge/kaspa/tests/decoy_outputs.rs`).

A decoding mistake therefore cannot be adopted silently. If the computed successor is not among the outputs, the follower refuses it with an error and keeps the state it holds. The monitor treats that as an alarm (`minter-unverifiable`); the coordinator and the signers log it. For a mint, every
recipient's script must be among the outputs too. Where the successor depends on which input paid (a pool sell,
add or first deposit), every kUSDT input is tried, and only one whose result the outputs hold is taken.

## Reading in acceptance order

A Kaspa block can carry a transaction the DAG never accepts, because it lost a double-spend race. Example: a
guardian `pause` and a mint that both spend the same minter UTXO. Only one is accepted. A follower that read block
contents could count the loser.

So followers read **acceptance**, not block contents:

- the node's virtual chain (`getVirtualChainFromBlock` with `includeAcceptedTransactionIds`) lists, for each chain
  block, the transactions it accepted; the block bodies come from `getBlocks`, about 250 blocks an answer. When a
  node does not get such a batch to the follower in time (20 s), the follower reads the same blocks one at a time
  for the next ten minutes: the batch's hashes from `getBlocks` without blocks, then `getBlock` for each, in the
  batch's order, a few at a time. The node answers a block alone as it answers it in a batch, so what is read is the
  same, and each pass keeps what it read. The batch that did not come is not asked for again, and its connection is
  dropped at its deadline so its answer does not arrive for nobody (since run 20);
- a chain block is processed only once it is a few DAA scores below the virtual (`minDepthDaa`), which keeps
  ordinary reorganisations from undoing what was read. The default is 20 DAA scores for the coordinator and the
  signers (2 on simnet) and 10 for the monitor.

## One transaction ID, several bodies

A Kaspa transaction ID does not cover the signature scripts. A miner can therefore put a rewritten body of a real
transaction into a block of its own: the block is valid, the body is simply never the one that was accepted, and the
node's acceptance data names only the ID. So the follower keeps every body it sees under an ID and takes the one that
proves itself (step 4 above). A rewritten body can never be adopted. It could only hide the real one, and that is
what the next rules prevent.

The ID covers everything else of a body, with one exception: a version-0 transaction's ID leaves out its outputs'
covenant bindings, and consensus refuses a version-0 transaction that carries one. So since run 21 (R21-IDENT-3) the
followers keep each body's version, and a binding on a version-0 body counts for nothing: kUSDT's own transactions
are version 1. And an ID whose bodies differ in anything but their signature scripts is not one transaction: the
burn records the signers and the coordinator keep take no burn from it, and their logs say so. Neither can come from
a valid block today; the followers do not rest on that.

What a follower keeps is bounded. A miner can fill blocks with transactions that are never accepted, so bodies that
no chain block accepted are dropped after two hours, and all of them together stay within a memory budget (64 MB).
Two rules keep a dropped body from costing a move:

- a chain block is handed out only with a body for every transaction it accepted. One that is missing is fetched
  again from the node, from the last chain block handed out;
- the follower remembers which bodies it dropped. If a chain block accepts one of those, whatever came under that ID
  since is not taken for all there is: the blocks are fetched again the same way, and the chain block is handed out
  only after its own block came again. The record of dropped IDs is bounded too. When it is full, the follower stops
  guessing and treats every accepted transaction as one it had dropped, until that fetch.

And one more, behind them: before the monitor raises `minter-unverifiable` or `pool-unverifiable`, and before the
coordinator, a signer or the pool keeper gives a move up, the follower reads that chain block's transactions from
its node once more. If no body proves the move then either, the outcome is what it was. The regression tests are
`bridge/services/src/shared/accepted-budget.test.ts` and the `round11-second-look` tests beside the monitor and the
coordinator.

Since round 12 the signers, the coordinator and the monitor make those second reads for a whole batch before they
apply any of it. A follower used to wait on the node in the middle of a batch, with the first transactions of the
batch already in its state and its saved position still before them; a state saved in that wait held records from
above its own position, and after a restart and a reorg nothing undid them. Now a follower first walks the batch
with the states it follows carried along on their own, makes every read there, and then applies the batch and
writes its position in one run with no wait in it: what is on the disk is the state before a batch, or after it.
The tests are `bridge/services/src/shared/look-ahead.test.ts` and the `round12` tests beside each service.

## When the chain moves anyway

A 10 BPS network reorganises a few blocks deep now and then. On 4 November 2026 TN10's selected chain moved off a
block the coordinator's follower had already read 2 DAA scores deep. The follower then waited forever for
transaction bodies it had dropped or never fetched, and a restart with the same cursor did the same.

Now, when the node reports any `removedChainBlockHashes`, the follower goes back to the **fork point**: the
selected parent of the first added chain block. It fetches the block bodies again from there and hands the
transactions out again.

Handing a transaction out twice is safe. A transaction the follower already followed spends a state it no longer holds, so it is ignored. A transaction the new chain no longer accepts is different: it leaves the follower on a state that is gone. So a signer undoes the minter moves the dropped blocks accepted, newest first, from a journal of its last 256 moves, and holds the state the new chain spends again. It also signs no refund unless the minter it follows is unspent on its own node (see [Refunds](/protocol/refunds/)). The coordinator and the monitor do not undo moves: the monitor raises `minter-lost` and pauses, and an operator brings them back (see [Known limits](/security/known-limits/)). The regression tests are `bridge/services/src/shared/accepted.test.ts`, `bridge/services/src/review3.test.ts` and `bridge/services/src/signer/signer.test.ts`.

## Who follows what

| Follower | Follows | Uses it for |
|---|---|---|
| Monitor | BridgeMint, the pool, every kUSDT burn | Minted supply, mints against deposits, releases against burns, governance (see [The monitor](/security/monitor/)) |
| Coordinator | BridgeMint, the pool, positions, kUSDT states and burns | `GET /status`, `GET /pool`, `GET /positions`, `GET /tokens`, the redemptions it pays, and supply in `GET /reserves` |
| Each signer | BridgeMint, from its own Kaspa node | Signing a refund only for a nonce it sees skipped and never minted, and only while the minter it follows is unspent on its node |
| Wallet | Its own kUSDT states and the pool, as listed by the API | Before a state is shown or spent, the wallet recomputes its locking script and finds that exact outpoint on the node, with the pinned covenant ID; a state that fails is dropped (tokens) or refused (the pool). The pool's kUSDT reserve made by the transaction that made the pool coin is proven instead from that transaction, checked against its id, and the pool coin found on the node (since run 21: its address, which anyone can fill, is then not listed); one made before it is listed, and its body taken only when its address cannot be |

The coordinator also takes supply from the chain: minted = genesis `remaining` − the minter's `remaining`;
released = the vaults' `Released` events.

## Mempool and confirmed states

The pool can move several times before a block accepts the moves. `GET /pool` therefore answers both:

- `pool` and `reserve`: the newest state, **mempool included**, carried through the pool moves listed in
  `pending`. Wallets build swaps on this, and rebuild when it moves.
- `confirmed`: the newest **accepted** state.

Anyone can check either against a node: recompute the locking script of the state (`kusdt-tx script`) and look
for that UTXO. The reserve can also be checked without listing its address, from the body of the transaction that
made it: `reserve.made` names that transaction, and `GET /pool/made/:txid` serves its body, which never changes
([Verifying answers](/protocol/coordinator-api/#verifying-answers)).

## Code

| File | Does |
|---|---|
| `bridge/packages/protocol/src/minter.ts` | Follows BridgeMint |
| `bridge/packages/protocol/src/pool-follow.ts` | Follows the pool, its reserve and positions |
| `bridge/services/src/shared/accepted.ts` | Reads accepted transactions in order, `minDepthDaa` deep, keeps every body seen under an ID within a memory budget, fetches again what it dropped, and goes back to the fork point after a reorganisation |
