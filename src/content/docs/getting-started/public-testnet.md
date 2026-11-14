---
title: Test on the public testnet
description: The kUSDT public testnet at testnet.trestly.io runs on Kaspa testnet-10, Sepolia and BSC testnet with test coins, for testing wallets, websites and exchange integrations before mainnet.
---

The public testnet runs at [testnet.trestly.io](https://testnet.trestly.io). It is the whole bridge and the pool on
test networks, from the same release as mainnet (`mainnet-v0.9.8-rc.25`). It is there for developers and
integrators to test against, beside the mainnet launch.

:::caution[Test coins only]
Nothing on the testnet has value. Test kUSDT, test USDT and test KAS cannot be exchanged for anything. Never put a
recovery phrase that holds real KAS into a testnet build of the wallet.
:::

## What it is

The web app at [testnet.trestly.io](https://testnet.trestly.io) has the same pages as on mainnet: Bridge, Swap,
Pool and Reserves, plus a faucet for test coins. It runs on:

- Kaspa testnet-10 (TN10), with `kaspatest:` addresses;
- Sepolia (chain ID 11155111);
- BSC testnet (chain ID 97).

The testnet ran from 4 November 2026, was paused on 14 November 2026 and came back the same evening.

## Get the wallet and test coins

1. Download the testnet build of kUSDT Wallet:
   [kusdt-wallet-testnet.zip](https://testnet.trestly.io/downloads/kusdt-wallet-testnet.zip). Its SHA-256 is beside
   it, at
   [kusdt-wallet-testnet.zip.sha256](https://testnet.trestly.io/downloads/kusdt-wallet-testnet.zip.sha256). Check it
   before you unzip.
2. Unzip it. In Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the
   unzipped folder.
3. Create a new wallet in it. Use a fresh recovery phrase, not one that holds real coins.
4. Open [testnet.trestly.io](https://testnet.trestly.io), connect the wallet, and take test kUSDT from the faucet in
   the web app: 25 kUSDT a claim, once a day per address.
5. Try the flows: bridge test USDT in, swap, add and remove liquidity, and redeem. The steps are the same as on
   mainnet ([Bridge USDT in](/getting-started/bridge-in/), [Swap](/getting-started/swap/),
   [Redeem kUSDT](/getting-started/redeem/)).

### Gas and test coins

| You need | For | Where |
|---|---|---|
| Sepolia ETH | Gas on Sepolia | [Google Cloud Web3 faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) |
| tBNB | Gas on BSC testnet | [BNB Chain faucet](https://www.bnbchain.org/en/testnet-faucet) |
| TN10 KAS | Kaspa network fees, the KAS each kUSDT state carries, buying kUSDT | [faucet-tn10.kaspanet.io](https://faucet-tn10.kaspanet.io) (listed on [wiki.kaspa.org](https://wiki.kaspa.org/en/testnets)) |
| Test USDT | Bridging in | "Get 1,000 test USDT" on the web app's Bridge page, or the wallet's Bridge tab: it mints the test USDT on the chosen chain, and you pay its gas |
| Test kUSDT, without bridging | Swapping, liquidity and redeeming right away | "Get 25 test kUSDT" on the web app's Bridge page: once a day per address, no EVM wallet or gas needed |

Faucets set their own limits. The test USDT contracts are in the table below.

## Networks and addresses

These are testnet addresses only. They are not mainnet's: no mainnet address is published until the launch is
verified ([Status: Addresses](/overview/status/#addresses)).

| Network | Item | Value |
|---|---|---|
| Kaspa testnet-10 | kUSDT covenant ID | `a1d9fd1347128011ad0036b077949d63274d5d3b8ac8351776c30c945ef2c2fb` |
| Kaspa testnet-10 | KasPool covenant ID | `99445008e36139d0a57040f562414e298a3022fb739c0e9374b1dbb9f4c42171` |
| Kaspa testnet-10 | Finality | 300 DAA |
| Sepolia (11155111) | Vault | `0xeec4724B6D49f694656C1AE82D1A6eF8060f64BA` |
| Sepolia (11155111) | Test USDT (6 decimals) | `0x73ee84cf953CDa0501Be2Ac26E4b92606eF85Fd6` |
| BSC testnet (97) | Vault | `0xeB9D91915E3CC696e2fDFDEd614551a5C6bf58f4` |
| BSC testnet (97) | Test USDT (18 decimals) | `0x422B8b64971C1664DeCB5015c034d8094cb93EF4` |

The same values are in the repository, in `deployments/testnet.json`.

## API and monitor

| For | URL |
|---|---|
| The coordinator API ([Coordinator API](/protocol/coordinator-api/)) | `https://testnet.trestly.io/api/v1` |
| The monitor's health | `https://testnet.trestly.io/monitor/health` |
| The monitor's status (read-only) | `https://testnet.trestly.io/monitor/api/v1/monitor` |

The mainnet monitors run on closed machines: each publishes only its read-only status, through a Cloudflare tunnel,
at the addresses on [Status: Addresses](/overview/status/#addresses) once the launch is verified.

## Test your integration here

Use the testnet to try a wallet, a website or an exchange flow end to end, with real wallets and real networks,
before you go to mainnet:

- Point your code at the testnet API and the testnet addresses above, and keep them in a setting, so that mainnet
  is a change of configuration, not of code.
- Try deposits from both chains, redemptions to both chains, swaps, and what your code does while a payout waits.
- You can still run the whole stack on your own machine instead ([Simnet](/developers/simnet/),
  [Build and test](/developers/build-and-test/)).

The testnet is not a promise about mainnet. No independent audit has been done, and the legal review is still open
([Audit status](/security/audit-status/), [Known limits](/security/known-limits/)).
