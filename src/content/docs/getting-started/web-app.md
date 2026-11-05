---
title: The web app
description: The kUSDT web app, what each section does, the two wallets it needs, and what it checks itself.
---

The web app is the public front end of the bridge and the pool: a static single-page app in `bridge/web`. It is
built and tested against the local stack and the testnet. On testnet it is public at
[kastools.com](https://kastools.com), built with `bridge/web/config/testnet.public.json`. Its mainnet
URL is **to be published**. To try it, see [Test on the public testnet](/getting-started/public-testnet/).

## Two wallets

The app never sees a key. It uses two wallets, one per side:

| Wallet | Signs | Used for |
|---|---|---|
| Your EVM wallet (found through EIP-6963, else `window.ethereum`) | Ethereum and BNB Chain transactions | Deposits |
| [kUSDT Wallet](/getting-started/wallet/) (the browser extension) | Kaspa transactions, which it builds, shows and signs itself | Redemptions, swaps, liquidity |

Without the extension, every Kaspa-side action explains how to get it.

## Sections

| Section | What it does |
|---|---|
| **Bridge → Kaspa** | Deposits USDT into the vault: approves exactly the amount, calls `deposit`, then follows the deposit until it is minted. On testnet it also has "Get 1,000 test USDT" (MockUSDT's open mint, paid with gas from your EVM account). See [Bridge USDT in](/getting-started/bridge-in/) |
| **Bridge → EVM** | Redeems kUSDT through the wallet, after checking that the named vault can pay it now and would pay the address, and follows it until paid. See [Redeem kUSDT](/getting-started/redeem/) |
| **Swap** | Quotes exactly with the same core the covenant checks against, shows the 0.30 % fee, the price impact and your slippage setting. See [Swap](/getting-started/swap/) |
| **Pool** | Reserves, price and TVL; add liquidity, list your positions, remove one |
| **Reserves** | Proof of reserves (INV-1): the coordinator's figures next to the page's own reads and the monitor's check |
| **Activity** | Deposits by EVM sender or Kaspa recipient; redemptions, swaps and liquidity started from this browser |
| **Network** | The pinned deployment, whether the coordinator serves it, vaults and minter (paused or not), signers |

## What the page checks itself

Where the page can check something, it does not take the coordinator's word for it:

- **Vaults** are read over the configured EVM RPCs, not through your wallet: fees and limits, `paused()`,
  `backing()` and `releaseAvailable()`. For reserves, `backing()` is read from every configured RPC and they must
  agree. Released amounts are summed from each vault's own `Released` events.
- **The minter state** is checked against its own locking script; minted = genesis `remaining` − the minter's
  `remaining`.
- **The pool** answer must hash to its UTXO's script, the UTXO must hold `base_value + X + protocol_kas`, and the
  reserve must be the kUSDT state that pool state implies. A pool answer that fails a check is shown, explained,
  and not offered for swaps.
- **The deployment**: the coordinator must name the pinned covenant ID, pool ID and vaults, or the page says
  plainly that it serves another deployment.
- **The recipient** of a redemption: the page asks the coordinator (`GET /recipients/:chain/:address`) before every
  burn and shows the reason inline under "Pay to". It refuses an address the token blocks, the zero address and
  the vault's own, and it refuses too while the coordinator can't answer, asking again every 30 seconds. It never
  offers the other chain for a blocked address. See
  [Blocked recipients](/security/known-limits/#blocked-recipients).
- **A held payout**: the tracker shows a redemption the coordinator holds (`blocked`) as "Held …", with the time of
  the next check. A held refund shows the same way.

Amounts are exact integers end to end, including values above 2⁵³.

## Things that can surprise you

| You may notice | Why |
|---|---|
| You need two wallets | Deposits are EVM transactions; everything on Kaspa is signed by kUSDT Wallet |
| You need KAS to redeem | A redemption's burn output carries 0.3 KAS, gone for good since nothing can spend a burn, plus the network fee. An ordinary kUSDT state carries 1.5 KAS, which comes back when it is spent (see [Storage mass](/kaspa/storage-mass/)) |
| An Ethereum deposit can take three prompts | Ethereum's USDT refuses to change a non-zero allowance, so the app first resets it to 0, then approves the exact amount, then deposits |
| Minimum release fees differ per chain | 5 USDT on Ethereum, 0.50 USDT on BNB Chain (see [Fees](/protocol/fees/)) |
| Position IDs look like `txid:index` | A position is a Kaspa UTXO, named by its transaction ID and output index |

## Tests

| Suite | Count |
|---|---|
| Unit tests | 72 |
| End to end on the live local stack, in Chromium | 73 |
| End to end driving the real wallet extension: a swap, a deposit minted to the wallet, a redemption paid on chain, a blacklisted recipient refused | 14 |

## Hosting

`npm run build` in `bridge/web` writes a static `dist/`. Put a `config.json` next to `index.html` (the API URL, the
deployment, the EVM RPCs and optionally the monitor). Routes are hash routes, so the app works on any static host
and under a sub-path. Serve `.wasm` files as `application/wasm`. The details are in `bridge/web/README.md`.
