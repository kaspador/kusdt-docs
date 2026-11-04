---
title: Test on the public testnet
description: Try kUSDT end to end on the public testnet with test coins. Install the wallet, get test tokens, bridge in, swap, provide liquidity, redeem, and report what you find.
---

The public testnet opened on 4 November 2026. It runs the whole bridge and the pool on Kaspa testnet-10 (TN10),
Sepolia and BSC testnet.

:::caution[Test coins only]
Everything here uses test coins with no real value: TN10 KAS, Sepolia ETH, tBNB and MockUSDT. Nothing is on
mainnet. Never send real USDT, ETH, BNB or KAS to any testnet address. Nothing has been audited
([Audit status](/security/audit-status/)).
:::

| Item | Where |
|---|---|
| Web app | [kusdt.pearlchain.live](https://kusdt.pearlchain.live) |
| Wallet (testnet build) | [kusdt-wallet-testnet.zip](https://kusdt.pearlchain.live/downloads/kusdt-wallet-testnet.zip) |
| Coordinator API | `https://kusdt.pearlchain.live/api/v1` ([Coordinator API](/protocol/coordinator-api/)) |
| Monitor status (read-only) | `https://kusdt.pearlchain.live/monitor/health`, `https://kusdt.pearlchain.live/monitor/api/v1/monitor` |
| Covenant IDs, vaults, MockUSDT | [Status: Addresses](/overview/status/#addresses), from `deployments/testnet.json` |

All the services run on one public test host, each in its own isolated container. That is a testnet
convenience: on mainnet each signer is a different operator on its own machine
([Operations](/developers/operations/#the-testnet-deployment)).

## 1. Install the wallet

The kUSDT wallet is a browser extension for Chromium browsers: Chrome, Brave and Edge. It is not in any store
yet.

1. Download [kusdt-wallet-testnet.zip](https://kusdt.pearlchain.live/downloads/kusdt-wallet-testnet.zip).
2. Unzip it.
3. Open `chrome://extensions`.
4. Turn on **Developer mode**.
5. Click **Load unpacked** and pick the unzipped folder.
6. Pin the extension.

It starts on Testnet. Its Kaspa addresses start with `kaspatest:`. See [The wallet](/getting-started/wallet/).

You also need an EVM wallet in the same browser for deposits from the web app, or you can use the kUSDT wallet's
own EVM side.

## 2. Get gas and test USDT

| You need | For | Where |
|---|---|---|
| Sepolia ETH | Gas on Sepolia | [Google Cloud Web3 faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) |
| tBNB | Gas on BSC testnet | [BNB Chain faucet](https://www.bnbchain.org/en/testnet-faucet) |
| TN10 KAS | Kaspa network fees, the KAS each kUSDT state carries, buying kUSDT | [faucet-tn10.kaspanet.io](https://faucet-tn10.kaspanet.io) (listed on [wiki.kaspa.org](https://wiki.kaspa.org/en/testnets)), or ask in the Kaspa Discord `#testnet` channel |
| Test USDT | Bridging in | "Get 1,000 test USDT" on the web app's Bridge page or the wallet's Bridge tab |
| Test kUSDT, without bridging | Swapping, liquidity and redeeming right away | "Get 25 test kUSDT" on the web app's Bridge page: once a day per address, no EVM wallet or gas needed |

Faucets set their own limits.

"Get 1,000 test USDT" calls MockUSDT's open mint on the chosen chain. You pay its gas from your own EVM account, so
get Sepolia ETH or tBNB first. MockUSDT has the same address on both chains,
`0x5bF185d9ce3A194b7090f069398580A66fb1F8a1`.

## 3. Bridge USDT in

Deposit test USDT from Sepolia or BSC testnet to your wallet's Kaspa address, in the web app's **Bridge → Kaspa**
or the wallet's Bridge tab. A deposit is between 10 and 100 000 USDT, and pays the deposit fee (0.20 %, at least
0.50 USDT).

The kUSDT arrives after the deposit's block is finalized on its chain and 3 of the 5 signers approve it. On
Sepolia that takes about 13 minutes. The web app's **Activity** follows it.

Details: [Bridge USDT in](/getting-started/bridge-in/), [Finality](/protocol/finality/), [Fees](/protocol/fees/).

## 4. Swap

Swap KAS for kUSDT and back in the web app's **Swap** page or the wallet. Every swap pays 0.30 % of its input.

The pool was opened on 4 November 2026 with 500 KAS and 15.7 kUSDT, so it is thin: expect price impact, and check
it in the quote before you sign. Sells may take at most 10 % of the pool's KAS per hour: that is the circuit
breaker (SPEC §15), and a larger sell is refused until the window opens again.

Details: [Swap KAS and kUSDT](/getting-started/swap/), [The sell limit](/getting-started/swap/#the-sell-limit),
[KasPool: the circuit breaker](/contracts/kaspool/#the-circuit-breaker).

## 5. Add and remove liquidity

In the web app's **Pool** page, add KAS and kUSDT at the pool's current ratio. You receive a position, a Kaspa
UTXO named `txid:index`, which the page lists. Remove it to get your share of both reserves back.

The guardian can pause the pool. While it is paused, swaps and new liquidity stop, but withdrawals stay open.

Details: [Providing liquidity](/getting-started/swap/#providing-liquidity),
[When the pool is paused](/getting-started/swap/#when-the-pool-is-paused), [The guardian](/security/guardian/).

## 6. Redeem back to an EVM address

In the web app's **Bridge → EVM** or the wallet, burn kUSDT to an EVM address on Sepolia or BSC testnet. The vault
pays it once the burn is final and 3 signers approve the release.

- A burn cannot be undone, and nobody can redirect its payout. Check the chain and the address.
- An amount at or below the release fee is never paid. Both testnet vaults were deployed with a 0.50 USDT minimum
  release fee, or 0.20 % if that is higher (on mainnet, Ethereum's minimum is 5 USDT).
- The burn output carries 0.3 KAS, gone for good since nothing can spend a burn, and the transaction pays a network
  fee. Keep some KAS next to your kUSDT.
- Sepolia's MockUSDT keeps a Tether-style blacklist. The wallet and the web app refuse a blocked address before
  any burn.

Details: [Redeem kUSDT](/getting-started/redeem/),
[Blocked recipients](/security/known-limits/#blocked-recipients).

## 7. Check the status

| Where | Shows |
|---|---|
| The web app's **Reserves** page | Proof of reserves (INV-1): the coordinator's figures next to the page's own reads of the vaults and the minter, and the monitor's check |
| The web app's **Network** page | The pinned deployment, whether the coordinator serves it, the vaults and the minter (paused or not), the signers |
| `https://kusdt.pearlchain.live/monitor/health` | 200 only while the monitor is healthy and its last check is fresh |
| `https://kusdt.pearlchain.live/monitor/api/v1/monitor` | Minted, released, owed and backing per chain, every alarm and every pause |

Both monitor routes are read-only. See [The monitor](/security/monitor/) and [Invariants](/security/invariants/).

## Reporting what you find

There is no public reporting channel yet. When you report a problem, include:

| Include | Example |
|---|---|
| The network and chain | TN10, Sepolia or BSC testnet |
| Your addresses | Your Kaspa address and your EVM address |
| Transaction IDs | The deposit's EVM transaction hash, the Kaspa transaction ID of the mint, swap or burn, and the release hash if there is one |
| Screenshots | The web app or the wallet, with any error message |
| The time | The date and time, with your time zone |

Never share a seed phrase or a private key, not even a testnet one.
