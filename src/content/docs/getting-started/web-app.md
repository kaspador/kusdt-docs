---
title: The web app
description: "Trestly, the web app: what each section does, the two wallets it needs, and what it checks itself."
---

Trestly is the web app: the public front end of the bridge and the pool, a static single-page app in `bridge/web`.
It is built and tested against the local stack, and it runs on the public testnet at [testnet.trestly.io](https://testnet.trestly.io), with a faucet for test coins
([Test on the public testnet](/getting-started/public-testnet/)). On
mainnet it is at [trestly.io](https://trestly.io). Until the launch on 14 November 2026 is verified, trestly.io
shows a "Launching today" page; the Bridge, Swap, Pool and Reserves pages open there once it is. The addresses it
uses are published on [Status](/overview/status/#addresses) at the same time.

## Terms of Service

On a first visit the app shows a notice that it is experimental software, with links to these docs and to the
[Terms of Service](/reference/terms/), which are also at `/terms` in the app. To go on, tick **I have read and accept
the Terms of Service**: **I understand the risk** stays off until the box is ticked. The browser remembers which
version of the terms you accepted, so the notice does not come back, until a new version of the terms asks again.
**Not now** closes it for this visit only. The `/terms` page opens without the notice over it, so the terms can be
read first.

The [Privacy Policy](/reference/privacy/) is at `/privacy` in the app, linked from the footer next to the Terms of
Service. It also opens without the notice over it, and there is nothing to accept.

## Two wallets

The app never sees a key. It uses two wallets, one per side:

| Wallet | Signs | Used for |
|---|---|---|
| Your EVM wallet: one in this browser (found through EIP-6963, else `window.ethereum`), or a phone wallet through WalletConnect (a QR code from a computer). On a phone with no wallet in the browser, the page also offers links that open it inside MetaMask, Trust Wallet or Coinbase Wallet | Ethereum and BNB Chain transactions | Deposits |
| [kUSDT Wallet](/getting-started/wallet/), the browser extension, on a computer: it builds, shows and signs its own transactions. Other Kaspa wallets (KasWare, Kastle) are not supported | Kaspa transactions | Bridging back, swaps, liquidity |

Without kUSDT Wallet, every Kaspa-side action says where to get it. On a phone, where it can't run, the page says so: swapping, bridging back and the pool need a computer, and you can still bridge USDT to your Kaspa address (a normal one, `kaspa:q…`).

The header has one wallet button for both wallets: **Connect Wallet** until one is connected, then the marks of the networks in use and the portfolio's total. Its panel groups the wallets by what they are for (USDT on Ethereum and BNB Chain; KAS and kUSDT on Kaspa): each connected wallet with **Disconnect** beside its name, its address, to copy, its balances and, for the EVM wallet, the network it is on, then the portfolio's total and any wallet still to connect. The pages show one **Connect Wallet** button where an action needs a wallet; the wallets found are named only in this menu. A switch changes between day and night.

## Sections

| Section | What it does |
|---|---|
| **Main page** (`/`) | What Trestly does, and the way into each tool, with a live number for each |
| **Bridge** (`/bridge`) | One card in both directions, in the same order: From and To (only real routes), **You send** with ready amounts under it (10, 20, 50, 100, 500 and Max, greyed out above what you can send), **You receive on** the other network with the address it goes to (the connected wallet's, filled in), then what you pay and how long: the bridge fee, the network fee (ETH or BNB from the EVM wallet; 0.30 KAS and a small fee bridging back) and the time (from Ethereum about 15 to 20 minutes, its finality; from BNB Chain under a minute; back from Kaspa its finality and the vault's safety wait). The button names what you send: "Bridge 20 USDT from Ethereum". Limits, the fee rule and the safety wait are in its Details. The deposit fee is computed as the vault computes it, from values read from the vault itself; when the day's deposits have raised it above the usual rate, the form says so ([Fees](/protocol/fees/#the-rising-deposit-fee)). Bridging back, the address field is read-only while it shows the connected wallet's own address, until you press "Choose a different destination wallet". To Kaspa, it approves exactly the amount, calls `depositAtLeast` with the least kUSDT you accept (what the page showed, less a quarter of a percent where the fee can rise) and follows the bridge until it arrives, in a window you can close while a tag stays in the corner of the page, with a progress bar and the time left. Bridging back, it checks that the vault can pay now (from the vault's own pause, backing, allowance and queue, read over the chain's RPCs, on the form and again at the click) and would pay the address, then follows it until paid. See [Bridge USDT in](/getting-started/bridge-in/) and [Redeem kUSDT](/getting-started/redeem/) |
| **Swap** | Buy or sell kUSDT for KAS: what you pay, what you receive (quoted with the same core the covenant checks against), the max price change (0.1 %, 0.5 %, 1 % or your own) and the least you receive, the price, the 0.50 % swap fee, the KAS kept with your kUSDT and the network fee. kUSDT Wallet shows the network fee in its own window. The price impact, the fee split and the pool's checks are in its Details. See [Swap](/getting-started/swap/) |
| **Pool** | The pool's size, the KAS and kUSDT in it, its price and what it earns; add to the pool (kUSDT Wallet); your share of the pool, each position with Remove. Position IDs, share counts and the checks are in Details |
| **Portfolio** | What the connected wallets hold on Kaspa, Ethereum and BNB Chain: the total and each network's share, every asset, liquidity in KasPool, bridges on the way and the wallets. A network can be picked to see only what is there; each row leads to its next step (Bridge, Swap, Pool). USDT and kUSDT count as 1 dollar, KAS at the market price from api.kaspa.org (a dollar figure is an estimate, never a swap quote; with no price it says so and the total is marked incomplete), ETH and BNB at their Chainlink price feed |
| **Reserves** | Proof of reserves (INV-1): whether every kUSDT is backed, what is owed to kUSDT holders and held in the vaults, where the USDT is per network, and **Bridge status**: each network working or paused, and in its Details each route's time, fee and limit, the contracts, the kUSDT and pool IDs, and the public RPCs with whether they answer right now. The coordinator's figures, the page's own reads, the Kaspa record and the monitor's check are in Details. The page's own figure is the backing against minted less paid out, which a payout with no burn behind it lowers on both sides alike; only the monitor matches every payout with a burn, so the page says every kUSDT is backed only on the monitor's healthy answer, and a site with no monitor set up shows "Could not check everything" (since round 15; a mainnet site must name one). `/network` opens Bridge status |
| **Activity** | One list of what your wallets did, newest first: bridges to Kaspa sent by the connected EVM wallet or received by the connected Kaspa wallet (on any device), and bridges back, swaps and pool changes started in this browser. Each row says what moved from where to where, what you sent and what you get, and its status. Another address can be looked up |

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
- **The deployment**: the coordinator must name the page's covenant ID, pool ID, vaults, chains, tokens, decimals
  and KAS values, or the page says plainly that it serves another deployment and sends nothing: every action is off
  until they agree, and one already on its way asks your wallet for nothing more. On mainnet the page also starts only
  on the deployment its build pins, the one kUSDT Wallet pins: a `config.json` or `deployment.json` on the host that
  names another vault, token or kUSDT stops it at its start, with each difference named (since run 21, Daybreak [12]).
- **The recipient** of a redemption: the page asks the coordinator (`GET /recipients/:chain/:address`) before every
  burn and shows the reason inline under the address. It refuses an address the token blocks, the zero address and
  the vault's own, and it refuses too while the coordinator can't answer, asking again every 30 seconds. It never
  offers the other chain for a blocked address. See
  [Blocked recipients](/security/known-limits/#blocked-recipients).
- **The verdict**: an open monitor alarm or a minter state that fails its script check shows "A safety check failed"; a minter state the node doesn't confirm is asked about once more before it counts; numbers that disagree are read once more before they turn red; a monitor that can't be reached shows amber, never green.
- **A held payout**: the tracker shows a redemption the coordinator holds (`blocked`) as "Held …", with the time of
  the next check. A held refund shows the same way.
- **Whose address it is**: a WalletConnect session stored from an earlier visit never counts as your own address.
  Only a wallet that approved the connection during this visit does. Until then the bridge-back form offers
  "Connect again to use my wallet address", and Connect ends the stored session first, so your wallet has to
  approve now. Nothing the other end of a stored session sends changes that.
- **The form you clicked on**: a form is locked while its action runs, and before every signature the page checks
  that the form still shows what you clicked and that its page is still on screen. If you leave the page while an
  action runs (another page, Back, the same page opened again), your wallet is asked for nothing more for it, and a
  notice on every page says where it stopped: for a bridge to Kaspa, whether its approval was already sent (it stays
  in place for your next bridge; no USDT moved). The page cannot close a request your wallet is already showing: the notice tells you to
  reject it, and until the wallet has answered it, no new action starts from the site. If you approve it all the
  same, it is sent with the values you entered then, and the site says so and follows it as usual.
- **Dollar figures**: KAS is counted at the market price from api.kaspa.org, for display only. No transaction, quote
  or minimum is computed from it.

Amounts are exact integers end to end, including values above 2⁵³.

## Things that can surprise you

| You may notice | Why |
|---|---|
| You need two wallets | Bridging to Kaspa is an EVM transaction; everything on Kaspa is signed by kUSDT Wallet |
| You need KAS to redeem | A redemption's burn output carries 0.3 KAS, gone for good since nothing can spend a burn, plus the network fee. An ordinary kUSDT state carries 1.5 KAS, which comes back when it is spent (see [Storage mass](/kaspa/storage-mass/)) |
| An Ethereum deposit can take three prompts | Ethereum's USDT refuses to change a non-zero allowance, so the app first resets it to 0, then approves the exact amount, then deposits |
| Minimum release fees differ per chain | 5 USDT on Ethereum and 0.50 USDT on BNB Chain (see [Fees](/protocol/fees/)) |
| Position IDs look like `txid:index` | A position is a Kaspa UTXO, named by its transaction ID and output index |
| A swap or a pool action asks you to merge your KAS first | Since rc.22 a pool transaction takes at most 8 inputs, the pool's own coins among them, so a buy is paid from at most 6 of your KAS coins and a sale, a deposit or a withdrawal from at most 5 (the largest first). When those are not enough and all of your coins would be, kUSDT Wallet says so in its window before anything is signed: send all of your KAS to your own address (Send, KAS, Max; its Swap and Pool screens offer **Merge my KAS**), and once it is back as one coin, try again. The same when those coins would leave change too small for the network to keep, which would go to the network fee (since round 17): the wallet says how much, and a pool transaction that would give the network more than 0.05 KAS of change is not sent unless that fee was shown (its own Swap screen shows "up to" the fee its Max keeps); change the amount a little |
| A withdrawal says the deposit is not in a block yet | A position whose deposit is still in the mempool can be withdrawn only beside the pool state that deposit made. Once another trade has moved the pool, the pool takes the position only when the deposit is in a block (a few seconds): try again in a moment. Nothing is sent meanwhile |

## Tests

- 249 unit tests.
- An end-to-end suite on the live local stack, in Chromium.
- An end-to-end suite driving the real wallet extension: a swap, a deposit minted to the wallet, a redemption paid on
  chain, a blacklisted recipient refused.

## Hosting

`npm run build` in `bridge/web` writes a static `dist/`. Put a `config.json` next to `index.html` (the API URL, the
deployment, the EVM RPCs and optionally the monitor). Pages are plain paths (`/swap`), so the app goes at the root of a site. The build writes one HTML file per address, for link previews, so the host should answer `/swap` with `swap.html` and any other path that isn't a file with `index.html`. For WalletConnect, the site's domain must be on the allowed list of the Reown project named in `bridge/web/src/evm/walletconnect.ts`. Serve `.wasm` files as `application/wasm`. The details are in `bridge/web/README.md`.
