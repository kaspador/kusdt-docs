---
title: Operations
description: How the bridge is deployed and run. What runs where, the testnet steps, publishing, watching, alarms and keys.
---

This page follows the runbook in `deploy/README.md`. The testnet is deployed and public (4 November 2026) at
`https://kusdt.pearlchain.live`, on one test host. Nothing is on mainnet.

## What runs where

| Part | Testnet | Mainnet |
|---|---|---|
| Vaults | Sepolia and BSC testnet, MockUSDT | Ethereum (USDT) and BNB Chain (BSC-USD); owner = a Safe behind a 48-hour timelock |
| kUSDT, KasPool | Kaspa testnet-10 | Kaspa mainnet; genesis reviewed by kascov.io |
| Signers ×5 | One host, five containers | Five operators, five machines, each with its own Kaspa node and EVM RPCs |
| Coordinator | Next to the signers | Any host; it holds nothing that moves funds |
| Monitor (guardian) | Next to the signers | Its own host and nodes, alerting a human |

## Testnet, step by step

All commands run from `bridge/devnet` unless noted. Keys live in `~/.kusdt/testnet`, created once by
`testnet-keys.ts`; nothing prints them.

1. `npm run testnet:check`: balances and the testnet-10 node's sync. Fund what it names: Sepolia ETH and BSC
   testnet tBNB to the deployer, testnet-10 KAS (from a faucet) to the coordinator.
2. `npm run testnet:deploy`: gas for the relayer and the guardian, MockUSDT and a vault on each chain, the kUSDT
   genesis and the pool on testnet-10, then `deployments/testnet.json` and two config bundles. It is safe to
   re-run: finished steps are skipped.
3. Run the services in one place only:
   - on this machine: `npm run testnet:services` (coordinator 9300, monitor 9310, signers 9301 to 9305);
   - or on a host, from the repository root: build the image
     (`docker build -f deploy/services.Dockerfile -t kusdt-services:<tag> .`, with `KUSDT_TAG=<tag>` in `.env`),
     put each service's config and keys from the server bundle in `/opt/kusdt/secrets/<service>` (files mode
     600), the built web app in `/opt/kusdt/web`, then `docker compose -f deploy/compose.testnet.yml up -d`.
4. `npm run testnet:e2e`: deposits on both chains, mints, a redemption paid on BSC testnet, a pool swap, and
   reserves and the monitor healthy. Sepolia finality takes about 13 minutes.

One image (`deploy/services.Dockerfile`) runs every role: signer, coordinator or monitor.

## What a signer needs

### Kaspa: a pruned node

A **pruned** rusty-kaspa node with `--utxoindex` is enough; an archival node is not needed. A signer checks burns
and skips in the UTXO set, and follows the minter in acceptance order from its own saved state. Nothing needs old
history.

- **Disk.** The TN10 node here (pruned, `--utxoindex`) uses 59.7 GB. Mainnet also runs at 10 blocks per second,
  so plan a 250 GB SSD for headroom.
- **Keep the state file.** A signer must keep, and back up, its state file (`statePath`).
- **Joining late.** A signer that joins after the pruning window cannot rescan from the launch. It starts from a
  recent checkpoint instead: the current minter UTXO and state (`initialMinter`, with `scanFrom`). The minter's
  script commits to its whole state, so the checkpoint can be checked against the UTXO set. The signer then
  refuses refunds for skips older than what it saw, which is safe.

### EVM: independent RPCs

A signer reads deposits and finality through RPCs, and every RPC it configures must agree, or it signs nothing
(`bridge/services/src/shared/evm.ts`).

- Use at least 2 independent providers per chain for each signer, and different providers across signers.
- Or run your own nodes. An Ethereum full node (execution and consensus clients) or a BNB Chain full node needs
  terabytes of SSD.
- Light clients (for example Helios for Ethereum) are an upgrade path.

## Token blocklists

The deployment names, per chain, the token view the bridge honours (`blocklist`). On mainnet that is
`isBlackListed` for Ethereum USDT and none for BSC-USD. On testnet, Sepolia's MockUSDT keeps a Tether-style
blacklist and its deployment honours it; BSC testnet's deployment sets none. Nothing is paid to an address the
token blocks (see [Blocked recipients](/security/known-limits/#blocked-recipients)).

The coordinator checks a held (`blocked`) release or refund again every `blockedRecheckMs`: one hour by default,
60 seconds in the testnet config. A failed read of the token is retried after a minute.

## Service settings

Settings the live testnet called for, in each service's config file (`bridge/services/src/*/main.ts`):

| Setting | Services | Default | Why |
|---|---|---|---|
| `evmHeadLag` | Coordinator, monitor | 2 blocks (0 on local Hardhat chains, which mine on demand) | EVM reads stay that many blocks below the head. Load-balanced public RPCs can answer from a node a block behind the head they just reported. On Sepolia this made the monitor's `eth_getLogs` fail with "block range extends beyond current head block" |
| `minDepthDaa` | Coordinator, signers | 20 DAA scores (2 on simnet) | How deep a Kaspa chain block must be before it is read. The monitor's own `minDepthDaa` stays 10. See [Following covenant states](/architecture/following-states/#when-the-chain-moves-anyway) |
| `blockedRecheckMs` | Coordinator | 1 hour (60 s on testnet) | How often a held payout is checked again (above) |

Two more changes in the coordinator:

- **It does not mint while its follower lags.** A follower still catching up holds a spent minter, and a mint
  built on it would be an orphan.
- **Funding coins are freed.** The coins of a mint the node rejects are free again at once, and any coin still
  marked as spent after 10 minutes is freed too. Before, two rejected mints left the coordinator "holding 0
  sompi" with 940 KAS.

## The testnet deployment

`deployments/testnet.json`, deployed 4 November 2026:

| Item | Value |
|---|---|
| KusdtVault, Sepolia and BSC testnet (the same address on both) | `0x7a9CA592adc5fC024660AF66e44051145a1f7C57` |
| MockUSDT, Sepolia and BSC testnet (the same address on both) | `0x5bF185d9ce3A194b7090f069398580A66fb1F8a1` |
| kUSDT covenant ID (TN10) | `6711958e2bc51c590426037020d9683ebd5daf42593de1797b65d25b92566314` |
| KasPool covenant ID (TN10) | `0b2028d0d96d0858051fa633ae0b80ad459a9b33415065a9174a8a0b07b492c9` |
| KasPool covenant ID, retired (no circuit breaker) | `f762a53e3bdfc680bb8bd55d4e64094021ea2d1c1ccc807c1772485dfe477a8b` |
| Web app | `https://kusdt.pearlchain.live` |
| Coordinator API | `https://kusdt.pearlchain.live/api/v1` |
| Monitor (read-only) | `https://kusdt.pearlchain.live/monitor/health` and `https://kusdt.pearlchain.live/monitor/api/v1/monitor` |
| Wallet (testnet build) | `https://kusdt.pearlchain.live/downloads/kusdt-wallet-testnet.zip` |

The pool was opened on 4 November 2026 with 500 KAS and 15.7 kUSDT.

The services run on one public test host, in isolated containers (`deploy/compose.testnet.yml`): a Kaspa TN10
node, five signer containers each mounting only its own keys, the coordinator, the monitor and a static web
container. All run as unprivileged users, with a read-only root filesystem and no capabilities (the web container
keeps only `NET_BIND_SERVICE`, which its Caddy binary needs to start). No container publishes a port. Only the
coordinator, the monitor and the web app are reachable through the host's reverse proxy; the node and the signers
are not on its network.

This is a testnet convenience. On mainnet each signer is a different operator on its own machine with its own
nodes (SPEC §12).

The public web app is built with `bridge/web/config/testnet.public.json`; `bridge/web/config/testnet.local.json`
points a local build at services on `127.0.0.1`.

## Publishing

The coordinator API and the monitor's status are public, read-only JSON. On the public testnet the host's Caddy
serves one name, `kusdt.pearlchain.live` (`deploy/kusdt.caddy`), with TLS, and routes by path:

| Path | Goes to |
|---|---|
| `/api/v1/*` | The coordinator (`kusdt-coordinator:9300`) |
| `GET` or `HEAD` `/monitor/health` and `/monitor/api/v1/monitor` | The monitor (`kusdt-monitor:9310`), with `/monitor` stripped |
| Any other `/monitor/*` | 404, so the acknowledge route stays private |
| Everything else | The web container (`kusdt-web:8080`) |

The web container is Caddy serving static files only (`deploy/web.Caddyfile`): the built web app, and the wallet
download under `/downloads/`.

:::danger
Never publish the signers' ports or the monitor's acknowledge route.
:::

The web app (`bridge/web`, with `testnet.public.json` for the public testnet) and these docs (`docs/`) are static sites: `npm run build` in each, and set `SITE_URL`
for the docs.

## Watching it

- `GET /health` on the monitor answers 200 only while it is healthy, its last check is fresh, and its Kaspa view
  does not lag. Point an uptime alert at it.
- `GET /api/v1/monitor` gives the numbers behind INV-1 (minted, released, owed, backing per chain), every alarm
  and every pause it made.
- The coordinator logs every mint, release and follower move. `MINTER NOT FOLLOWED` or `POOL NOT FOLLOWED` needs
  a human.

## When the monitor alarms

It has already paused every vault and the minter. Then:

1. Read the alarm (`GET /api/v1/monitor`): which invariant, which transactions.
2. **If it is real:** keep everything paused, rotate the affected keys (vault owner: `setSigners`, `setGuardian`;
   Kaspa: `set_signers`, which needs 4 honest signers), and account for every unit against INV-1 before anything
   resumes.
3. **If it is a false alarm:** fix the cause, acknowledge it (`POST /api/v1/alarms/:id/acknowledge` with the
   operator bearer), then resume: the vault owner unpauses each vault, 4 of 5 signers sign `unpause` for the
   minter, and the pool admin unpauses the pool (`pool-unpause`).
4. Announce planned governance in the monitor's `expectedGovernance` before it lands, or it alarms, on purpose.

See [The monitor](/security/monitor/) for every alarm.

**`vault-blocked`** is special: the token's issuer has blacklisted a vault, so it can pay nothing out. Keep it
paused. Nothing in the bridge can fix it; only the issuer can unblock the address.

## Keys

| Key | Holds | If lost or stolen |
|---|---|---|
| Signer (Kaspa Schnorr and EVM ECDSA) ×5 | A fifth of the quorum | Rotate it. 3 stolen keys are contained by the allowances and the monitor; 4 need the monitor and the vault owner |
| Guardian (Kaspa and EVM) | Pause only: the vaults, the minter and the pool | Rotate it; it can only stop things. The pool's copy is rotated by the pool admin (`set_keys`) |
| Coordinator (Kaspa funding, EVM relayer) | KAS for mints, gas for releases | Rotate it; no bridge funds are at risk |
| Vault owner (Safe and timelock on mainnet) | Parameters within hard bounds, the signer set, unpause, fee withdrawal | The timelock gives time to react; the owner can never take backing |
| Pool admin | Protocol fees, unpausing the pool, the pool's keys | Rotate it with `set_keys`. It cannot touch the reserves, a position or the circuit breaker |
