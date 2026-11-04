---
title: Wallet provider
description: The window.kusdt interface that the kUSDT wallet extension injects into web pages.
---

:::note[Built, not released]
The wallet extension (`wallet/extension`) implements this interface and was tested against the local stack. It is
not released to any store yet.
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
| `kusdt_getBalances` | none | `{kas, kusdt}`, in sompi and base units |
| `kusdt_send` | `{to, amount}` | `{txid}` |
| `kusdt_redeem` | `{chain, address, amount}` | `{txid, redeemIds}` |
| `kusdt_swap` | `{side: "buy" or "sell", amountIn, minOut}` | `{txid, amountOut}` |
| `kusdt_addLiquidity` | `{kasIn, tokensIn}` | `{txid, shares}` |
| `kusdt_removeLiquidity` | `{position}` | `{txid}` |

## Events

| Event | When |
|---|---|
| `accountsChanged` | The wallet's accounts change |
| `networkChanged` | The wallet's network changes |

## The EVM side

Deposits happen on Ethereum or BNB Chain, so a page uses the user's EVM wallet for them (EIP-1193, EIP-6963 or
WalletConnect). The extension also offers one.
