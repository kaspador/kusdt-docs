---
title: Operations
description: How the bridge is deployed and run. What runs where, the testnet steps, publishing, watching, alarms and keys.
---

This page follows the runbook in `deploy/README.md`. The testnet is deployed and public (4 November 2026) at
`https://kastools.com`, on one test host. Nothing is on mainnet.

## What runs where

| Part | Testnet | Mainnet |
|---|---|---|
| Vaults | Sepolia and BSC testnet, MockUSDT | Ethereum (USDT) and BNB Chain (BSC-USD); owner = an AccessManager whose admin is a Safe (48-hour delays) |
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

## The mainnet packages

Each mainnet operator gets a package from the repository, also attached to each mainnet release. Each package
holds a compose file (its own pruned Kaspa node, the service and Caddy), a config template and a step-by-step guide.

| Package | For | Caddy serves |
|---|---|---|
| `deploy/mainnet-signer` | Each of the five signer operators | The signer, to the coordinator's addresses only |
| `deploy/mainnet-coordinator` | The coordinator's operator | The public API (`/api/v1/`) |
| `deploy/mainnet-monitor` | The monitor's operator (the guardian), and a second monitor in watch-only mode | `GET /health` and `/api/v1/monitor`; acknowledging alarms from the operator's addresses only |
| `deploy/mainnet-deployer` | The deployer, once | Nothing: `npm run mainnet:plan`, `mainnet:execute` and `mainnet:verify` from a checkout of the tag |

The image has two tools for every operator:

| Tool | What it does |
|---|---|
| `kusdt keygen [--role signer\|coordinator\|guardian\|pool-admin\|deployer]` | Makes the role's keys on the machine that uses them (mode 600, never overwritten) and prints only the public values the deployment needs |
| `kusdt check <config>` | A preflight for a signer, the coordinator or the monitor that signs and sends nothing. It checks: <ul><li>the files and their modes;</li><li>the mainnet USDT pins;</li><li>the launch checkpoint, whose signer set must hash from the deployment's five keys;</li><li>a synced mainnet node with a UTXO index;</li><li>RPCs that agree.</li></ul> Then, by role: a signer is in both vaults at its index; the coordinator reaches each signer as the deployment names it, and holds KAS and gas; the monitor's keys are the guardian everywhere |

The services take their launch checkpoint (`initialMinter`, `initialPool`, `scanFrom`) from the deployment's
`launch` record unless their config gives one.

The deployer's commands:
- **`plan`** reads only and checks every input: keys on the curve, in one role each, owners that are contracts,
  and the SPEC values.
- **`execute`** deploys exactly the reviewed plan. It needs the plan's SHA-256 and `KUSDT_CONFIRM_MAINNET`, and
  resumes without deploying anything twice.
- **`verify`** lets anyone check the launch on-chain. It recomputes the launch states against their UTXOs'
  scripts and reads every vault parameter.

`npm run mainnet:rehearse` runs all three against forks of Ethereum and BNB Chain (chain IDs 1 and 56, the real
USDT) and a simnet node. It also runs the five signers and every role's preflight against the result.

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
| KasPool covenant ID (TN10) | `102a59644f81734faa6e7870a694ee8da047b02b8bc21945576f535f94f5efb4` |
| KasPool covenant ID, retired (no circuit breaker) | `f762a53e3bdfc680bb8bd55d4e64094021ea2d1c1ccc807c1772485dfe477a8b` |
| Web app | `https://kastools.com` |
| Coordinator API | `https://kastools.com/api/v1` |
| Monitor (read-only) | `https://kastools.com/monitor/health` and `https://kastools.com/monitor/api/v1/monitor` |
| Wallet (testnet build) | `https://kastools.com/downloads/kusdt-wallet-testnet.zip` |

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
serves `kastools.com` (and the same site at `kusdt.pearlchain.live`; `deploy/kusdt.caddy`) with TLS, and routes by path:

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
- `GET /api/v1/signal` is the integrators' answer: `ok` false means stop taking new kUSDT. Pools, exchanges and
  wallets that hold kUSDT should poll it on more than one monitor (see [The monitor](/security/monitor/#the-integrators-signal)).
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
| Vault owner (a Safe, through an AccessManager on mainnet) | Parameters within hard bounds, the signer set, the guardian, unpause, fee withdrawal | Every change waits its delay (48 hours; 6 for the guardian and unpause), the monitor alarms when it is queued, and the cancellers can cancel it. The owner can never take backing |
| Pool admin | Protocol fees, unpausing the pool, the pool's keys | Rotate it with `set_keys`. It cannot touch the reserves, a position or the circuit breaker |

## Signer keys in an HSM or KMS

A signer can keep both keys out of its own memory: set `signing: { backend: "command", command: ["/hsm/kusdt-sign"],
kaspaKey, evmAddress, timeoutMs }` in `signer.json`, in place of `kaspaSecretPath` and `evmSecretPath`. For every
signature the signer runs that program directly (no shell, stdin closed) with `schnorr <digest>` (a mint or a
governance action: BIP-340) or `evm <digest>` (a release or a refund: the EIP-712 hash, signed raw with ECDSA
secp256k1). The program prints one hex signature and exits 0.

The signer trusts nothing it prints. Every signature is verified against the configured `kaspaKey` or `evmAddress`,
which must be the deployment's signer at its index; a wrong key, malformed output, a non-zero exit, more than 4096
bytes or a timeout (10 s by default) means no signature. The signer also has the program sign a fixed test digest
with both keys when it starts, so a broken HSM stops it at once rather than at the first mint.

The program sits inside the container, mounted read-only (`./hsm:/hsm:ro` in the `signer` and `check` services).
`kusdt keygen --public-only --role signer --kaspa <x-only> --evm <address> <dir>` writes the usual `public.json` from
the HSM's public values, and `kusdt check` signs and verifies the test digest with both keys. Many cloud KMS offer
secp256k1 ECDSA but not BIP-340 Schnorr, so check the Kaspa key's support first. See
`deploy/mainnet-signer/README.md`, "Keys in an HSM or KMS".

## Kaspa governance

BridgeMint's governance (`unpause`, `set_limits`, `set_signers`, `skip_nonce`: 4 of 5; `set_value`: 3 of 5) is
signed by the signers themselves, each on its own machine with its own key:

```sh
kusdt govern-sign <signer.json> action.json <adminNonce> > signature-<i>.json        # on each signer's machine
kusdt govern-submit <coordinator.json> action.json <coordinator API> signature-*.json  # by the coordinator's operator
```

`action.json` is the action itself, for example `{"kind": "unpause"}`, never a digest. `govern-sign` recomputes the
digest from the action, the deployment's covenant ID and the admin nonce, prints what it signs in words, and prints
the `expectedGovernance` line every monitor needs **before** the action lands. A govern digest commits to the admin
nonce, so a signature is good for one action, once. `govern-submit` checks every signature against the
deployment's signers, the action and the minter's current admin nonce, and refuses anything short of the quorum.

## Rotating a signer

The five signers sit in three places, and a rotation changes all three: BridgeMint (4 of the current signers sign
`set_signers`) and each vault (its owner calls `setSigners`). The tools:

```sh
kusdt keygen --role signer <dir>                       # on the new signer's machine (or --public-only for an HSM)
kusdt rotate-plan deployment.json <coordinator API> out/ 4=<new signer's public.json>
```

`rotate-plan` reads only. It writes `action.json` (the Kaspa action), `announce.json` (the monitors' lines),
`owner-calls.json` (each vault's `setSigners` calldata and the AccessManager `schedule` and `execute` calls) and
`deployment.next.json` (the new signers, with the genesis five kept in `launch.signers` for the preflight).

1. **Announce.** Every monitor adds `announce.json`'s `expectedGovernance` and `expectedOwnerCalls`, and restarts.
2. **The vaults.** The Safe queues `setSigners` in each vault's AccessManager (`schedule` from `owner-calls.json`).
   The monitors note it as announced. After 48 hours, anyone executes it.
3. **Kaspa.** Four current signers run `govern-sign` on `action.json`; the coordinator's operator runs
   `govern-submit`. It takes effect at once.
4. **Switch.** Everyone takes `deployment.next.json` and restarts. The new signer starts; the old one stops for good.
5. **Check.** `kusdt check` on every role, and `npm run mainnet:verify`.

Between steps 2 and 3 the vaults already want the new key and Kaspa still the old one. The four unchanged signers
carry both sides, so mints and releases go on. The local rehearsal (`npm run local:rotate` in `bridge/devnet`) runs
it all: it rotates signer 4, then stops signers 0 and 1 so that only 2, 3 and the new 4 are left, and a mint and a
release still go through. Last, an owner action nobody announced raises `vault-owner-unannounced` and the guardian
pauses the vaults.

## A stolen guardian key

The guardian can only pause, so a thief can only stop things, again and again. Recovery, side by side:

| Side | Replace the guardian | Resume | Time |
|---|---|---|---|
| BridgeMint | `set_signers` with the same five and a new guardian (4 signers, `govern-sign`) | `unpause` (4 signers) | Minutes |
| Pool | `set_keys` (the pool admin, offline) | `unpause` (the pool admin) | As fast as the admin key is brought out |
| Each vault | `setGuardian` (the Safe, through the AccessManager's emergency delay) | `unpause` (the same delay) | About 6 hours |

Queue `setGuardian` and `unpause` together, and announce both. A stolen guardian key never puts funds at risk, and
kUSDT transfers keep working throughout.

## Rebalancing the vaults

No key can move backing from one vault to the other: only a release (a Kaspa burn) or a refund takes USDT out. When
one vault runs short, for example in a run on Ethereum, an operator rebalances through the bridge's own paths:

1. Redeem kUSDT from the vault that has plenty (burn on Kaspa, paid on that chain).
2. Move that USDT to the short chain (an exchange or another bridge).
3. Deposit it into the short vault; the same kUSDT is minted back.

Backing moves for 0.2 % each way plus the crossing; no new trust is added, and the monitor sees ordinary deposits and
releases. The operator needs kUSDT to start with, so keep an inventory sized to a day's release allowance. Holders
are paid in full meanwhile: a wallet offers the other chain when the one they asked for cannot pay now.
