---
title: Components
description: Every kUSDT component, what it holds, what it is trusted with, and what it cannot do.
---

## On Kaspa L1

### The kUSDT covenant family

One genesis transaction creates the family: one `BridgeMint` and one `TokenSeed`, and no token balance. The
family's covenant ID **is** kUSDT's identity.

| Actor | What it is | Can | Cannot |
|---|---|---|---|
| `KCC20` | The standard KCC-20 token state, unmodified | Move tokens with its owner's approval | Change the total amount in a transfer |
| `TokenSeed` | The reference actor for empty receiving states | Create states with amount 0 | Create a non-zero amount |
| `BridgeMint` | The only issuer, a singleton | Mint for consecutive deposits with 3 of 5 signer signatures, within the rate limit and hard cap | Mint a deposit twice, skip ahead, exceed the cap, or act on fewer than 3 signatures |

Details: [The kUSDT token family](/contracts/kusdt-token/), [BridgeMint](/contracts/bridge-mint/).

### The KasPool covenant family

| Actor | What it is |
|---|---|
| `Pool` | A singleton. Its UTXO holds the KAS reserve, a fixed base deposit and the protocol's accrued KAS. Its kUSDT reserve is one `KCC20` state owned by the pool's covenant ID |
| `Position` | One per liquidity deposit: a number of shares and an owner key |

The pool has an **admin** key that can collect the protocol's share of fees and hand the key on. It cannot touch
the reserves. Before mainnet, the operator holds the admin key offline. Details: [KasPool](/contracts/kaspool/).

## On Ethereum and BNB Chain

### KusdtVault

One vault per chain holds all the USDT locked on that chain.

| Can | Cannot |
|---|---|
| Take deposits and number them 0, 1, 2, … | Pay out without 3 valid signatures from current signers |
| Pay a Kaspa burn once (`release`) | Pay the same burn twice |
| Return a skipped deposit once (`refund`) | Pay more than the release allowance allows |
| Accrue fees separately from the backing | Let the owner withdraw backing |

Details: [KusdtVault](/contracts/kusdt-vault/).

### Vault owner

On mainnet, an AccessManager whose admin is a Safe multisig (48-hour delays, independent cancellers). It sets fees and limits within hard bounds, replaces the
signer set and the guardian, unpauses, and withdraws accrued fees (never more than `feesAccrued`). It cannot move
backing and cannot renounce ownership. See [Governance](/security/governance/).

## Off-chain

The signer and the coordinator are written (`bridge/services`) and have run together with the monitor on one machine
(see [Run the simnet flow](/developers/simnet/#the-whole-bridge-on-one-machine)). For the public testnet they run on
one test host, in isolated containers; only the coordinator's API and the monitor's read-only status are reachable
from outside (see [Operations](/developers/operations/#the-testnet-deployment)).

### Signers

Five independent signers, each on its own machine with its own Kaspa node and its own EVM RPCs. Each holds:

| Key | Signs |
|---|---|
| One Kaspa Schnorr key (x-only) | Mint digests and governance digests for BridgeMint |
| One EVM ECDSA key | EIP-712 `Release` and `Refund` messages for the vaults |

Every signer checks every request against its own nodes before signing. It also checks rules the vault
cannot see: a release names the chain and address that the burn owner commits to, a refund pays the
depositor, and nothing is paid to an address the token blocks (see
[Blocked recipients](/security/known-limits/#blocked-recipients)).

### Coordinator

The coordinator collects signatures, submits transactions and serves status. It holds nothing that moves
funds. A lying coordinator can stall the bridge; it cannot redirect funds, because every signature binds the
exact recipient and amount and is checked on-chain.

### Monitor and guardian

The monitor reads every chain from its own nodes and takes nothing from the coordinator. It checks INV-1, every
mint against final deposits, every release against a kUSDT burn, refunds against skipped nonces, and governance.
On any alarm, the guardian keys pause both vaults, the minter and the pool. The guardian can pause and has no other power.
See [The monitor](/security/monitor/) and [Guardian and pause](/security/guardian/).

### Public API

The coordinator serves the public [API](/protocol/coordinator-api/), including `GET /reserves` for INV-1. Before
mainnet, proof of reserves is to be published live. The URL is **to be published**.

## On the user's device

### Web app and wallet extension

The [web app](/getting-started/web-app/) (bridge, swap, pool, reserves) and the wallet extension, both built and
not yet public, hold the user's keys and sign
locally. Both pin the deployment, meaning the kUSDT covenant ID and the vault addresses, so they cannot be pointed
at a look-alike. See [The wallet](/getting-started/wallet/).
