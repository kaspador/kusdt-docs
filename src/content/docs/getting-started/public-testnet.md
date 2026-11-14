---
title: The public testnet (ended)
description: The kUSDT public testnet ran from 4 to 14 November 2026 on Kaspa testnet-10, Sepolia and BSC testnet. It has ended; kUSDT is on mainnet.
---

The public testnet ran from 4 November to 14 November 2026. It has ended. kUSDT launches on mainnet on
14 November 2026.

## What it was

The whole bridge and the pool ran on test networks: Kaspa testnet-10 (TN10), Sepolia and BSC testnet, with test
coins that had no value. Anyone could install a testnet build of kUSDT Wallet, take test USDT from a faucet, bridge
it in, swap, add liquidity and redeem. It was there to try every flow end to end, with real wallets and real
networks, before mainnet, and to find what the local tests had missed.

## What no longer works

- The testnet site, its API, its monitor and its faucet are gone. `testnet.trestly.io` now redirects to
  [trestly.io](https://trestly.io).
- Test kUSDT, MockUSDT and the testnet vaults and pool are no longer served by anything. Test coins have no value,
  and nothing will exchange them.
- The testnet build of kUSDT Wallet no longer has a bridge or a pool to talk to. Remove it, and never put a recovery
  phrase that holds real KAS into a test build.

## Where to go now

| For | Go to |
|---|---|
| The web app | [trestly.io](https://trestly.io): it shows a "Launching today" page until the launch is verified, then the Bridge, Swap, Pool and Reserves pages |
| The mainnet addresses | [Status: Addresses](/overview/status/#addresses), published once the launch is verified |
| Bridging in and out | [Bridge USDT in](/getting-started/bridge-in/) and [Redeem kUSDT](/getting-started/redeem/) |
| The wallet | [The wallet](/getting-started/wallet/): its mainnet version is published right after the launch |
| The risks | [Audit status](/security/audit-status/) and [Known limits](/security/known-limits/). No independent audit has been done |
