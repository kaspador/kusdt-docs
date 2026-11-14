---
title: Integrate with Trestly
description: What a wallet, a website, an exchange or a custodian can integrate with kUSDT and the bridge, which network it runs on today, and where to ask.
---

:::caution[Mainnet, not audited]
kUSDT launches on mainnet (Kaspa mainnet, Ethereum and BNB Chain) on 14 November 2026, with real USDT. The
deployment's vaults, covenant ID, pool ID and API address are published on [Status](/overview/status/#addresses)
once the launch is verified. Nothing has been independently audited, and a legal review is open
([Audit status](/security/audit-status/)). Test on the public testnet first
([Test on the public testnet](/getting-started/public-testnet/)).
:::

These guides are for teams that want to support kUSDT or send their users to the bridge. Each one is short and links
to the reference pages for the details.

## Start here

New to kUSDT? Read the [Developer guide](/integrate/developer-guide/) first. It explains the three ways to
integrate and what to test on the public testnet, and leads to two step-by-step pages:

- [Connect kUSDT Wallet to your site](/integrate/kusdt-wallet/): detect `window.kusdt`, connect, read balances, ask
  for a kUSDT send or a redemption, follow network changes and handle errors, with JavaScript examples.
- [Hold and send kUSDT](/integrate/kusdt-token/): for wallets and services with their own keys. Identify kUSDT by its
  covenant ID, read and check balances, and build transfers and redemptions with `@kusdt/core` or `kusdt-tx`.

## What you can integrate

| You want to | Guide | Reference |
|---|---|---|
| Learn the ways to integrate, and test them | [Developer guide](/integrate/developer-guide/) | [Test on the public testnet](/getting-started/public-testnet/) |
| Let your site use kUSDT Wallet | [Connect kUSDT Wallet to your site](/integrate/kusdt-wallet/) | [Wallet provider](/protocol/wallet-provider/) |
| Hold, check and send kUSDT with your own keys | [Hold and send kUSDT](/integrate/kusdt-token/) | [The kusdt-tx CLI](/developers/kusdt-tx/), [Coordinator API](/protocol/coordinator-api/) |
| Show and send kUSDT in a wallet | [Wallets](/integrate/wallets/) | [KCC-20 tokens](/concepts/kcc20-tokens/), [The kusdt-tx CLI](/developers/kusdt-tx/) |
| Let your site's users bridge USDT, swap or redeem | [Websites and apps](/integrate/websites/) | [The web app](/getting-started/web-app/), [Wallet provider](/protocol/wallet-provider/) |
| Take kUSDT deposits, pay kUSDT out, hold it for users | [Exchanges and custodians](/integrate/exchanges/) | [Finality](/protocol/finality/), [Reserves](/protocol/coordinator-api/#calls) |
| Quote and build KAS⇄kUSDT swaps through KasPool | [Websites and apps](/integrate/websites/#pool-swaps) | [KasPool](/contracts/kaspool/), [Swap](/getting-started/swap/) |
| Read the bridge's state: is it paused, is it backed | [Reading the bridge's state](/integrate/bridge-state/) | [Coordinator API](/protocol/coordinator-api/), [The monitor](/security/monitor/) |
| Tell your users what can go wrong | [Risks to tell your users](/integrate/risks/) | [Known limits](/security/known-limits/), [Threat model](/security/threat-model/) |
| Use the name and the logo | [Brand and media kit](/reference/media-kit/) | |

## The parts, in one line each

- **kUSDT** is a KCC-20 token on Kaspa Layer 1, with 6 decimals. Its covenant ID is its identity: any token can call
  itself "kUSDT". See [The kUSDT token family](/contracts/kusdt-token/).
- **The vaults**, one on Ethereum and one on BNB Chain, hold the USDT. A deposit there is minted as kUSDT on Kaspa;
  a kUSDT burn on Kaspa is paid out by a vault. See [Deposits and mints](/protocol/deposits-and-mints/) and
  [Redemptions and releases](/protocol/redemptions-and-releases/).
- **KasPool** is the KAS⇄kUSDT pool on Kaspa L1. See [KasPool](/contracts/kaspool/).
- **The coordinator's API** is a public, read-mostly JSON API. Nothing in it moves funds. See
  [Coordinator API](/protocol/coordinator-api/).
- **The monitor** watches every chain and pauses the bridge on any alarm. The two mainnet monitors run on closed machines
  and publish only their read-only status, through Cloudflare tunnels. To know whether the bridge is paused, read their
  signal, and each vault's `paused()` and the minter's and the pool's state on Kaspa. See [The monitor](/security/monitor/).
- **kUSDT Wallet** is the browser extension. It injects `window.kusdt` for sites. See
  [The wallet](/getting-started/wallet/).

## Where things are today

| Item | Where |
|---|---|
| Networks | Kaspa mainnet, Ethereum (chain ID 1) and BNB Chain (chain ID 56) ([Networks](/protocol/identifiers-and-units/#networks)) |
| Web app | `https://trestly.io`, which opens once the launch is verified |
| Coordinator API | The address on [Status: Addresses](/overview/status/#addresses), published once the launch is verified |
| Monitor status | Two, read-only, at the addresses on [Status: Addresses](/overview/status/#addresses) once the launch is verified (their machines are closed; the status goes out through Cloudflare tunnels). Read both, and the vaults' `paused()` and the minter's and the pool's state. The public testnet's is at `https://testnet.trestly.io/monitor/health` |
| Covenant IDs, the pool, the vaults | [Status: Addresses](/overview/status/#addresses), the API's [`GET /status`](/protocol/coordinator-api/#calls), and the web app's Bridge status (`/network`) |

No mainnet address is written into these pages. Don't copy one into your code from anywhere else: read the IDs and
addresses from `GET /status` and check them against [Status](/overview/status/#addresses), or make them a setting.

To try everything before you go to mainnet, use the public testnet at
[testnet.trestly.io](https://testnet.trestly.io) (API `https://testnet.trestly.io/api/v1`, a testnet build of the
wallet and a faucet): see [Test on the public testnet](/getting-started/public-testnet/). You can also run the whole
stack on your own machine: [Run the simnet flow](/developers/simnet/) and [Build and test](/developers/build-and-test/).

## Where to ask

Ask in the Telegram group [t.me/trestly](https://t.me/trestly). It is also the security contact: to report a
vulnerability, don't post the details there, say you have one and ask an admin for a private channel
([Audit status](/security/audit-status/#reporting-a-vulnerability)).
