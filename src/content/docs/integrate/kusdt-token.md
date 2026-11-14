---
title: Hold and send kUSDT
description: For wallets, exchanges and services with their own keys - identify kUSDT by its covenant ID, read balances from the API and a node, build transfers and redemptions with @kusdt/core or kusdt-tx, and wait for finality.
---

:::caution[Mainnet, not audited]
kUSDT launches on mainnet on 14 November 2026, with real USDT. Nothing has been independently audited, and a legal
review is open ([Audit status](/security/audit-status/)). The mainnet covenant ID, pool ID and API address are
published on [Status](/overview/status/#addresses) once the launch is verified: make them settings, and test on the
public testnet first ([Test on the public testnet](/getting-started/public-testnet/)).
:::

This page is for code that holds kUSDT with its own keys: a Kaspa wallet, an exchange's hot wallet, a payment
service. If your users already have kUSDT Wallet, a website can ask it to send instead, with no keys of its own
([Connect kUSDT Wallet to your site](/integrate/kusdt-wallet/)).

## Identify kUSDT

kUSDT is a KCC-20 token on Kaspa L1 with the standard, unmodified token code. **Its covenant ID is its only
identity.** The name, the symbol and the metadata prove nothing: anyone can deploy a token called "kUSDT"
([Token metadata](/concepts/metadata/#what-metadata-does-not-do)).

| Item | Value |
|---|---|
| Decimals | 6. Every amount is an integer of base units, 10⁶ in 1 kUSDT |
| Covenant ID, mainnet | On [Status: Addresses](/overview/status/#addresses), once the launch is verified |
| Covenant ID, testnet-10 | On [Test on the public testnet](/getting-started/public-testnet/#networks-and-addresses) |
| Where the API says it | `GET /status`, `kaspa.covenantId` |
| Token template | The standard KCC20 template, hash `9703112ee6e3555107cd168858992b77d3b74f655205b2b463b1f9ec2ec73cf7` ([The kUSDT token family](/contracts/kusdt-token/#rules-every-kusdt-state-follows)) |
| Extension commitment | 32 zero bytes in every kUSDT state: all kUSDT is one fungible token |

Keep the covenant ID in a setting per network, set it from Status, and check at start-up that the API's
`GET /status` says the same. If the two ever differ, stop and ask in [t.me/trestly](https://t.me/trestly).

A token state is `{amount, owner, ownerScheme, borrowScheme, borrowGuard, extensionCommitment}`. The owner is a KCC-2
owner: for a usual `kaspa:q…` address, scheme `0` and the address's x-only public key
([Kaspa recipients](/protocol/identifiers-and-units/#kaspa-recipients), [Owner schemes](/concepts/owner-schemes/)).

## Read a balance

### From the coordinator API

```js
const API = settings.apiUrl; // https://testnet.trestly.io/api/v1 on the public testnet
const r = await fetch(`${API}/tokens?owner=${encodeURIComponent(address)}`);
if (r.status === 503) return retryLater((await r.json()).retryAt);
const { states, unread = [] } = parseExact(await r.text());
const total = states.reduce((sum, s) => sum + BigInt(s.state.amount), 0n);
```

`owner` is a Kaspa address or an x-only key in hex. The answer lists the owner's unspent kUSDT states, each with its
UTXO. `unread` holds states at an address with too many coins for the node to list: show them apart, as not checked
([Known limits](/security/known-limits/#an-address-that-holds-too-many-coins-cannot-be-listed)). A 503 or 429 carries
`retryAt`; ask again then.

Parse the body exactly. Amounts are JSON integers that can exceed 2⁵³, and large ones can arrive as decimal strings
([Coordinator API](/protocol/coordinator-api/)). `JSON.parse` loses digits: use a parser that keeps big integers,
such as the exact parsers in the open packages.

### From your own node

The API is a convenience, not a source of truth. Before you show a state as kUSDT or spend it, find it on your own
Kaspa node:

1. Recompute the state's locking script: `script` with `{actor: "KCC20", state}`, in `@kusdt/core` or `kusdt-tx`
   ([Protocol helpers](/developers/kusdt-tx/#protocol-helpers)).
2. Look up that exact outpoint in your node's UTXO set, at the owner's address.
3. Keep it only if the UTXO is there, with that script and with kUSDT's covenant ID.

This is what kUSDT Wallet does (`wallet/extension/src/kusdt/verify.ts` in the open repository). A wallet with KCC-20
support can skip the API: list the address's UTXOs, keep those bound to kUSDT's covenant ID, and read each state from
its script (`stateOfProgram` and `isKcc20Program` in `@kusdt/protocol`).

## What to check before you show a balance as kUSDT

- The UTXO's covenant ID is kUSDT's, from your setting. Never trust a name, a symbol or a logo.
- The UTXO is in your node's UTXO set, at the outpoint and with the script the state gives.
- The state's `extensionCommitment` is 32 zero bytes. A state spent from your own keys also has `borrowScheme` 0 and
  a zero `borrowGuard`, and its owner is yours.
- Amounts are summed as `BigInt`.
- States in `unread` are shown apart, as not checked.
- An incoming payment is shown as pending until it is final (below).
- The network matches: a `kaspatest:` address and the testnet covenant ID never mix with mainnet's.

## Build a transfer

A kUSDT send is a standard KCC-20 transfer: 1 to 3 token inputs, 1 to 3 token outputs, and the outputs hold exactly
what the inputs held. Change goes back to the sender as a second token output. More than three states to spend? Merge
them first, three into one per transaction.

The builder is the Rust code compiled to WebAssembly, `@kusdt/core`, or the same code as the `kusdt-tx` CLI
([The kusdt-tx CLI](/developers/kusdt-tx/)). Both are in the open repository
([github.com/kaspador/kusdt-open](https://github.com/kaspador/kusdt-open)), under `bridge/packages/core` and
`bridge/kaspa`; they are not published to npm, so build them from there. Every command takes one JSON request and
answers JSON; the transaction commands sign, run every input through Kaspa's script engine, check standardness, and
price the fee.

```js
import { loadCore } from '@kusdt/core/web'; // in Node: import { core } from '@kusdt/core'

const core = await loadCore();
const ZERO32 = '0'.repeat(64);
const plain = (owner, amount) => ({
  amount, owner, ownerScheme: 0, borrowScheme: 0, borrowGuard: ZERO32, extensionCommitment: ZERO32,
});

const { value: built } = core.call('transfer', {
  network: 'testnet-10',                    // or 'mainnet'
  changeAddress: myAddress,                 // KAS change
  funding: [{ utxo: kasCoin, secretKey }],  // plain P2PK coins that pay values and the fee
  inputs: [{ utxo: tokenUtxo, state: tokenState, secretKey }],
  outputs: [
    { state: plain(recipientXOnly, 25_500_000n), value: tokenValue },                       // 25.5 kUSDT
    { state: plain(myXOnly, BigInt(tokenState.amount) - 25_500_000n), value: tokenValue },  // change
  ],
});
// built: { txid, transaction, fee, mass, outputs }
```

- A UTXO is `{transactionId, index, amount, scriptPublicKey, blockDaaScore, isCoinbase, covenantId}`, the script
  being its 2-byte version and the script, in hex.
- Pass integers as `BigInt` or decimal strings. `core.call` writes them exactly.
- `tokenValue` is the KAS (in sompi) each token output carries for its storage: the deployment's `kaspa.tokenValue`
  in `GET /status`, 1.5 KAS by default ([KAS carried by token states](/protocol/fees/#kas-carried-by-token-states)).
  The sender needs KAS beside their kUSDT for it and for the network fee.
- A failure throws a `CoreError` with the builder's reason.
- Submit `built.transaction` to your node's `submitTransaction` untouched, with its integers exact. kUSDT Wallet's
  `wallet/extension/src/kusdt/tokens.ts` shows the whole path: choosing states, merging, building, checking the
  result and submitting.

The secret keys are in the request so the builder can sign. In a browser they stay on the device; with the CLI, run
it only on a machine you trust and never log its input.

## Build a redemption

A redemption is a transfer to a **burn owner**: the USDT is paid on Ethereum or BNB Chain to the EVM address the burn
names, and the kUSDT can never move again. **It cannot be undone.** Build one only on purpose.

1. **Ask whether the vault would pay the address**: `GET /recipients/:chain/:address`. Go on only when `payable` is
   true.
2. **Check that the vault can pay now** in `GET /status`: not `paused`, enough `releaseAvailable` and release
   capacity, and an amount above the release fee. A burn at or below the release fee is never paid
   ([Small burns are not paid](/security/known-limits/#small-burns-are-not-paid)).
3. **Get the burn owner**: `burn-owner` with `{chain, address}` (chain `1` Ethereum, `2` BNB Chain; the address as 20
   bytes of hex) answers `{ownerScheme, owner, script}`.
4. **Build a `transfer`** with one output to that owner and a matching `redeem` entry:

   ```js
   const burn = core.call('burn-owner', { chain: 1, address: evmAddressHex }).value;
   const { value: built } = core.call('transfer', {
     network, changeAddress: myAddress, funding, inputs,
     outputs: [
       { state: { ...plain(burn.owner, amount), ownerScheme: burn.ownerScheme }, value: burnValue },
       { state: plain(myXOnly, change), value: tokenValue },
     ],
     redeem: [{ outputIndex: 0, chain: 1, address: evmAddressHex }],
   });
   ```

   `burnValue` is `kaspa.burnValue` in `GET /status`. The builder puts the payload in and builds only a burn of the
   shape the signers pay: a plain burn of an amount above zero, to chain 1 or 2, to an address other than zero. It
   can't know whether the address is a vault or a token contract (lost for good) or whether the token blocks it:
   that is what steps 1 and 2 are for.
5. **Submit it, then report it**: `POST /redeems` with `{transaction, transactionId}`. The coordinator also finds burns
   on the chain; the report makes it quicker ([Reporting a burn](/protocol/coordinator-api/#reporting-a-burn)).
6. **Follow it** with `GET /redeems/:txid/:outputIndex` until `released`
   ([Status values](/protocol/coordinator-api/#status-values)). A payout waits in the vault before it is paid
   ([Redemptions and releases](/protocol/redemptions-and-releases/)).

The details of the burn script and the payload are on [Burn owner and payload](/protocol/burn-owner-and-payload/).

## Finality

A Kaspa transaction can be reorganised for a short while after it is accepted. Set your own policy for when an
incoming payment counts. For reference, the bridge's signers count a Kaspa transaction as final once its accepting
block is at least 1 000 DAA scores below the virtual DAA score on mainnet (about 100 seconds; 300 on the testnet),
and wait deeper for larger burns: 6 000 DAA scores above 10 000 kUSDT and 36 000 above 100 000 kUSDT. The deployment
serves its tiers in `GET /status` (`kaspa.finalityDaa`, `kaspa.finalityTiers`). See [Finality](/protocol/finality/).

## While the bridge is paused

kUSDT transfers never stop: the token has no pause. The vaults, the minter and the pool can be paused. The mainnet
monitors are private, so read the chain: each vault's `paused()` on Ethereum and BNB Chain, and the minter's and the
pool's `paused` on Kaspa (`GET /status` and `GET /pool` report them too). While any is paused, stop crediting new
kUSDT ([When the bridge is paused](/integrate/exchanges/#when-the-bridge-is-paused)).

## Related

- [Wallets](/integrate/wallets/): showing and sending kUSDT, and the input rules for pool and minter transactions.
- [Exchanges and custodians](/integrate/exchanges/): crediting deposits and paying out.
- [KCC-20 tokens](/concepts/kcc20-tokens/): the token state and transfers.
- [Coordinator API](/protocol/coordinator-api/): every route and field.
