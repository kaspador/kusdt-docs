---
title: Developer guide
description: How to build kUSDT and kUSDT Wallet into your own site, wallet or service, what to test on the public testnet first, and where the details are.
---

:::caution[Mainnet, not audited]
kUSDT launches on mainnet (Kaspa mainnet, Ethereum and BNB Chain) on 14 November 2026, with real USDT. Nothing has
been independently audited, and a legal review is open ([Audit status](/security/audit-status/)). The mainnet
covenant ID, pool ID, vault addresses and API address are published on [Status](/overview/status/#addresses) once
the launch is verified. These pages never give them: make them settings in your code and check them against Status.
:::

This guide is for developers who want their site, wallet or service to work with **kUSDT** (the token) or with
**kUSDT Wallet** (the browser extension). It says which way to integrate fits you, and points to the page with the
details.

## What kUSDT is, for a developer

- A KCC-20 covenant token on Kaspa Layer 1, with the standard token code and **6 decimals**: 1 kUSDT is 1 000 000
  base units ([Units](/protocol/identifiers-and-units/#units)).
- Backed 1:1 by USDT locked in two vaults, one on Ethereum and one on BNB Chain. A deposit into a vault is minted as
  kUSDT on Kaspa; a kUSDT burn on Kaspa is paid out as USDT by a vault.
- Identified by its **covenant ID** and nothing else. Anyone can deploy a token called "kUSDT"
  ([The kUSDT token family](/contracts/kusdt-token/)).
- Every amount is an integer of base units (kUSDT) or sompi (KAS, 10⁸ in 1 KAS). Some exceed 2⁵³: parse them as
  `BigInt`, never as JavaScript numbers.

## Three ways to integrate

| You build | You use | Start here |
|---|---|---|
| A website or web app whose visitors connect kUSDT Wallet, read their balances, send or redeem kUSDT, or swap | `window.kusdt`, the object kUSDT Wallet puts into every HTTPS page. The wallet builds, shows and signs every transaction; your page never sees a key | [Connect kUSDT Wallet to your site](/integrate/kusdt-wallet/) |
| A wallet, an exchange or a service that holds kUSDT with its own keys and sends it | The coordinator API to find token states, your own Kaspa node to check them, and the open transaction builders (`@kusdt/core` in WebAssembly, or the `kusdt-tx` CLI) to build transfers and redemptions | [Hold and send kUSDT](/integrate/kusdt-token/) |
| A dashboard, a bot or a risk check that needs to know whether the bridge is working | The vaults' `paused()` on Ethereum and BNB Chain, the minter's and the pool's state on Kaspa, and the API's `GET /status` and `GET /reserves` | [Reading the bridge's state](/integrate/bridge-state/) |

Many integrations use two of these. A site that takes kUSDT payments, for example, asks kUSDT Wallet for the
payment and reads the chain to see it arrive and to stop taking kUSDT while the bridge is paused.

If all you want is to send users to the bridge, a link is enough: `https://trestly.io/bridge` and its query
parameters are on [Websites and apps](/integrate/websites/#linking-to-the-web-app).

## Is the bridge paused?

Read the chain, and both monitors' signal (`GET /api/v1/signal` at each monitor's address on [Status: Addresses](/overview/status/#addresses); the mainnet
monitors' servers are closed and publish only that read-only status, through Cloudflare tunnels):

- each vault's `paused()`, on Ethereum and on BNB Chain;
- the minter's `paused` flag and the pool's `paused` flag, in their states on Kaspa;
- the API's `GET /status` (each vault's `paused` and the minter's state) and `GET /pool` (`paused`) say the same, and
  can be checked against a node ([Verifying answers](/protocol/coordinator-api/#verifying-answers)).

While any of them is paused, stop crediting new kUSDT and stop sending users to bridge. kUSDT transfers never stop:
the token has no pause ([When the bridge is paused](/integrate/exchanges/#when-the-bridge-is-paused)).

On the public testnet the monitor's status is public, so you can test how your code reacts to it:
`https://testnet.trestly.io/monitor/health`.

## Test on the public testnet first

The public testnet at [testnet.trestly.io](https://testnet.trestly.io) is the whole bridge and the pool on Kaspa
testnet-10, Sepolia and BSC testnet, with test coins only.

| For | Where |
|---|---|
| The web app and its faucet | `https://testnet.trestly.io` |
| The coordinator API | `https://testnet.trestly.io/api/v1` |
| The testnet build of kUSDT Wallet | `https://testnet.trestly.io/downloads/kusdt-wallet-testnet.zip` |
| The monitor's health | `https://testnet.trestly.io/monitor/health` |
| The covenant ID, the pool ID, the vaults and the test tokens | [Test on the public testnet](/getting-started/public-testnet/#networks-and-addresses), and the testnet API's `GET /status` |

1. Install the testnet build of the wallet with a fresh recovery phrase, never one that holds real KAS.
2. Take test coins from the faucet in the web app.
3. Point your code at the testnet API and the testnet IDs, kept in a setting.
4. Try every flow you support: connect, read balances, send, redeem to both chains, what happens while a payout
   waits, and what happens while the bridge is paused.
5. Switch the setting to mainnet once the launch is verified on [Status](/overview/status/#addresses).

The full steps are on [Test on the public testnet](/getting-started/public-testnet/). To run everything on your own
machine instead, see [Run the simnet flow](/developers/simnet/).

## The open code

The open code is at [github.com/kaspador/kusdt-open](https://github.com/kaspador/kusdt-open): the vault contracts,
the covenants, the Rust transaction builders and their WebAssembly build (`@kusdt/core`), the client packages
(`@kusdt/kaspa`, `@kusdt/protocol`), kUSDT Wallet and the specification. Read the wallet's source to see exactly how
it answers a page, and the builders' to see what a transaction holds.

## Rules that apply to every integration

- **Never hard-code a mainnet value.** Read the IDs and addresses from settings, check them against
  [Status](/overview/status/#addresses), and compare them with the API's `GET /status`.
- **Check the covenant ID** of every token state before you show it as kUSDT or accept it.
- **Check the API against a node.** The API is a convenience, not a source of truth.
- **A burn cannot be undone.** Only build a redemption on purpose, after the checks on
  [Redeem kUSDT](/getting-started/redeem/#before-you-start).
- **Never send USDT to a vault with a plain transfer.** Only the vault's `deposit` and `depositAtLeast` bridge
  ([Known limits](/security/known-limits/#usdt-sent-straight-to-a-vault-is-lost)).
- **Tell your users the risks** ([Risks to tell your users](/integrate/risks/)).

## The detailed pages

| Topic | Page |
|---|---|
| `window.kusdt`, step by step | [Connect kUSDT Wallet to your site](/integrate/kusdt-wallet/) |
| `window.kusdt`, the reference | [Wallet provider](/protocol/wallet-provider/) |
| Holding, reading and sending kUSDT | [Hold and send kUSDT](/integrate/kusdt-token/), [Wallets](/integrate/wallets/) |
| The builders | [The kusdt-tx CLI](/developers/kusdt-tx/) |
| The API | [Coordinator API](/protocol/coordinator-api/) |
| Bridging and swapping from your page | [Websites and apps](/integrate/websites/) |
| Deposits, withdrawals and pauses for an exchange | [Exchanges and custodians](/integrate/exchanges/) |
| When a transaction counts | [Finality](/protocol/finality/) |
| Burns and payouts | [Redemptions and releases](/protocol/redemptions-and-releases/) |

Questions go to the Telegram group [t.me/trestly](https://t.me/trestly). To report a vulnerability, don't post the
details there: say you have one and ask an admin for a private channel
([Audit status](/security/audit-status/#reporting-a-vulnerability)).
