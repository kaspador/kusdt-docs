---
title: The monitor
description: The monitor and guardian service. What it checks, which alarms it raises, how it pauses, and how to run it.
---

The **monitor** watches every chain kUSDT touches and holds the **guardian** keys. When something is wrong, it
pauses both vaults, the minter and the pool. It is written (`bridge/services/src/monitor/`), has run in the local
end-to-end test, and runs for the testnet on the operator's machine (port 9310). It is not hosted publicly yet.

## Principles

- **Its own nodes only.** The monitor reads Kaspa, Ethereum and BNB Chain from its own nodes and takes nothing
  from the coordinator.
- **Acceptance order.** It reads Kaspa transactions in the order the DAG accepts them, a few DAA scores deep, so a
  transaction that lost a double-spend race never counts. If the chain still moves off a block it read, it reads
  again from the fork point. See
  [Following covenant states](/architecture/following-states/).
- **It follows BridgeMint** and adopts each successor state only from the outputs the spending input authorizes
  in the kUSDT family; a plain output paying to the same script is a decoy and is ignored. So it knows exactly
  what was minted, paused and governed.
- **It indexes every kUSDT burn**: a kUSDT state, by covenant ID, sent to a P2SH owner.
- **It follows the pool** from its genesis (`initialPool`), verifying each successor the same way.
- **It can only stop things.** On any alarm it pauses every vault, the minter and the pool. It never unpauses: that takes 4
  of 5 signers on Kaspa and the vault owner on each chain.

## What it checks

| Check | Invariant |
|---|---|
| minted − released ≤ Σ backing, with each vault read at one block | INV-1 |
| Every mint matches final deposits on the named chain, with the same recipients and amounts | INV-2 |
| Every release matches a kUSDT burn of the same amount whose owner commits to that chain and recipient | INV-3 |
| Every refund is of a nonce Kaspa skipped and never minted | INV-2 |
| No governance the operators did not announce | Governance |
| The token does not block a vault | A blocked vault can pay nothing out |

Minted is computed from the chain: the genesis `remaining` minus the minter's current `remaining`. Released comes
from the vaults' `Released` events.

## Alarms

| Alarm | Means |
|---|---|
| `inv1` | minted − released > Σ backing, with each vault read at one block (INV-1) |
| `mint-without-deposit`, `mint-mismatch` | A mint has no final deposit behind each recipient, or not the same recipient and amount (INV-2) |
| `release-without-burn`, `release-mismatch` | A vault paid a `redeemId` that is no kUSDT burn, or not its amount, or not the recipient its burn owner commits to (INV-3) |
| `refund-of-minted-deposit`, `refund-without-skip` | A vault refunded a deposit that was minted, or one Kaspa never skipped (INV-2) |
| `signers-changed`, `limits-raised` | Governance the operators did not announce in `expectedGovernance` |
| `unpaused-while-alarmed`, `vault-unpaused-while-alarmed` | An unpause while an alarm is open |
| `vault-signers-differ` | A vault's signers are not the deployment's |
| `minter-unverifiable` | The minter moved in a way the monitor cannot verify |
| `minter-lost` | The minter UTXO it follows is not in the node's UTXO set with kUSDT's covenant ID, on three caught-up checks, and no fetched transaction spends it |
| `vault-blocked` | The token's blocklist names a vault. That vault can pay nothing out, while deposits still go in |
| `pool-unverifiable` | The pool was spent in a way the monitor cannot verify |

The `vault-blocked` check reads the view the deployment names for each chain (`blocklist`: `isBlackListed` for
Ethereum USDT). BSC-USD keeps no blacklist, so it never fires there. The pause stops new deposits into a vault
that could not pay them back. See [Blocked recipients](/security/known-limits/#blocked-recipients).

A mint may wait for its deposit, and a release for its burn, for a grace period (`graceMs`, 5 minutes by default)
before it becomes an alarm. This covers the time a deposit or a burn takes to become final on the monitor's own
nodes. A monitor that starts late raises no `release-without-burn` or `refund-without-skip` before its Kaspa scan
has caught up.

## What happens on an alarm

1. The guardian pauses every vault (`pause()` from the guardian address), the minter and the pool (`pause`
   transactions signed by the guardian's Kaspa key; its own coins pay the fees). A paused pool stops swaps and new
   liquidity; withdrawals stay open.
2. While any alarm is open, the monitor keeps them paused.
3. An operator investigates and acknowledges the alarm. Acknowledging clears the alarm; **nothing unpauses**.
4. Resuming is a separate decision: `unpause` with 4 of 5 signers on Kaspa, `unpause()` by the owner of each
   vault, and `unpause` by the pool admin. An unpause while an alarm is still open is itself an alarm.

## Proof: the attack in the local end-to-end run

`npm run local:e2e` ends with an attack, and it passed on 3 November 2026:

| Step | Result |
|---|---|
| Normal flow first, then the monitor's view | Agrees with the coordinator: minted 299, released 50, owed 249 ≤ backing 249 (USDT), no alarms |
| Three stolen signer keys try to mint 1 000 000 kUSDT | Refused by the mint allowance |
| The same keys mint 400 000 kUSDT with no deposit | Accepted by the covenant: the signatures are valid and it is within the allowance |
| At once, they sell all 400 000 into the pool | The circuit breaker refuses the whole sell; the most it lets out is under 10 % of the pool's KAS |
| The monitor | Raises `inv1` and, within seconds, pauses both vaults, the minter and the pool |
| The coordinator | Follows the forged mint and the pause |
| A new deposit | Refused by the paused vault |

The covenants cannot see the EVM chains, so they cannot refuse a well-signed mint within the allowance. The
monitor is what turns that into a pause before any USDT can leave. A sell can land in the same block as the mint,
before the monitor sees it; the pool's circuit breaker bounds that.

## Operating it

```sh
npm run monitor -- <config.json>        # in bridge/services
```

| HTTP | Answer |
|---|---|
| `GET /health` | 200 when healthy and the last check is fresh (under 5 minutes old), otherwise 503. It also answers 503 while its Kaspa view lags (600 DAA scores by default), so an operator learns about a stalled node before alarms would come late. Wire it to uptime alerts |
| `GET /api/v1/monitor` | The last check, the alarms, the pauses, the minter state, and `pool`: `{utxo, paused, kasReserve, windowOut}` (`null` when no pool is configured) |
| `POST /api/v1/alarms/:id/acknowledge` | With the operator bearer token: clears one alarm. Nothing unpauses |

### Configuration

| Field | Meaning |
|---|---|
| `deploymentPath` | The deployment file (covenant IDs, vaults, signers) |
| `kaspaRpc`, `evmRpcs` | The monitor's own Kaspa node and EVM RPCs (by chain code) |
| `guardianKaspaSecretPath`, `guardianEvmSecretPath` | The guardian keys. Without them the monitor can alarm but not pause |
| `statePath` | Where it keeps its state between restarts |
| `initialMinter` | The minter UTXO and state to follow from (the genesis output) |
| `initialPool` | Optional: the pool UTXO and state to follow from (the pool's genesis output). With it, the guardian pauses the pool too |
| `genesisRemaining` | Optional: `remaining` at genesis. Defaults to the initial minter's |
| `scanFrom` | A block hash at or before the genesis transaction |
| `pollMs` | Optional: time between checks; 2 000 ms by default |
| `minDepthDaa` | Optional: how far below the virtual a chain block must be before it is read; 10 DAA scores by default |
| `graceMs` | Optional: how long a mint may wait for its deposit, or a release for its burn; 300 000 ms by default |
| `expectedGovernance` | Governance the operators announce in advance, as `{adminNonce, action, params}` (params in hex). Anything else alarms |
| `dryRun` | Optional: alarm without pausing anything |
| `evmHeadLag` | Optional: how many blocks below the EVM head its reads stay; 2 by default, 0 on local Hardhat chains. See [Operations](/developers/operations/#service-settings) |
| `bearerPath` | The operator bearer token for acknowledging alarms |
| `listen` | `{host, port}` for the HTTP API |

:::caution[Announce governance first]
Before the signers rotate keys or change limits on Kaspa, add the action to `expectedGovernance`. Otherwise the
monitor raises `signers-changed` or `limits-raised` and pauses everything.
:::
