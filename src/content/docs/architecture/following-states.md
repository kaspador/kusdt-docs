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
  block, the transactions it accepted; the block bodies come from `getBlocks`;
- a chain block is processed only once it is a few DAA scores below the virtual (`minDepthDaa`), which keeps
  ordinary reorganisations from undoing what was read. The default is 20 DAA scores for the coordinator and the
  signers (2 on simnet) and 10 for the monitor.

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
| Wallet | Its own kUSDT states and the pool, as listed by the API | Before a state is shown or spent, the wallet recomputes its locking script and finds that exact outpoint on the node, with the pinned covenant ID; a state that fails is dropped (tokens) or refused (the pool) |

The coordinator also takes supply from the chain: minted = genesis `remaining` − the minter's `remaining`;
released = the vaults' `Released` events.

## Mempool and confirmed states

The pool can move several times before a block accepts the moves. `GET /pool` therefore answers both:

- `pool` and `reserve`: the newest state, **mempool included**, carried through the pool moves listed in
  `pending`. Wallets build swaps on this, and rebuild when it moves.
- `confirmed`: the newest **accepted** state.

Anyone can check either against a node: recompute the locking script of the state (`kusdt-tx script`) and look
for that UTXO.

## Code

| File | Does |
|---|---|
| `bridge/packages/protocol/src/minter.ts` | Follows BridgeMint |
| `bridge/packages/protocol/src/pool-follow.ts` | Follows the pool, its reserve and positions |
| `bridge/services/src/shared/accepted.ts` | Reads accepted transactions in order, `minDepthDaa` deep, and goes back to the fork point after a reorganisation |
