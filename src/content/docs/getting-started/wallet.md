---
title: The wallet
description: The kUSDT wallet extension, what it does, how it verifies what it shows, and how to hold kUSDT in any KCC-20 wallet.
---

kUSDT Wallet is a browser extension (Manifest V3) in `wallet/extension`. It is built and tested against the local stack and the public testnet. A testnet build can be downloaded; it is **not in any store yet**.

## Install

For Chromium browsers on a computer: Chrome, Brave and Edge. There is no phone version, and the web app says so on a phone.

1. Download [kusdt-wallet-testnet.zip](https://testnet.trestly.io/downloads/kusdt-wallet-testnet.zip) from
   `https://testnet.trestly.io/downloads/kusdt-wallet-testnet.zip`.
2. Unzip it.
3. Open `chrome://extensions`.
4. Turn on **Developer mode**.
5. Click **Load unpacked** and pick the unzipped folder.
6. Pin the extension.

It starts on Testnet. To try it end to end, see [Test on the public testnet](/getting-started/public-testnet/).

## What it does

| Feature | Detail |
|---|---|
| KAS and kUSDT | Holds and sends KAS and kUSDT as standard KCC-20 states |
| Deposits | Bridges USDT in from Ethereum and BNB Chain through its own EVM side. On testnet its Bridge tab has "Get 1,000 test USDT" |
| Redemptions | Builds the burn with the right [burn owner](/protocol/burn-owner-and-payload/) and payload |
| Pool | Swaps KAS and kUSDT, adds and removes liquidity |
| Pages | Injects `window.kusdt`, so a page can ask the wallet to send, redeem, swap or provide liquidity. See [Wallet provider](/protocol/wallet-provider/) |

It was tested live against `npm run local:stack`: deposits on both chains, a send, a redemption through to its
release, swaps, and adding and removing liquidity. The live tests also blacklist an address with the dev faucet:
the wallet refuses it before any burn, and a burn built past the checks is held as `blocked` until the address is
taken off the list, then released. It also has 123 unit tests, a simnet test, live-stack tests and a browser smoke
test. Its README is `wallet/extension/README.md`.

## What it trusts, and what it checks

- **Your keys stay on your device.** The wallet builds every transaction itself with the WebAssembly builders,
  shows you what it does, signs and submits it. A page never sees a key.
- **It pins the deployment**: the kUSDT covenant ID, the pool's covenant ID and the vault addresses.
- **It takes nothing the coordinator says about a covenant state as fact.** Before a state is shown or spent, the
  wallet checks its fields, recomputes its locking script, and finds that exact outpoint on the Kaspa node with
  the same script and the pinned covenant ID. A token state that fails is dropped; a pool state that fails is
  refused. See [Following covenant states](/architecture/following-states/).
- **It refuses burns the vault cannot pay now**: a payout above the named vault's release capacity or current
  `releaseAvailable`, an amount above its backing, a paused vault, or an amount at or below the release fee.
- **It refuses a recipient the vault would not pay.** Before every burn it asks the coordinator
  (`GET /recipients/:chain/:address`), and it burns only when the answer, about exactly that chain and address,
  says `payable`. See [Blocked recipients](/security/known-limits/#blocked-recipients).

## Checking the recipient

What you see on the redeem screen:

| Case | What the wallet does |
|---|---|
| The token blocks the address | An amber notice: "USDT on <chain> blocks this address: a payout there would be frozen, so the vault pays nothing to it. Use another address." Review stays off |
| The zero address or the vault's own | "The <chain> vault won't pay this address (…)". It refuses without asking |
| The coordinator can't answer | "Couldn't check the recipient with the coordinator, so nothing was burnt…", with a **Check again** button |
| Right before sending | It asks once more, whatever the screen showed |
| The other chain | Offered only when that chain's vault would pay the address too. A blocked address is never steered to the other chain |

**Activity** shows a redemption or a refund the coordinator holds (`blocked`) as held. It is paid automatically if
the token unblocks the address.

## Holding kUSDT in another wallet

kUSDT's token code is the standard KCC-20 reference, compiled to the same bytes. A wallet that supports KCC-20
can therefore read kUSDT states without any kUSDT-specific code. See [The KCC20 template](/kaspa/kcc20-template/).

:::caution[Check the covenant ID]
Any token can call itself "kUSDT". What identifies kUSDT is its **covenant ID**. On testnet (TN10) it is
`6711958e2bc51c590426037020d9683ebd5daf42593de1797b65d25b92566314`; the mainnet one is **to be published**.
Compare it before you accept or buy tokens labelled kUSDT.
:::

Before mainnet, kUSDT's genesis is to be reviewed by kascov.io. Wallets mark tokens whose genesis has not been
reviewed as "unvalidated", so kUSDT may show that label until the review is done.

## Fees in KAS

Every Kaspa transaction pays a network fee in KAS. Each kUSDT state also carries KAS for the storage it uses (see
[Storage mass](/kaspa/storage-mass/)):

| Output | KAS it carries | Comes back? |
|---|---|---|
| An ordinary kUSDT state | 1.5 KAS | Yes, when the state is spent |
| A redemption's burn output | 0.3 KAS | No: nothing can spend a burn, so it is gone for good |

Keep some KAS next to your kUSDT.
