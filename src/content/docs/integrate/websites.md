---
title: Websites and apps
description: Sending users to the Trestly web app, using kUSDT Wallet from a page, bridging from your own page, and quoting and building KasPool swaps.
---

:::caution[Mainnet, not audited]
kUSDT launches on mainnet (Kaspa mainnet, Ethereum and BNB Chain) on 14 November 2026, with real USDT. The
deployment's vaults, covenant ID, pool ID and API address are published on [Status](/overview/status/#addresses)
once the launch is verified. Nothing has been independently audited, and a legal review is open
([Audit status](/security/audit-status/)). To test first, use the public testnet at
[testnet.trestly.io](https://testnet.trestly.io) ([Test on the public testnet](/getting-started/public-testnet/)).
:::

## Linking to the web app

The simplest integration is a link. The web app is at `https://trestly.io`, and opens there once the mainnet launch is
verified. Its pages are plain paths ([The web app](/getting-started/web-app/#sections)):

| Path | Opens |
|---|---|
| `/` | The main page |
| `/bridge` | The bridge, from an EVM chain to Kaspa |
| `/swap` | KAS⇄kUSDT swaps |
| `/pool` | Liquidity in KasPool |
| `/portfolio` | What the connected wallets hold |
| `/reserves` | Proof of reserves |
| `/network` | The Reserves page opened at its Bridge status: each network working or paused, the contracts, the kUSDT and pool IDs |
| `/activity` | What the user's wallets did |
| `/terms` | The [Terms of Service](/reference/terms/) |

Any other path opens the main page. `/bridge` reads two query parameters, and no page reads any other:

| Parameter | Effect |
|---|---|
| `from=<chain code>` | Picks the EVM chain: `1` Ethereum, `2` BNB Chain. A code the deployment does not have falls back to the first chain |
| `to=evm` | Opens the bridge back, from Kaspa to the chain `from` names. Without it the bridge goes to Kaspa |

For example, `https://trestly.io/bridge?to=evm&from=2` opens the bridge back to BNB Chain. There is no
parameter for an amount or an address: the user enters them, and the page fills in the connected wallet's address.
Links from the time of hash routes (`/#/bridge?to=evm`) still land on the same page.

On a first visit the web app asks the user to accept its Terms of Service
([Terms of Service](/getting-started/web-app/#terms-of-service)).

## Using kUSDT Wallet from a page

kUSDT Wallet injects `window.kusdt`. A page connects with `kaspa_requestAccounts`, then asks for balances, a send, a
redemption, a swap or a liquidity change. Each of these opens the wallet's own window for the user to approve. The
page never sees a key. See [Wallet provider](/protocol/wallet-provider/) for the methods, the error codes and the
events, and note:

- Amounts are decimal strings (or safe integers) of the smallest unit: sompi for KAS (10⁸ in 1 KAS), base units for
  kUSDT (10⁶ in 1 kUSDT).
- Connections are per network. `kaspa_getNetwork` answers any page; `kaspa_switchNetwork` asks the user to move.
- Until the user has accepted the wallet's Terms of Service, every method but `kaspa_getNetwork` is answered `4100`.
- A site has at most 8 requests waiting at a time; past that, `-32002`.

Deposits are made on Ethereum or BNB Chain, so a page uses the user's EVM wallet for them (EIP-1193, EIP-6963 or
WalletConnect).

## Bridging from your own page

If you build the bridge into your own page instead of linking to the web app, follow what the web app does:

- **To Kaspa.** Approve exactly the amount, then call the vault's `depositAtLeast` with the least kUSDT the user
  accepts, so a fee that rose meanwhile makes it revert instead of taking more. Ethereum's USDT refuses to change a
  non-zero allowance: reset it to 0 first. Derive the Kaspa owner from the user's own address, never from typed
  input: a wrong owner can't be corrected after the mint. See
  [Doing it without the web app](/getting-started/bridge-in/#doing-it-without-the-web-app) and
  [Kaspa recipients](/protocol/identifiers-and-units/#kaspa-recipients).
- **Follow the deposit** with `GET /deposits/:chain/:nonce` ([Status values](/protocol/coordinator-api/#status-values)).
- **Back to an EVM chain.** Before every burn, ask `GET /recipients/:chain/:address` and burn only when it says
  `payable`, and check that the vault can pay now (paused, backing, `releaseAvailable`, release capacity). A burn
  cannot be undone. See [Redeem kUSDT](/getting-started/redeem/#before-you-start).
- **Never send USDT to a vault's address with a plain transfer.** Only `deposit` and `depositAtLeast` bridge; a plain
  transfer is lost ([Known limits](/security/known-limits/#usdt-sent-straight-to-a-vault-is-lost)).

Read the vault addresses and their parameters (fees, minimum and maximum deposit, `paused`) from `GET /status`, or
from the vaults themselves, and check them against [Status: Addresses](/overview/status/#addresses), where they are
published once the launch is verified. Make them a setting rather than code. To try your page before mainnet, point it at
the public testnet (`https://testnet.trestly.io/api/v1` and the testnet addresses, see
[Test on the public testnet](/getting-started/public-testnet/)), or run the whole stack locally
([Run the simnet flow](/developers/simnet/)).

## Pool swaps

### Through kUSDT Wallet

`kusdt_swap` with `{side: "buy" or "sell", amountIn, minOut}` is the short way. The wallet builds the swap on the
pool's newest verified state, refuses it while the pool is paused or when a sell is over the circuit breaker, and
never goes ahead on its own at a worse price than the user approved. `minOut` stays the hard floor
([The pool](/protocol/wallet-provider/#the-pool)).

### Building it yourself

1. **Read the pool.** `GET /pool` answers the newest pool and reserve states, the spot prices, `breaker` (what sells
   may still take out now, and from which DAA score a pool transaction can be sent) and `paused`
   ([Coordinator API](/protocol/coordinator-api/#calls)).
2. **Check it.** Recompute the pool state's locking script and find the UTXO on your own node
   ([Verifying answers](/protocol/coordinator-api/#verifying-answers)).
3. **Quote.** `kusdt-tx quote` gives the exact output with the same core the covenant checks against
   ([Protocol helpers](/developers/kusdt-tx/#protocol-helpers)); the formula is on
   [Swap: price and fee](/getting-started/swap/#price-and-fee). Asking for one base unit more is rejected.
4. **Build.** `pool-buy` or `pool-sell` ([Transactions](/developers/kusdt-tx/#transactions)), keeping to the
   [input rules](/developers/kusdt-tx/#inputs-of-a-pool-or-minter-transaction): at most 8 inputs, plain Schnorr P2PK
   funding coins already in a block.
5. **Sign and submit.** If another swap lands first, yours becomes invalid rather than worse: quote again and ask
   the user again before you send at a lower output ([No sandwiching](/getting-started/swap/#no-sandwiching-no-slippage-after-signing)).

While the pool is paused, buys, sells and new liquidity stop, and removing liquidity keeps working
([When the pool is paused](/getting-started/swap/#when-the-pool-is-paused)).
