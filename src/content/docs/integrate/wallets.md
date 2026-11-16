---
title: Wallets
description: How a Kaspa wallet shows and sends kUSDT, how a site talks to kUSDT Wallet, and the input rules for pool and minter transactions.
---

:::caution[Mainnet, not audited]
kUSDT launched on mainnet (Kaspa mainnet, Ethereum and BNB Chain) on 15 November 2026, with real USDT. The
deployment's vaults, covenant ID, pool ID and API address are on [Status](/overview/status/#addresses). Nothing has been independently audited, and a legal review is open
([Audit status](/security/audit-status/)). To test first, use the public testnet at
[testnet.trestly.io](https://testnet.trestly.io) ([Test on the public testnet](/getting-started/public-testnet/)).
:::

## The token

| Item | Value | Details |
|---|---|---|
| Standard | KCC-20, the unmodified reference token code | [KCC-20 tokens](/concepts/kcc20-tokens/), [The KCC20 template](/kaspa/kcc20-template/) |
| Name and symbol | `kUSDT` | [Token metadata](/concepts/metadata/) |
| Decimals | 6. Every amount is a whole number of base units of 10⁻⁶ | [Units](/protocol/identifiers-and-units/#units) |
| Identity | The covenant ID, nothing else | [The kUSDT token family](/contracts/kusdt-token/) |
| Fungibility | Every kUSDT state has a zero extension commitment, so all kUSDT is one token | [KCC-20 tokens](/concepts/kcc20-tokens/#the-token-state) |

Because the token code is the standard template, a wallet that supports KCC-20 can read kUSDT states with no
kUSDT-specific code. What it must add is the check of the covenant ID: anyone can deploy a token named "kUSDT"
([Holding kUSDT in another wallet](/getting-started/wallet/#holding-kusdt-in-another-wallet)).

Don't copy a covenant ID from anywhere but the deployment's own record. The mainnet one is on
[Status](/overview/status/#addresses), and is in the API's `GET /status` answer
(`kaspa.covenantId`). Make it a setting rather than code.

## Showing a holder's kUSDT

Two ways:

- **As any KCC-20 token.** A wallet with KCC-20 support reads kUSDT states the way it reads any other KCC-20 token,
  and keeps only those with kUSDT's covenant ID.
- **From the coordinator's API.** `GET /tokens?owner=<kaspa address or x-only hex>` answers
  `{states: [{utxo, state}], unread?}`: the owner's unspent kUSDT states. Add up `state.amount`. See
  [Coordinator API](/protocol/coordinator-api/#calls).

The API is a convenience, not a source of truth. Before you show or spend a state from it, do what kUSDT Wallet
does: recompute the state's locking script with [`kusdt-tx script`](/developers/kusdt-tx/#protocol-helpers) and find
that exact outpoint on your own node, with the same script and kUSDT's covenant ID
([Verifying answers](/protocol/coordinator-api/#verifying-answers)).

Things to handle:

- **Exact integers.** Amounts can exceed 2⁵³ and can arrive as numbers or as decimal strings. Parse both exactly.
- **`unread`.** States the node could not list, at an address that holds too many coins. Show them apart, as not
  checked ([Known limits](/security/known-limits/#an-address-that-holds-too-many-coins-cannot-be-listed)).
- **503 with `retryAt`.** The API process has not read its index yet, or is busy. Ask again at `retryAt`.

## Sending kUSDT

A send is a standard KCC-20 transfer: 1 to 3 token inputs, 1 to 3 token outputs, amounts preserved. The
[`kusdt-tx`](/developers/kusdt-tx/#transactions) `transfer` command builds one, and the same builders compiled to
WebAssembly (`@kusdt/core`) run in a browser, so keys never leave the device.

- **KAS goes with every state.** Each kUSDT state carries KAS for its storage, 1.5 KAS by default, and the
  transaction pays a network fee. The holder needs KAS next to their kUSDT. The deployment's value is `tokenValue` in
  `GET /status`. See [KAS carried by token states](/protocol/fees/#kas-carried-by-token-states).
- **A send to a burn owner is a redemption.** It pays USDT out on an EVM chain and cannot be undone. Only build one on
  purpose, with the steps on [Redeem kUSDT](/getting-started/redeem/) and
  [Burn owner and payload](/protocol/burn-owner-and-payload/).
- **Recipients.** A state names its owner through one of the KCC-2 owner schemes, and a Kaspa address maps to one
  as in [Kaspa recipients](/protocol/identifiers-and-units/#kaspa-recipients). See
  [Owner schemes](/concepts/owner-schemes/).

## kUSDT Wallet for sites

kUSDT Wallet injects `window.kusdt`, an EIP-1193-style object. A site asks it to connect, read balances, send,
redeem, swap or add and remove liquidity. The wallet builds every transaction, shows it to the user, signs and
submits it. The page never sees a key. Methods, errors and events: [Wallet provider](/protocol/wallet-provider/).

kUSDT Wallet's mainnet version is 1.0.0 ([Install](/getting-started/wallet/#install)).
On the EVM side, the web app works with MetaMask and WalletConnect.

## How KasWare and Kaspire sign for the web app

The page builds each kUSDT transaction with kUSDT Wallet's engine (the same pool checks, coins, fees and output checks)
and asks the wallet to sign only the user's inputs, with SIGHASH_ALL. The engine builds on a stand-in key. Before
anything is checked or signed, the page puts the user's key back wherever the stand-in's is: in the user's kUSDT states
and pool positions, in a state derived from theirs (the kUSDT left over from a partial sale or a deposit), and in the
covenant witnesses that name it. It gives those outputs the user's scripts and the transaction its new id. The result
is the transaction kUSDT Wallet builds for that address, but for the signatures:

- **KasWare** (0.11.6 or later): `kasware.signPskt({ txJsonString, options: { signInputs: [{ index, sighashType: 1 }] } })`
  for every input of the user's, the kUSDT states and pool positions too. Each answer is one 65-byte push, the
  signature with its sighash byte. For a plain coin that push is the signature script; for a kUSDT state or a position
  the page puts the signature into its witness, in place of the stand-in signature, before its script, which must hash
  to the input's address.
- **Kaspire** (extension, or the Android app over WalletConnect): `signPskt` for plain coins, and for kUSDT states and
  positions its script-aware form (`scripts` with `ordered-args`), which builds the input's script itself.

Either way the page puts only the wallet's signatures into its own transaction, so the wallet cannot change what is
sent, and the node checks every script.
To try a wallet integration before mainnet, use the public testnet at
[testnet.trestly.io](https://testnet.trestly.io), with the testnet build of kUSDT Wallet and its faucet
([Test on the public testnet](/getting-started/public-testnet/)), or run the whole stack locally
([Run the simnet flow](/developers/simnet/)).

## Input rules for pool and minter transactions

Since rc.22 the pool and the minter take a transaction only if a node's mempool judges every input as a block will.
Anyone who builds a transaction that spends the pool or the minter keeps to these rules
([Inputs of a pool or minter transaction](/developers/kusdt-tx/#inputs-of-a-pool-or-minter-transaction)):

- At most 8 inputs in all. A buy leaves room for 6 funding coins; a sale, a deposit or a withdrawal for 5.
- Funding coins are plain Schnorr P2PK coins, with sequence 0.
- Every coin is already in a block, or is an output of the transaction that made the pool or minter coin.
- kUSDT owned by a P2SH script or by another covenant can't pay into the pool directly. Move it to a plain owner
  first.

When a holder's KAS sits in too many small coins, ask them to merge it first: kUSDT Wallet does this with a send of
all their KAS to their own address ([KAS in many small coins](/getting-started/wallet/#kas-in-many-small-coins)). A
plain kUSDT transfer between holders spends neither the pool nor the minter. [Status](/overview/status/) says which
release each network runs.
