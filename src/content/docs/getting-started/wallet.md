---
title: The wallet
description: The kUSDT wallet extension, what it does, how it verifies what it shows, and how to hold kUSDT in any KCC-20 wallet.
---

kUSDT Wallet is a browser extension (Manifest V3) in `wallet/extension`. It is built and tested against the local stack, and it runs on the public testnet at [testnet.trestly.io](https://testnet.trestly.io). Its **mainnet version is published right after the launch** on 14 November 2026, and this page will link it then.

## Install

For Chromium browsers on a computer: Chrome, Brave and Edge. There is no phone version, and the web app says so on a phone.

The mainnet version is not linked yet: it is published right after the launch, and the link will be here. Until then, install no build that claims to be kUSDT Wallet from anywhere else.

To test, the testnet build is at
[testnet.trestly.io/downloads/kusdt-wallet-testnet.zip](https://testnet.trestly.io/downloads/kusdt-wallet-testnet.zip),
with a `.sha256` beside it. Load it in Chrome with developer mode, "Load unpacked". It works with test coins only;
never put a recovery phrase that holds real KAS into it ([Test on the public testnet](/getting-started/public-testnet/)).

kUSDT Wallet is the only Kaspa wallet the web app works with. KasWare is not supported. On the Ethereum and BNB
Chain side, the web app works with MetaMask and with WalletConnect.

## Terms of Service

Before you create or import a wallet, tick **I have read and accept the Terms of Service** on the first screen. The
link opens the [Terms of Service](/reference/terms/) in the web app (`https://trestly.io/terms` on Mainnet). The wallet stores which
version you accepted. A wallet set up before there were terms, or before their current version, shows the same box
once, when it is unlocked, before anything else. Until then no site gets an answer from it: a site that asks to
connect waits in the wallet's window, behind the terms, and any other request is refused with a message that says
the terms have not been accepted yet. Only the network's name is answered, as it is to any page.

Since wallet 0.9.21, at the bottom of **Settings**, under the version, the wallet links the Terms of Service and the
[Privacy Policy](/reference/privacy/) in the web app (`https://trestly.io/privacy` on Mainnet), each in a new tab.

## What it does

| Feature | Detail |
|---|---|
| KAS and kUSDT | Holds and sends KAS and kUSDT as standard KCC-20 states |
| Deposits | Bridges USDT in from Ethereum and BNB Chain through its own EVM side |
| Redemptions | Builds the burn with the right [burn owner](/protocol/burn-owner-and-payload/) and payload |
| Pool | Swaps KAS and kUSDT, adds and removes liquidity |
| Pages | Injects `window.kusdt`, so a page can ask the wallet to send, redeem, swap or provide liquidity. See [Wallet provider](/protocol/wallet-provider/) |

It was tested live against `npm run local:stack`: deposits on both chains, a send, a redemption through to its
release, swaps, and adding and removing liquidity. The live tests also blacklist an address with the dev faucet:
the wallet refuses it before any burn, and a burn built past the checks is held as `blocked` until the address is
taken off the list, then released. It also has 227 unit tests, a simnet test, live-stack tests and a browser smoke
test. Its README is `wallet/extension/README.md`.

## What it trusts, and what it checks

- **Your keys stay on your device.** The wallet builds every transaction itself with the WebAssembly builders,
  shows you what it does, signs and submits it. A page never sees a key.
- **It pins the deployment**: the kUSDT covenant ID, the pool's covenant ID and the vault addresses.
- **It takes nothing the coordinator says about a covenant state as fact.** Before a state is shown or spent, the
  wallet checks its fields, recomputes its locking script, and finds that exact outpoint on the Kaspa node with
  the same script and the pinned covenant ID. A token state that fails is dropped; a pool state that fails is
  refused. When the transaction that made the pool's kUSDT reserve also made the pool coin, the reserve is proven from
  that transaction, checked against its id, and the pool coin found on the node. See
  [Following covenant states](/architecture/following-states/).
- **It says what it could not check.** A node lists the coins at an address all at once or not at all, and anyone
  can send an address coins. kUSDT at an address the node cannot list is shown apart from your balance, as not
  checked, and the rest of your kUSDT is unaffected. Send can spend it when you tick its box: the node then
  decides, and nothing is sent unless that kUSDT is there exactly as the wallet recorded it. See
  [An address that holds too many coins](/security/known-limits/#an-address-that-holds-too-many-coins-cannot-be-listed).
- **It refuses burns the vault cannot pay now**: an amount, fee included, above the named vault's release capacity, its current
  `releaseAvailable` or its backing, a paused vault, or an amount at or below the release fee. One burn takes at most
  the capacity less what is queued and less 1 % of it, kept free for payouts that may be queued first: anyone can keep
  one tiny payout always waiting in a vault, and a burn needing all of the room would wait on it (since run 21 round 2,
  R21-ECON-2). Redeem more in two burns.
- **It refuses an address that names no key.** A Kaspa address carries a key (`kaspa:q…`): its bytes must be a point of
  the curve. One made with other bytes keeps a valid checksum, but nothing could ever spend what is sent to it, so Send
  and a site's send refuse it (since run 21 round 2, R21-CRYPTO-5).
- **One EVM RPC can't leave a deposit unmined, or make you pay more.** The wallet asks every RPC of the chain.
  It signs the highest base fee any names (and never less than the latest block's own), as a higher fee cap
  costs nothing: only the real base fee and the tip are paid. It takes the lowest tip, held to the lowest base fee named
  (3 gwei where that is lower) and never under 0.01 gwei (0.05 gwei on BNB Chain, its validators' minimum). When
  the RPCs name base fees far apart, the Bridge screen names both, beside the maximum it shows; an RPC naming one
  above what the wallet ever signs (500 gwei) stops the deposit, named, until it is removed under Network,
  Advanced.
- **It refuses a recipient the vault would not pay.** Before every burn it asks the coordinator
  (`GET /recipients/:chain/:address`), and it burns only when the answer, about exactly that chain and address,
  says `payable`. It also asks the token itself whether it blocks the address (`isBlackListed` on Ethereum USDT;
  BSC-USD keeps no blocklist), on each of the chain's RPCs, when it plans the burn and again right before it sends
  it, and it burns nothing if any of them says blocked or none answers. See
  [Blocked recipients](/security/known-limits/#blocked-recipients).

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

**A redemption that shows Sent and does not move:** open kUSDT Wallet for a moment. While its window is open (Home or
Activity), it sends the burn's claim to the coordinator again whenever the coordinator says it has no record of the
burn: at once, then a minute later, each wait twice the one before and at most six hours, twenty times in all. With the
window closed, or on the web app alone, it does not. A burn the Kaspa node did not answer about (**May have been
sent**) is claimed only once the node shows it accepted. See
[A burn the coordinator missed](/security/known-limits/#a-burn-the-coordinator-missed-is-claimed-again-only-while-kusdt-wallet-is-open).

## Holding kUSDT in another wallet

kUSDT's token code is the standard KCC-20 reference, compiled to the same bytes. A wallet that supports KCC-20
can therefore read kUSDT states without any kUSDT-specific code. See [The KCC20 template](/kaspa/kcc20-template/).

:::caution[Check the covenant ID]
Any token can call itself "kUSDT". What identifies kUSDT is its **covenant ID**. The mainnet one is published on
[Status](/overview/status/#addresses) once the launch is verified. Compare it before you accept or buy tokens
labelled kUSDT.
:::

kUSDT's genesis is to be reviewed by kascov.io. Wallets mark tokens whose genesis has not been
reviewed as "unvalidated", so kUSDT may show that label until the review is done.

## Test networks and real KAS

The wallet's Kaspa keys are the same on every network. For testing, use a recovery phrase that holds no real KAS.
On Testnet the wallet asks a mainnet node, before it signs a plain KAS send, that the coins it spends are not real
ones, and signs nothing if they are or if it cannot ask (see
[Known limits](/security/known-limits/#the-wallets-keys-are-the-same-on-test-networks-and-on-mainnet)).

## Fees in KAS

Every Kaspa transaction pays a network fee in KAS. Each kUSDT state also carries KAS for the storage it uses (see
[Storage mass](/kaspa/storage-mass/)):

| Output | KAS it carries | Comes back? |
|---|---|---|
| An ordinary kUSDT state | 1.5 KAS | Yes, when the state is spent |
| A redemption's burn output | 0.3 KAS | No: nothing can spend a burn, so it is gone for good |

Keep some KAS next to your kUSDT. With no other KAS than what sits under your kUSDT, the wallet still lets you
move all of it:

- **Send all of it.** The network fee is taken out of the KAS that travels with the tokens, so the recipient's
  kUSDT carries a little less than 1.5 KAS (about 0.99 KAS if yours carried 1 KAS). The review says so before you
  confirm. The wallet does not do this if it would leave the recipient's kUSDT with less than 0.6 KAS.
- **Redeem all of it**, or **sell all of it** on the pool: the KAS under it comes back to you, less the burn's
  0.3 KAS or the fee.
- **A part of it cannot be sent or redeemed**: what you keep goes into a coin of its own, which must hold 1.5 KAS
  of its own, and you have none to put there. The wallet says this before anything is signed, names about how much
  KAS is missing, and offers to send or redeem all of it instead. A small sale of a part is refused for the same
  kind of reason (see [Selling kUSDT](/getting-started/swap/#selling-kusdt)).

## KAS in many small coins

Your KAS sits in coins, one per payment you received. A pool transaction takes at most 8 inputs (since rc.22), its
own coins among them, so the wallet pays a buy or the pool's opening with at most 6 of your coins and a sale, a
deposit or a withdrawal with at most 5, the largest first. It funds with plain coins of your own address that are
already in a block, never with one still waiting in the mempool.

When those coins are not enough and all of yours would be, nothing is signed. The screen says how many coins your
KAS is in and offers **Merge my KAS**: Send opens with KAS, your own address and Max filled in, so all of it comes
back to you as one coin, less the network fee. Review it and send it as any other send, then try the swap or the
deposit again once it is in. A site's request shows the same words in the approval window; merge from the wallet's
Send screen (KAS, your own address, Max).

The same happens when those coins are enough but would leave change too small for the network to keep (under
0.2 KAS once the change's own storage is paid, more at a high feerate), which would go to the network fee: the
wallet first tries other coins within the 8 inputs, and when none keeps the change it says how much would be lost
and offers the merge (since round 17). A transaction that would still give the network more than 0.05 KAS of
change is not sent unless that fee was shown: with Max the fee row says "up to 0.3 KAS", what Max keeps for the
fee; any other amount gets "This would pay … KAS to the network, not the about … KAS shown", and nothing is sent.
Changing the amount a little brings the change back.

A withdrawal of a position whose deposit is still waiting in the mempool goes only beside the pool state that same
deposit made. If another trade has moved the pool since, the wallet says the deposit is not in a block yet and sends
nothing: try again in a few seconds.
