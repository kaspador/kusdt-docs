---
title: Wallet provider
description: The window.kusdt interface that the kUSDT wallet extension injects into web pages.
---

:::note[Built, not released]
The wallet extension (`wallet/extension`) implements this interface and was tested against the local stack. A testnet build can be downloaded; it is not in any store yet.
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
array whose first item is the object.

Only `kaspa_getNetwork` answers any page. Every other method needs a site connected on the wallet's current
network (`kaspa_requestAccounts`); connections are per network. Sending, redeeming, swapping and liquidity open the wallet's own window, every time. So does switching the network, unless the wallet is already there or nothing is deployed there.

## Switching the network

A page made for one network asks the wallet to move there:

```ts
const now = await window.kusdt.request({ method: 'kaspa_switchNetwork', params: { network: 'simnet' } });
// 'simnet' once the user approved
```

- **Already there**: the wallet answers the network at once, with no window.
- **Otherwise** it opens its "Switch network" window, naming the site and both networks (for example
  Testnet → Local). Nothing changes unless the user approves there.
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
| `-32002` | Another wallet window is open, or the site was declined three times in two minutes and waits a minute |
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

## Events

| Event | When |
|---|---|
| `accountsChanged` | The wallet's accounts change, or a switch leaves the site connected with its account on the new network |
| `networkChanged` | The wallet's network changes, from its own settings or an approved `kaspa_switchNetwork` |

## The EVM side

Deposits happen on Ethereum or BNB Chain, so a page uses the user's EVM wallet for them (EIP-1193, EIP-6963 or
WalletConnect). The extension also offers one.
