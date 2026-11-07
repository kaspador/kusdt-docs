---
title: The web app
description: "Trestly, the web app: what each section does, the two wallets it needs, and what it checks itself."
---

Trestly is the web app: the public front end of the bridge and the pool: a static single-page app in `bridge/web`. It is
built and tested against the local stack and the testnet. On testnet it is public at
[trestly.io](https://trestly.io), built with `bridge/web/config/testnet.public.json`. Its mainnet
URL is **to be published**. To try it, see [Test on the public testnet](/getting-started/public-testnet/).

## Two wallets

The app never sees a key. It uses two wallets, one per side:

| Wallet | Signs | Used for |
|---|---|---|
| Your EVM wallet: one in this browser (found through EIP-6963, else `window.ethereum`), or a phone wallet through WalletConnect (a QR code from a computer). On a phone with no wallet in the browser, the page also offers links that open it inside MetaMask, Trust Wallet or Coinbase Wallet | Ethereum and BNB Chain transactions | Deposits |
| [kUSDT Wallet](/getting-started/wallet/) (the browser extension, on computers only) | Kaspa transactions, which it builds, shows and signs itself | Redemptions, swaps, liquidity |

Without the extension, every Kaspa-side action explains how to get it. On a phone, where it can't run, the page says so: swaps, redemptions and liquidity need a computer, and you can still bridge USDT in to any Kaspa address.

The header has one **Connect Wallet** menu for both wallets. A connected wallet shows as a chip, whose popup has its address, to copy, and its balances. A switch changes between day and night.

## Sections

| Section | What it does |
|---|---|
| **Main page** (`/`) | What Trestly does, and the way into each tool, with a live number for each |
| **Bridge** (`/bridge`) | One card with From, To and Amount. To Kaspa, it deposits USDT into the vault: approves exactly the amount, calls `deposit`, then follows the deposit until it is minted, in a window you can close while a tag stays in the corner of the page. On testnet it also has "Get 1,000 test USDT" (MockUSDT's open mint, paid with gas from your EVM account). From Kaspa, it redeems kUSDT through the wallet, after checking that the named vault can pay it now and would pay the address, and follows it until paid. See [Bridge USDT in](/getting-started/bridge-in/) and [Redeem kUSDT](/getting-started/redeem/) |
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
- **The covenant states**: on the public testnet the page also asks a public Kaspa node whether the pool, reserve and minter states are unspent, instead of taking the coordinator's word.
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
| Minimum release fees differ per chain | On mainnet, 5 USDT on Ethereum and 0.50 USDT on BNB Chain; on the testnet, 0.50 USDT on both (see [Fees](/protocol/fees/)) |
| Position IDs look like `txid:index` | A position is a Kaspa UTXO, named by its transaction ID and output index |

## Tests

| Suite | Count |
|---|---|
| Unit tests | 133 |
| End to end on the live local stack, in Chromium | 160 |
| End to end driving the real wallet extension: a swap, a deposit minted to the wallet, a redemption paid on chain, a blacklisted recipient refused | 25 |

## Hosting

`npm run build` in `bridge/web` writes a static `dist/`. Put a `config.json` next to `index.html` (the API URL, the
deployment, the EVM RPCs and optionally the monitor). Pages are plain paths (`/swap`), so the app goes at the root of a site. The build writes one HTML file per address, for link previews, so the host should answer `/swap` with `swap.html` and any other path that isn't a file with `index.html`. For WalletConnect, the site's domain must be on the allowed list of the Reown project named in `bridge/web/src/evm/walletconnect.ts`. Serve `.wasm` files as `application/wasm`. The details are in `bridge/web/README.md`.
