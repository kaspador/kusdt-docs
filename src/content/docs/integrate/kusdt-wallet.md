---
title: Connect kUSDT Wallet to your site
description: Detect kUSDT Wallet, connect, read KAS and kUSDT balances, ask for a kUSDT send or a redemption, follow network changes and handle the wallet's errors, with JavaScript examples.
---

:::caution[Mainnet, not audited]
kUSDT launches on mainnet on 14 November 2026, with real USDT. Nothing has been independently audited, and a legal
review is open ([Audit status](/security/audit-status/)). Build and test your page against the public testnet first
([Test on the public testnet](/getting-started/public-testnet/)).
:::

kUSDT Wallet is a browser extension for Chrome, Brave and Edge on a computer. It puts one object into your page,
`window.kusdt`. Your page asks it for things; the wallet builds every transaction itself, shows it to the user in
its own window, and signs and sends it only when the user approves. **Your page never sees a key**, and cannot ask
for a raw signature.

This page walks through it with examples. The full reference, with every rule, is
[Wallet provider](/protocol/wallet-provider/). The wallet's source is in the open repository
([github.com/kaspador/kusdt-open](https://github.com/kaspador/kusdt-open)), under `wallet/extension/src/provider/`
(what a page may ask) and `wallet/extension/src/background/provider.ts` (how it is answered).

## The interface

```ts
window.kusdt.isKusdtWallet            // true
window.kusdt.request({ method, params }): Promise<result>
window.kusdt.on(event, listener)      // returns window.kusdt
window.kusdt.removeListener(event, listener)
```

| Method | Params | Result | Opens the wallet's window |
|---|---|---|---|
| `kaspa_getNetwork` | none | `"mainnet"`, `"testnet-10"` or `"simnet"` | Never. Answered to any page |
| `kaspa_requestAccounts` | none | `[address]` | Once, to approve the site |
| `kaspa_switchNetwork` | `{network}` | The network the wallet is on afterwards | Unless the wallet is already there |
| `kusdt_getBalances` | none | `{kas, kusdt}` | Never |
| `kusdt_send` | `{to, amount}` | `{txid}` | Every time |
| `kusdt_redeem` | `{chain, address, amount}` | `{txid, redeemIds}` | Every time |
| `kusdt_swap` | `{side, amountIn, minOut}` | `{txid, amountOut}` | Every time |
| `kusdt_addLiquidity` | `{kasIn, tokensIn}` | `{txid, shares}` | Every time |
| `kusdt_removeLiquidity` | `{position}` | `{txid}` | Every time |

No other method exists. In particular there is **no method to send KAS**: `kusdt_send` sends kUSDT only. To be paid in
KAS, show your address and ask the user to send from the wallet's own Send screen.

Amounts are positive whole numbers of the smallest unit, as decimal strings (or safe integers): sompi for KAS (10⁸ in
1 KAS), base units for kUSDT (10⁶ in 1 kUSDT). Answers carry them as decimal strings. Use `BigInt`.

## 1. Detect the wallet

The wallet adds `window.kusdt` before the page's own scripts run, on every `https://` page and on
`http://localhost` and `http://127.0.0.1` for development. It is only in the top frame: a page inside an iframe, or
a sandboxed page, does not get it. Once added, it fires `kusdt#initialized` on `window`.

```js
function getKusdt(timeoutMs = 1000) {
  if (window.kusdt?.isKusdtWallet) return Promise.resolve(window.kusdt);
  return new Promise(resolve => {
    const done = () => resolve(window.kusdt?.isKusdtWallet ? window.kusdt : null);
    window.addEventListener('kusdt#initialized', done, { once: true });
    setTimeout(done, timeoutMs);
  });
}

const kusdt = await getKusdt();
if (!kusdt) showInstallHint(); // no kUSDT Wallet in this browser
```

`window.kusdt` is frozen and can't be replaced. If it is missing, link to [The wallet](/getting-started/wallet/#install)
rather than to a download of your own.

## 2. Check the network

`kaspa_getNetwork` is the only method that answers before the site is connected. Compare it with the network your
page is built for:

```js
const network = await kusdt.request({ method: 'kaspa_getNetwork' });
if (network !== 'testnet-10') {
  // Connect first (step 3): a site that is not connected is answered 4100.
  // Then ask the wallet to move. The user approves in the wallet's window.
  await kusdt.request({ method: 'kaspa_switchNetwork', params: { network: 'testnet-10' } });
}
```

`kaspa_switchNetwork` needs a site connected on the wallet's current network (step 3), takes only the wallet's three presets (`"testnet-10"`,
`"mainnet"`, `"simnet"`), and answers `4200` when nothing is deployed on that network in this wallet. A page can't add a
network or hand the wallet a deployment. Connections are per network: a site connected on testnet-10 is not connected
on mainnet, but a switch the user approves keeps the site connected on the new network, with the wallet's account
there.

## 3. Connect

```js
const [address] = await kusdt.request({ method: 'kaspa_requestAccounts' });
// "kaspatest:q…" on testnet-10, "kaspa:q…" on mainnet
```

For a site that is not connected yet, the wallet opens its window. It shows the site's origin and the account, and
says: the site will see this address and the KAS and kUSDT balances, and can ask for transactions, each of which
opens the window again. A connected site gets its address at once. A locked wallet asks for the password first, then
answers with no new approval.

A wallet that has not accepted the current Terms of Service shows them first. Until it has, every method but
`kaspa_getNetwork` is answered `4100` with a message that says so.

## 4. Read balances

```js
const { kas, kusdt: units } = await kusdt.request({ method: 'kusdt_getBalances' });
const fmt = (v, d) => {
  const n = BigInt(v), s = 10n ** BigInt(d);
  return `${n / s}.${(n % s).toString().padStart(d, '0')}`;
};
show(`${fmt(kas, 8)} KAS, ${fmt(units, 6)} kUSDT`);
```

The wallet reads the kUSDT states it checked on its own node, as on its own home screen. It never opens a window for
this. Asked again within a second, it gives the same answer; one it can't read within 30 seconds is answered `-32603`
(try again). Poll gently: every few seconds is plenty, or read again after `accountsChanged`.

A locked wallet answers `4100` with `data: { locked: true }`. The site is still connected: say the wallet is locked,
don't throw the connection away.

```js
try {
  return await kusdt.request({ method: 'kusdt_getBalances' });
} catch (e) {
  if (e.code === 4100 && e.data?.locked) return showLocked();
  if (e.code === 4100) return showConnectButton();
  throw e;
}
```

## 5. Ask for a kUSDT send

```js
const { txid } = await kusdt.request({
  method: 'kusdt_send',
  params: { to: 'kaspatest:q…', amount: '25500000' }, // 25.5 kUSDT
});
```

- `to` is a Kaspa address of the wallet's current network (`kaspa:` on mainnet, `kaspatest:` on testnet-10,
  `kaspasim:` on simnet). One of another network, one that is not a valid address, or one whose key could never sign
  is refused.
- `amount` is in base units, from 1 to 10¹⁸, at most 19 digits, with no leading zero, sign or decimal point.

The window shows the amount, the recipient and the network fee. When the kUSDT is spread over more states than one
transaction takes, it says it merges them first, in extra transactions. A script address (`kaspa:p…`) or an ECDSA
address gets a warning: the site chose the address, and a script address could even be a redemption to someone
else's EVM address. Every kUSDT output also carries KAS for its storage (1.5 KAS by default), so the user needs some
KAS next to their kUSDT ([KAS carried by token states](/protocol/fees/#kas-carried-by-token-states)).

The answer is the transaction ID once the wallet has submitted it. It is not final yet: see
[Finality](/protocol/finality/), and check the payment on your own node or through the API before you deliver
anything ([Hold and send kUSDT](/integrate/kusdt-token/#finality)).

## 6. Ask for a redemption

```js
const { txid, redeemIds } = await kusdt.request({
  method: 'kusdt_redeem',
  params: { chain: 'ethereum', address: '0x…', amount: '100000000' }, // 100 kUSDT to Ethereum
});
```

`chain` is `"ethereum"` or `"bsc"` (or the chain codes `1` and `2`); `address` is an EVM address, never the zero
address. The wallet runs the checks on [Redeem kUSDT](/getting-started/redeem/#before-you-start) itself: it asks the
API whether the vault would pay that address and refuses a blocked one, and it checks the vault's capacity, backing
and fee. The window shows the release fee, what the user receives, and that a redemption can't be undone. Follow the
payout with `GET /redeems/:txid/:outputIndex` ([Coordinator API](/protocol/coordinator-api/#calls)).

Swaps and liquidity (`kusdt_swap`, `kusdt_addLiquidity`, `kusdt_removeLiquidity`) work the same way, with the pool's
own rules: see [The pool](/protocol/wallet-provider/#the-pool) and [Pool swaps](/integrate/websites/#pool-swaps).

## 7. Follow changes

```js
kusdt.on('accountsChanged', accounts => {
  // [address], or [] when this site is not connected on the wallet's network now
  accounts.length ? useAccount(accounts[0]) : showConnectButton();
});
kusdt.on('networkChanged', network => {
  // "mainnet", "testnet-10" or "simnet": reload your settings for it
  loadSettingsFor(network);
});
```

`networkChanged` comes when the user switches in the wallet or approves `kaspa_switchNetwork`. `accountsChanged` comes
with it, and also when the wallet is unlocked (each connected site hears its account). Events go only to pages of the
site they are meant for.

Keep everything that depends on the network (the API address, the covenant ID, the pool ID) in settings keyed by the
network name, and switch them on `networkChanged`. Never take a mainnet value from anywhere but
[Status](/overview/status/#addresses).

## Errors

A refused request rejects with an `Error` that carries `code`, `message` and sometimes `data`.

| Code | Means | What to do |
|---|---|---|
| `4001` | The user rejected the request or closed the window; or it waited 5 minutes and another site's request took its place | Leave it. Let the user ask again |
| `4100` | The site isn't connected on the wallet's current network, or the Terms of Service are not accepted. With `data.locked`, the wallet is locked | Show a Connect button, or say the wallet is locked |
| `4200` | Nothing is deployed on the network asked for in this wallet | Tell the user, don't retry |
| `4900` | The wallet was reloaded or updated, or isn't reachable from this page | Ask the user to reload the page |
| `-32002` | Busy: another request is open in the window, this site already has 8 requests waiting, one waited 45 seconds, or the site was declined three times in two minutes and waits a minute | Wait, then try again. Don't loop |
| `-32602` | Malformed params: an unknown method, a bad amount or address, or params over 4 096 characters, nested more than 4 deep, or not plain JSON | Fix the request. A wallet without a method answers the same |
| `-32603` | The wallet hit an error, or couldn't read balances in time. "Closed while sending" means the transaction may have gone out | Try again. After "may have been sent", check the wallet's Activity before sending again |

When a pool request stops after merges went out, the message says how many went out and that they only joined the
user's own kUSDT. Show the message as it is.

## What the user sees

Every request that opens the window works the same way:

- **One window at a time**, beside the browser's toolbar, for one site's request. It names the site's origin and the
  network the request was asked on. A request asked before the wallet switched networks is refused.
- **It holds a request for at most 5 minutes.**
- **Approve answers only after a second** with the window shown, focused and in view. That second starts again on
  every press of a key or of the pointer, when the pointer comes in, and when the window loses focus or sight. A
  keyboard Enter or Space counts only once Approve has held the focus for that second. A page can't get a request
  approved by keeping its visitor clicking or typing.
- **A closed tab or a page that navigated away** drops its requests, the one in the window too.
- **What a server said** (the API's error, say) is shown in quotes, cut to 200 characters, never as the wallet's own
  words.

## Limits the wallet enforces

| Limit | Value |
|---|---|
| Pages that get `window.kusdt` | `https://` pages and `http://localhost`, `http://127.0.0.1`; top frame only; not sandboxed pages |
| Params | At most 4 096 characters, 4 levels deep, JSON values only (`-32602` before it leaves the page) |
| Amounts | Positive integers up to 10¹⁸, as decimal strings or safe integers |
| Requests waiting per site, and per tab | 8 (`-32002` past it) |
| Time a request waits behind the site's earlier ones | 45 seconds (`-32002`) |
| Time a request may wait in the window | 5 minutes |
| Declines | Three in two minutes: the site, and its tab under any name, waits a minute |
| `kusdt_getBalances` | Shared answer for 1 second; `-32603` after 30 seconds |
| Networks a page may ask for | `testnet-10`, `mainnet`, `simnet`, and only where something is deployed |

## Testing

Install the testnet build from `https://testnet.trestly.io/downloads/kusdt-wallet-testnet.zip`, take test coins from
the faucet at [testnet.trestly.io](https://testnet.trestly.io), and build your page for `testnet-10` first
([Test on the public testnet](/getting-started/public-testnet/)). For local development, `http://localhost` works.

## The EVM side

Deposits are made on Ethereum or BNB Chain, so your page uses the user's EVM wallet for them (EIP-1193, EIP-6963 or
WalletConnect), as on [Bridging from your own page](/integrate/websites/#bridging-from-your-own-page).
