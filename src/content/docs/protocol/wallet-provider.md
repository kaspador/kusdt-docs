---
title: Wallet provider
description: The window.kusdt interface that the kUSDT wallet extension injects into web pages.
---

:::note[Mainnet version after the launch]
The wallet extension (`wallet/extension`) implements this interface and was tested against the local stack and the public testnet. Its testnet build is at [testnet.trestly.io](https://testnet.trestly.io/downloads/kusdt-wallet-testnet.zip), for testing pages against this interface ([Test on the public testnet](/getting-started/public-testnet/)). Its mainnet version comes right after the mainnet launch.
:::

The extension injects `window.kusdt`, an EIP-1193-style object:

```ts
window.kusdt.request({ method, params }): Promise<result>
window.kusdt.on(event, listener)
```

The wallet builds every transaction itself, from the WebAssembly transaction builders and the
[coordinator API](/protocol/coordinator-api/) data. It shows the user what the transaction does, signs it and
submits it. **The page never sees a key.**

## Methods

| Method | Params | Result |
|---|---|---|
| `kaspa_requestAccounts` | none | `[address]`, after the user approves the site |
| `kaspa_getNetwork` | none | `"mainnet"`, `"testnet-10"` or `"simnet"` |
| `kaspa_switchNetwork` | `{network}`: `"testnet-10"`, `"mainnet"` or `"simnet"` | the network the wallet is on afterwards |
| `kusdt_getBalances` | none | `{kas, kusdt}`, in sompi and base units |
| `kusdt_send` | `{to, amount}` | `{txid}` |
| `kusdt_redeem` | `{chain, address, amount}` | `{txid, redeemIds}` |
| `kusdt_swap` | `{side: "buy" or "sell", amountIn, minOut}` | `{txid, amountOut}` |
| `kusdt_addLiquidity` | `{kasIn, tokensIn}` | `{txid, shares}` |
| `kusdt_removeLiquidity` | `{position}` | `{txid}` |

Amounts are decimal strings (or safe integers) of the smallest unit. `params` may be the object itself or an
array whose first item is the object. Since run 21, `params` holding more than 4 096 characters, nested more than 4
deep, or holding anything but JSON values is answered `-32602` before it leaves the page.

Only `kaspa_getNetwork` answers any page. Every other method needs a site connected on the wallet's current
network (`kaspa_requestAccounts`); connections are per network. Sending, redeeming, swapping and liquidity open the wallet's own window, every time. So does switching the network, unless the wallet is already there or nothing is deployed there.
The window acts on the network the request was asked on, which it names: a request asked before the wallet switched
is refused, and one the window shows is built on that network's node, coordinator and contracts even if the wallet
switches meanwhile (since run 21).

The window's Approve button answers only a second after the window is shown, focused and in view, and that second
starts again on every press of the pointer or of a key, on losing focus or sight, and on the pointer coming in: a
page that keeps its visitor clicking or typing never has it clicked unread. A click the keyboard makes (Enter or
Space on Approve) counts only once Approve has held the focus for that second with no other key pressed (since run
21 round 2, R21-W2-1): Tab, Tab, Enter typed into a page does not approve.

What a server says (the coordinator's error, an EVM RPC's refusal, the coordinator's reason for not paying an address)
is shown as that server's, in quotes, cut to 200 characters and without the characters that reverse how text reads;
the wallet never shows it as its own words (since run 21 round 2, R21-W2-5).

Until the wallet has accepted the current [Terms of Service](/reference/terms/) (since wallet 0.9.20), no site counts
as connected: `kaspa_requestAccounts` opens the wallet's window, which shows the terms first and the request once they
are accepted, and every other method but `kaspa_getNetwork` is answered `4100` with the message "kUSDT Wallet's Terms
of Service have not been accepted yet. Open kUSDT Wallet, read and accept them, then try again."

A locked wallet tells no site its account or balances, and reads nothing for them (since run 21):

- A connected site's `kusdt_getBalances` is answered `4100` with the message "kUSDT Wallet is locked. Unlock it, then
  try again." and `data: { locked: true }`. The site is still connected: a page tells this from "not connected" by
  `data.locked` (window.kusdt's error carries `data`), keeps its connection and says the wallet is locked.
- A connected site's `kaspa_requestAccounts` opens the wallet's window, which asks for the password and then answers
  the account the site already has, with no new approval.
- When the wallet is unlocked, each connected site's tab hears `accountsChanged` with its account, so a page picks it up
  without a click.

The other methods are answered as before; a signing request opens the wallet's window, which asks for the password
first.

Each site's requests wait in a queue of that site's own and are answered in the order sent, so one site sending
many requests never holds up another. A site, and a tab, has at most 8 requests waiting at a time: one more is
answered `-32002` at once, and so is a request that waited 45 s for the site's earlier ones. `kusdt_getBalances`
asked again within a second gets the same answer as the one before, and one the wallet can't read within 30 s is
answered `-32603` (try again). It is read on the network the site was checked against, whatever the wallet switches
to meanwhile (since run 21). A request from a tab that closed is dropped, and so is one from a page that navigated
away. Since run 21 that holds for the request the wallet's window is open for as well: the window closes and the site
hears `4001`. The window holds a request for at most 5 minutes: after that the next site's request takes its place
(the first site hears `4001`), and the window can no longer approve it.

## Switching the network

A page made for one network asks the wallet to move there:

```ts
const now = await window.kusdt.request({ method: 'kaspa_switchNetwork', params: { network: 'simnet' } });
// 'simnet' once the user approved
```

- **Already there**: the wallet answers the network at once, with no window.
- **Otherwise** it opens its "Switch network" window, naming the site and both networks (for example
  Mainnet → Local). Nothing changes unless the user approves there.
- **Approved**: the wallet switches, and the site **stays connected** on the new network, with the wallet's
  account there, so the page needs no new connection prompt. Every tab then hears `networkChanged` (the new
  network) and `accountsChanged` (the site's account there, or `[]` for a site not connected there), exactly as
  when the user switches in the wallet itself.
- Only the wallet's three presets can be asked for. A page can't add a network, and the wallet never takes a
  deployment from a page.

| Code | Meaning |
|---|---|
| `4100` | The site isn't connected on the wallet's current network: connect first |
| `4001` | The user rejected the switch, or closed the window |
| `4200` | Nothing is deployed on that network in this wallet (Mainnet today); the message says so |
| `-32002` | Another site's request is open in the wallet's window (for at most 5 minutes), the site, or its browser tab under any of its names, was declined three times in two minutes and waits a minute (another tab is not held), or the site already has 8 requests waiting (try again) |
| `-32602` | Malformed params, or a name that isn't one of the presets. A wallet without `kaspa_switchNetwork` answers the same, so a page reads it as "switch in the wallet's own settings" |

## The pool

`kusdt_swap`, `kusdt_addLiquidity` and `kusdt_removeLiquidity` are built on the pool's newest verified state
([KasPool](/contracts/kaspool/)):

- **A paused pool** takes no swaps and no new liquidity: the window says so and Approve stays off. Removing
  liquidity stays open.
- **The circuit breaker**: a sell that would take more KAS out of the pool than its window still allows is
  refused before anything is built. The window shows what sells may still take out, roughly when the window
  reopens, and the largest sell that fits.
- **No silent worse price**: if the pool moves before the transaction lands, the wallet quotes again. It goes
  ahead on its own only if the new quote is at least the one the user approved; for less it sends nothing and
  shows the new numbers for the user to approve again. `minOut` stays the hard floor.
- **A buy shows the KAS its kUSDT keeps**: the kUSDT bought sits in a token coin of its own, which carries the
  deployment's token value (1.5 KAS) besides what is paid. The window shows it as "Kept in your token", as the Swap
  screen does (since run 21, R21-WALLET-2): it stays the user's, and goes with that kUSDT when it is sent on. A sale of
  a part of a kUSDT coin, and every deposit, leave a change coin that keeps the same 1.5 KAS: shown as "Kept in your
  token (change)", with how much of it comes from your KAS when the coin spent carried less (R21-W2-3).
- **A deposit puts in at most what the window showed**: the window shows the site's `kasIn` and `tokensIn`
  trimmed to the pool's ratio (only what the shares need; the rest stays in the wallet), and those shown amounts
  are what the wallet deposits. If the pool moved first, they buy fewer shares, so the wallet asks again; it never
  puts in more of either side than shown (since run 20, PUB20-1). A pool that moved more than 5 % off the shown
  amounts' ratio is refused, and the site can ask again.
- **The network fee is shown and held** (since round 15): the window shows about what the transaction pays the
  network, at the feerate the wallet's Kaspa node names then (80 000 grams at that feerate, above what a swap or a
  deposit measures), and warns when that is more than a tenth of the KAS it moves. Should the node name a feerate
  more than half as much again by the time the transaction is built, nothing is sent and the request fails with
  that reason. The Swap and Pool screens show and hold the same figure. Since run 21 (Daybreak [9]) so are the
  merges a sale or a deposit may need first, when the kUSDT is spread over more states than one transaction takes:
  each is held to that feerate before it is signed, so a node naming more stops the request before any merge goes
  out.
- **What went out is said**: merges go out before the request's own transaction, and each is put in Activity. If
  the request then stops (the pool moved, or the node's feerate rose for the last transaction), the window says how
  many merges went out and that they only joined the user's own kUSDT, which is still theirs; it never says that
  nothing was sent. The site gets the same words in the error.

## Events

| Event | When |
|---|---|
| `accountsChanged` | The wallet's accounts change, a switch leaves the site connected with its account on the new network, or the wallet is unlocked (each connected site hears its account) |
| `networkChanged` | The wallet's network changes, from its own settings or an approved `kaspa_switchNetwork` |

Each event goes only to pages of the site it was meant for: a tab that has moved to another site by the time the
event arrives does not hear it (since run 21).

## The EVM side

Deposits happen on Ethereum or BNB Chain, so a page uses the user's EVM wallet for them (EIP-1193, EIP-6963 or
WalletConnect). The extension also offers one.
