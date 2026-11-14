---
title: Operations
description: How the bridge is deployed and run. What runs where, the testnet steps, the mainnet packages, publishing, watching, alarms and keys.
---

This page follows the runbook in `deploy/README.md`. The public testnet has run since 4 November 2026 on one test host
and was paused on 14 November 2026; it came back that evening, at `testnet.trestly.io`, for developers and
integrators to test against ([Test on the public testnet](/getting-started/public-testnet/)). kUSDT launches on mainnet on 14 November 2026 from release `mainnet-v0.9.8-rc.25`; the mainnet
addresses are published on the [Status](/overview/status/) page once the launch is verified.

## What runs where

| Part | Testnet | Mainnet |
|---|---|---|
| Vaults | Sepolia and BSC testnet, MockUSDT | Ethereum (USDT) and BNB Chain (BSC-USD); owner = an AccessManager whose admin is a Safe (48-hour delays) |
| kUSDT, KasPool | Kaspa testnet-10 | Kaspa mainnet; genesis reviewed by kascov.io |
| Signers ×5 | One host, five containers | Five operators, five machines, each with its own Kaspa node and EVM RPCs |
| Coordinator | Next to the signers | A host of its own; its keys pay network costs (KAS and gas) and can't move bridge funds |
| Its public API (`kusdt api`) | A container beside it | A container beside it on its host; no key, the coordinator's files read-only |
| Monitor (guardian) | Next to the signers | Its own host and nodes, alerting a human |
| Its public status (`kusdt status`) | A container beside it | A container beside it on its host; no key, the monitor's status files read-only |

## Testnet, step by step

These are the steps that stood the public testnet up; they still deploy a testnet of your own. All commands run from `bridge/devnet` unless noted. Keys live in `~/.kusdt/testnet`, created once by
`testnet-keys.ts`; nothing prints them.

1. `npm run testnet:check`: balances and the testnet-10 node's sync. Fund what it names: Sepolia ETH and BSC
   testnet tBNB to the deployer, testnet-10 KAS (from a faucet) to the coordinator.
2. `npm run testnet:deploy`: gas for the relayer and the guardian, MockUSDT and a vault on each chain, the kUSDT
   genesis and the pool on testnet-10, then `deployments/testnet.json` and two config bundles. It is safe to
   re-run: finished steps are skipped.
3. Run the services in one place only:
   - on this machine: `npm run testnet:services` (the API 9300, the monitor's status 9310, signers 9301 to 9305; the
     coordinator's health on 127.0.0.1:9309, the claims channel 9306, the monitor's operator listener 9311);
   - or on a host, from the repository root: build the image
     (`docker build -f deploy/services.Dockerfile -t kusdt-services:<tag> .`, with `KUSDT_TAG=<tag>` in `.env`),
     put each service's config and keys from the server bundle in `/opt/kusdt/secrets/<service>` (files mode
     600), the built web app in `/opt/kusdt/web`, then `docker compose -f deploy/compose.testnet.yml up -d`.
4. `npm run testnet:e2e`: deposits on both chains, mints, a redemption paid on BSC testnet, a pool swap, and
   reserves and the monitor healthy. Sepolia finality takes about 13 minutes.

One image (`deploy/services.Dockerfile`) runs every role: signer, coordinator, monitor, the pool keeper or the testnet faucet.

### The pool keeper

The pool's sell breaker refills with the age of the pool's own UTXO, and time a pool transaction does not claim is lost
([the circuit breaker](/contracts/kaspool/#the-keeper)). The keeper (`kusdt keeper <keeper.json>`) follows the pool and,
for an hour after it has seen a spend that left more than 50 DAA of its UTXO's age unclaimed while more than half of the
cap was in use, sends a `tick` 25 DAA after each new pool UTXO is 50 DAA old, while more than half of the cap is in use,
claiming its age less the clients' 10 DAA margin, and sends it again if it is refused or dropped. Since run 21
(R21-OPS2-1) it sends no tick that would leave the breaker as it is (it waits until one would change it), none to a
pool whose reserve would allow a cap under `minCap` (an emptied or dust pool, where nobody can trade), and its own
ticks, however late they are accepted, never count as a griefer's spend.
Its config: `deploymentPath`, `kaspaRpc` (its own node), `keeperSecretPath` (its own Schnorr key, 32 bytes of hex;
never a bridge key: since run 21 it refuses to start on a bridge signer's, the minter guardian's, or the pool admin's
or guardian's key), `statePath`, and `initialPool` and `scanFrom` when the deployment's launch record is not where it
should start (a checkpoint from the coordinator or a monitor). Optional: `slackDaa` (50), `tickDelayDaa` (25), `marginDaa` (10), `holdMs`
(an hour), `maxFeerate` (1 000 sompi a gram, ten times the floor), `maxFeesPerHour` (30 KAS in sompi: the most its
ticks pay in fees in an hour, counted since it started; past it a due tick waits), `minCap` (0.1 KAS in sompi: no
tick to a pool whose reserve would allow a smaller cap), `coins` (4) and `coinValue` (5 KAS), `alwaysOn`
(tick whenever more than half of the cap is in use, evidence or not), `dryRun`, `kaspaSubmitRpcs` (extra Kaspa nodes its
tick also goes to while a spend that no block can take holds the pool coin; the coordinator and the monitor take the
same key for their mints and pauses, see "A parked state coin" in the runbook). Each tick spends one of its coins, free
again as soon as that tick is neither in the node's mempool nor accepted; on startup it splits its largest coin into
the `coins` it keeps (it refuses to start with `coins` and `coinValue` whose split no node would take, such as 8 coins
of 0.2 KAS; a split refused later shows as a `warning` in `/health`). It asks its node's mempool once a round, for the
pool's address, and for its own transactions by their ids (until round 14 for its own address too; anyone can fill
the node's answer for an address with transactions that pay it, and a read that fails is now not made again for 30 s
while its ticks go out plainly). It saves its state when a round changed it, at most every 5 seconds, and else every
5 minutes. Since round 13 it reads no address in its rounds: it keeps its own coins from the
transactions the chain accepts (its state's `coins`, learned by one read of its address at the first start or a start
from a checkpoint, and read again at most every 10 minutes when its node refuses a tick for a coin it does not have or
none is free), and it takes the pool output's age from its follower (the DAA score of the chain block that accepted it,
which is the score the node gives the output), reading the pool's address only when a checkpoint did not say, at most
once a minute. Its `/health` answers 503 with the reason when a due tick has not gone out for a minute (no coins,
refused by every node, the age unknown, `maxFeesPerHour` spent) or its rounds have failed for that long, besides a
lost pool or a reading far behind; it answers 200 with `idle` once every tick due for a minute would have changed
nothing, so none went out. Since run 21 its waits (a refused tick's retry, the fee budget's hour, that minute, its
saves) are timed on the monotonic clock, so a host clock set back no longer holds a tick or its health's word on it. `GET /api/v1/keeper` shows the pool output and state it follows (`pool.output`, `pool.state`), which is what a
`pool-tick` built by hand takes. Fund its address (in its log at the start, and in `GET /api/v1/keeper`) with about 300 KAS:
a tick costs about 0.057 KAS at the floor and 0.57 KAS at `maxFeerate`, at most 480 an hour (27 or 271 KAS) and never
more than `maxFeesPerHour` (30 KAS) of fees in an hour, only while armed, above half of the cap and when the tick
would change the breaker. On the testnet host it ran as `kusdt-keeper` (`deploy/keeper.testnet.json`, its key in the
bundle as `keeper.kaspa`).

## The mainnet packages

Every server these need, on one page: [Mainnet servers](/developers/mainnet-servers/).

Each mainnet operator gets a package from the repository, also attached to each mainnet release. The signer, coordinator and monitor packages each hold a compose file (a pruned Kaspa node, the service and Caddy; for the coordinator and the monitor also the process that answers their public, in a container of its own), config templates and a step-by-step guide. The deployer's holds its guide and an inputs template, and the web package holds its own compose file, Caddy, a config template and a guide.

| Package | For | Caddy serves |
|---|---|---|
| `deploy/mainnet-signer` | Each of the five signer operators | The signer, to the coordinator's addresses only |
| `deploy/mainnet-coordinator` | The coordinator's operator | The public API (`/api/v1/`), from the API process |
| `deploy/mainnet-monitor` | The monitor's operator (the guardian), and a second monitor in watch-only mode | `GET /health`, `/api/v1/signal`, `/api/v1/monitor` and the public `/api/v1/checkpoint`, from the status process; acknowledging alarms and the checkpoint with the burns on the monitor's own listener, which only the operator reaches, on that machine |
| `deploy/mainnet-deployer` | The deployer, once | Nothing: `npm run mainnet:plan`, `mainnet:execute` and `mainnet:verify` from a checkout of the tag |
| `deploy/mainnet-web` | The site's operator | The web app, built for mainnet, with its own Caddy (`/swap` is `swap.html`, with that page's preview tags) |

The image has two tools for every operator:

| Tool | What it does |
|---|---|
| `kusdt keygen [--role signer\|coordinator\|guardian\|pool-admin\|deployer]` | Makes the role's keys on the machine that uses them (mode 600, never overwritten) and prints only the public values the deployment needs. Since run 21 every service refuses to start on a key or bearer file that others than its owner can open (any group or other permission bit), saying to run `chmod 600` on it |
| `kusdt check <config>` | A preflight for a signer, the coordinator, the monitor, the keeper, the API process or the status process that signs and sends nothing. It checks: <ul><li>the files and their modes;</li><li>the mainnet USDT pins;</li><li>the launch checkpoint, whose signer set must hash from the deployment's five keys, and whose DAA score for the minter must not be below the node's (since round 12);</li><li>the pair: each vault is this kUSDT's own (it has taken every deposit the minter is past, queued no payout while nothing was minted, and was made before the genesis), and a saved state that shares only the covenant or only a vault with the deployment is told not to start (since round 12);</li><li>a synced mainnet node with a UTXO index;</li><li>RPCs that agree.</li></ul> Then, by role: a signer is in both vaults at its index; the coordinator reaches each signer as the deployment names it, and holds KAS and gas; the monitor's keys are the guardian everywhere; the API and status processes name no key file, see the files they answer from read-only and fresh, and count requests per client (`apiClientIp`); the keeper (since run 21) has a key file of its own, readable by its owner only and no bridge signer's, minter guardian's, pool admin's or guardian's, numbers it can use (`maxFeerate` at least the relay floor of 100, `coins` from 1 to 17, whole numbers where it counts DAA or sompi), `alwaysOn` and `dryRun` that are `true` or `false`, a node on the deployment's network with a UTXO index, and KAS for the ticks' fees at its address. It also reads the settings that stop or blind a service in silence: a coordinator's `holdMints` (it must be `true` or `false`, and `true` is a warning that nothing is minted), a monitor's `judgeFromBlock` (block numbers per chain code, not above an RPC's head; a warning when the monitor already has a state), and the extra Kaspa nodes of `kaspaSubmitRpcs` (over `wss://` or on your own network; each is asked for its network and whether it is synced). Every line names an RPC or a node by its scheme and host only, so the output can be shown to others: a path, a query or a user part, where a provider's key sits, is never printed |

The services take their launch checkpoint (`initialMinter`, `initialPool`, `scanFrom`) from the deployment's
`launch` record unless their config gives one.

The deployer's commands:
- **`plan`** reads only and checks every input: keys on the curve, in one role each, owners that are contracts,
  and the SPEC values. It gives each vault the rising deposit fee: 2.50 % at a full meter, and a meter of a quarter of
  the signers' daily limit unless the inputs name another (`surgeFeeBps`, `surgeCapacity`); on mainnet it refuses a
  larger meter.
- **`execute`** deploys exactly the reviewed plan. It needs the plan's SHA-256 and `KUSDT_CONFIRM_MAINNET`, and
  resumes without deploying anything twice.
- **`verify`** lets anyone check the launch on-chain. It recomputes the launch states against their UTXOs'
  scripts, recomputes kUSDT's covenant ID from its genesis (so a made-up checkpoint can't pass), and reads every
  vault parameter. At the launch it also needs the minter and the pool unspent on the operator's own node and
  `scanFrom` a chain block at or before the genesis; later runs add `--launched` and those two only warn.

`npm run mainnet:rehearse` runs all three against forks of Ethereum and BNB Chain (chain IDs 1 and 56, the real
USDT) and a simnet node. It also runs the five signers and every role's preflight against the result. A rehearsal plan runs on local RPCs only: one naming any other RPC is refused, and a plan whose target and Kaspa network disagree is refused too. `execute`'s confirmation follows the plan's Kaspa network, not its name.

## What a signer needs

### Kaspa: a pruned node

A **pruned** rusty-kaspa node with `--utxoindex` is enough; an archival node is not needed. A signer checks burns
and skips in the UTXO set, and follows the minter in acceptance order from its own saved state. Nothing needs old
history.

- **Disk.** A pruned mainnet node's database is about 20 GB (November 2026); the TN10 node here (pruned,
  `--utxoindex`) uses 59.7 GB. The packages ask for a 100 GB NVMe SSD ([Mainnet servers](/developers/mainnet-servers/)).
- **Keep the state file.** A signer must keep, and back up, its state file (`statePath`).
- **Away too long.** Our compose files run the node with `--retention-period-days=4`. A follower away longer logs that its cursor is older than the
  pruning point, and goes on from a checkpoint in its config (`GET /api/v1/checkpoint` on a coordinator or monitor gives one). It is used only when the saved position is gone.
  The burns it had read do not all come with it: a signer and the coordinator forget theirs, and a monitor keeps only those that were already deeper than the deepest finality tier. Give a monitor `initialBurns`, `initialSkipped` and `judgeFromBlock` from the same answer of another monitor (the runbook, "The burns from before a monitor's checkpoint"). Give the coordinator that answer's `initialBurns` too: it pays a listed burn whose payout a vault already has queued, and one queued nowhere once a claim names its chain and address (the runbook, "A service was down a long time", step 3).
- **Joining late.** A signer that joins after the pruning window cannot rescan from the launch. It starts from a
  recent checkpoint instead: the current minter UTXO and state (`initialMinter`, with `scanFrom`). The minter's
  script commits to its whole state, so the checkpoint can be checked against the UTXO set. The signer then
  refuses refunds for skips older than what it saw, which is safe.

### EVM: independent RPCs

A signer reads deposits and finality through RPCs, and every RPC it configures must agree, or it signs nothing
(`bridge/services/src/shared/evm.ts`). Since run 21 each mint and refund asks every RPC for its deposit's own blocks at
that moment (R21-SIG2-1), so each RPC must serve logs as old as the oldest deposit still to be minted or refunded, not
only at a first start.

- Use at least 2 independent providers per chain for each signer, and different providers across signers. On mainnet
  the signer and `kusdt check` count RPCs by domain, and one machine written two ways once (since round 18): two
  endpoints of one provider are refused. They cannot tell one company under two domains, a reseller of another
  provider's nodes, or a name and the IP address of one machine; that is the operator's to check.
- Or run your own nodes. An Ethereum full node (execution and consensus clients) or a BNB Chain full node needs
  terabytes of SSD.
- Light clients (for example Helios for Ethereum) are an upgrade path.

### A signer's health

A signer's `GET /health` (with the coordinator's bearer, from the coordinator's addresses or on the signer's own
machine) answers its index, its public keys and its getLogs ranges, and since rc.22 whether it can do its work:
`ok`, `problems`, `kaspa` (how long ago its node answered, the node's word on its sync, how long ago its minter
follower saw the node move on, the follower's lag) and `evm` (per chain, how long its reads kept failing, from the
first failure to the last, and how long ago the last one failed, if they have).
It answers 503 with the reasons when its Kaspa node has not answered for two minutes or has said it is not synced
for two minutes (not judged on a local simnet or devnet), when its minter follower has not seen the node move on for
two minutes or lags it by more than 600 DAA (or by more than 100 DAA, past which it refuses every refund, for two
minutes: since run 20), and when every read of a chain's RPCs has failed over five minutes, with
none answering between (one failed read alone is no problem, since run 20; reads that kept failing stay said until
one answers). The reads of sign requests and those of the background reading keep a clock each, and a sign request
counts as failed when any of its reads failed (since round 18: in rc.24 the background's answers every five minutes
hid sign requests that failed every time, for RPCs that disagree about a deposit or an eth_call that always fails;
`depositHistory` gives the background's own `failingMs`). Since round 18 it also answers 503 when a chain's
finalized blocks stop moving across the signer's RPCs, by the coordinator's rule (R16-PUB-1): the lowest has not
risen over 20 minutes of the background's reads on Ethereum or 10 on BNB Chain, or one RPC's has trailed the best
one's by more than that for five minutes, named by its place in `evmRpcs` (`finalized` in the answer gives each RPC's
block). The signer signs a mint or a refund only of a deposit every one of its RPCs calls final, so it refuses them
all meanwhile, with a 422 the coordinator takes for a judgement; until round 18 nothing said so. Not judged on a local
simnet or devnet. Since run 20 it also answers 503 while the signer holds itself (its daily limits count as spent after a
lost journal, a mint on the chain its records lack, or `fuseHoldUntil` after a restore), saying until when and why;
three held at once stop the bridge, and the coordinator counts a held signer's refusals as a signer that cannot sign.
Since rc.24 it also answers 503 while it has been reading a chain's deposit history in the background for over two
minutes, with each RPC's progress (`this signer has been reading bsc's deposit history in the background for ... s
(RPC 1: block ... of ..., 41 %; RPC 2: read)`): at a first start, after its deposit cache was lost, and for an RPC
whose URL changed (its API key too), that RPC's history is read from the vault's first block, and until every RPC's
is read the signer refuses that chain's mints and refunds at once, saying the same. `depositHistory` in the answer
holds the progress per chain. Until rc.24 the history was read only inside sign requests, 20 seconds each (dozens of
requests for a long BNB Chain history), and the answer then said every read of the chain had failed.
It reads nothing for the request: the signer's own loops note what they saw (an ask of the node every 10 seconds, every
scan of the follower, every EVM read a sign request makes, and the background reading of each chain's deposit
history, which reads on every 5 minutes once it is read), and the request judges those notes. What the signer
signs or refuses is not changed by it. Before rc.22 it answered 200 whatever the signer's state: three signers cut
off from their Kaspa node stopped every payout while every health answer said OK. The coordinator's own `/health`
names the signers when no payout has had three signatures for five minutes, and since round 18 when no mint of a
chain has, by chain
([Coordinator API](/protocol/coordinator-api/#where-the-answers-come-from)).

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
| `minDepthDaa` | Coordinator, signers | 20 DAA scores (2 on simnet) | How deep a Kaspa chain block must be before it is read. The monitor's own default is 10 (the testnet's config sets 20). See [Following covenant states](/architecture/following-states/#when-the-chain-moves-anyway) |
| `blockedRecheckMs` | Coordinator | 1 hour (60 s on testnet) | How often a held payout is checked again (above) |

Two more changes in the coordinator:

- **It does not mint while its follower lags.** A follower still catching up holds a spent minter, and a mint
  built on it would be an orphan. Nor while its reads of the chain fail: since run 20 the lag is then measured
  against the virtual DAA the node last answered, not kept from the last read that came back.
- **Funding coins are freed.** The coins of a mint the node rejects are free again at once, and any coin still
  marked as spent after 10 minutes is freed too. Before, two rejected mints left the coordinator "holding 0
  sompi" with 940 KAS.

## The testnet deployment

Running again since the evening of 14 November 2026, after a pause that day ([Test on the public testnet](/getting-started/public-testnet/)). `deployments/testnet.json`, deployed 9 November 2026:

| Item | Value |
|---|---|
| KusdtVault, Sepolia | `0xeec4724B6D49f694656C1AE82D1A6eF8060f64BA` |
| KusdtVault, BSC testnet | `0xeB9D91915E3CC696e2fDFDEd614551a5C6bf58f4` |
| MockUSDT, Sepolia | `0x73ee84cf953CDa0501Be2Ac26E4b92606eF85Fd6` |
| MockUSDT, BSC testnet | `0x422B8b64971C1664DeCB5015c034d8094cb93EF4` |
| kUSDT covenant ID (TN10) | `a1d9fd1347128011ad0036b077949d63274d5d3b8ac8351776c30c945ef2c2fb` |
| KasPool covenant ID (TN10) | `99445008e36139d0a57040f562414e298a3022fb739c0e9374b1dbb9f4c42171` |
| Web app | `https://testnet.trestly.io` |
| Coordinator API | `https://testnet.trestly.io/api/v1` |
| Monitor (read-only) | `https://testnet.trestly.io/monitor/health`, `https://testnet.trestly.io/monitor/api/v1/monitor` and `https://testnet.trestly.io/monitor/api/v1/signal` |
| Wallet (testnet build) | `https://testnet.trestly.io/downloads/kusdt-wallet-testnet.zip` |


The services ran on one public test host, in isolated containers (`deploy/compose.testnet.yml`): a Kaspa TN10
node, five signer containers each mounting only its own keys, the coordinator and its API process, the monitor and its status process, the pool keeper, the testnet kUSDT faucet and a static web container. All ran as unprivileged users, with a read-only root filesystem and no capabilities (the web container
kept only `NET_BIND_SERVICE`, which its Caddy binary needs to start). No container published a port. Only the API process, the status process, the faucet and the web app were reachable through the host's reverse proxy; the node, the signers,
the coordinator and the monitor were not on its network.

This was a testnet convenience. All five signers, the coordinator and the monitor also shared one RPC per EVM chain and
the one TN10 node, so a single lying source could have fooled them all ([Known limits](/security/known-limits/#the-testnet-runs-on-one-host)).
On mainnet each signer is a different operator on its own machine with its own nodes (SPEC §12), and a mainnet signer
refuses to start with fewer than two RPCs per chain.

The public testnet's web app was built with `bridge/web/config/testnet.public.json`; `bridge/web/config/testnet.local.json`
points a local build at services on `127.0.0.1`.

## Publishing

The coordinator API and the monitor's status are public, read-only JSON. Since the work after round 12 they are
answered by processes of their own, `kusdt api` and `kusdt status`, from the files the coordinator and the monitor
write (each mounted read-only); the coordinator and the monitor answer nobody from outside. On the public testnet
(since 4 November 2026) the host's Caddy serves `testnet.trestly.io` (`deploy/kusdt.caddy`) with TLS, and routes by path. Until the mainnet launch, `trestly.io` and the
old names, `kastools.com` and `kusdt.pearlchain.live`, redirected to it, so wallets already installed kept working. Since 14 November 2026 `trestly.io` shows the mainnet launch page instead, and `testnet.trestly.io` has served the testnet again since that evening. The testnet's routes were:

| Path | Goes to |
|---|---|
| `/api/v1/faucet*` | The testnet faucet (`kusdt-faucet:9320`) |
| Any other `/api/v1/*` | The API process (`kusdt-api:9300`) |
| `GET` or `HEAD` `/monitor/health`, `/monitor/api/v1/signal` and `/monitor/api/v1/monitor` | The status process (`kusdt-status:9310`), with `/monitor` stripped |
| Any other `/monitor/*` | 404: acknowledging is on the monitor's own listener, which nothing here reaches |
| Everything else | The web container (`kusdt-web:8080`) |

The web container was Caddy serving static files only (`deploy/web.Caddyfile`): the built web app, these docs under `/docs/`, and the wallet download under `/downloads/`.

:::danger
Never publish the signers' ports, the monitor's operator listener (acknowledging) or the API process's claims
listener (the coordinator fetches the burn claims there).
:::

The web app (`bridge/web`, with `testnet.public.json` for the public testnet) and these docs (`docs/`) are static sites. For the web app, `npm run build`, then copy the config to `dist/config.json`. For the docs at `/docs`, `npm run build:pages` with `SITE_URL` and `BASE_PATH=/docs`.

## Watching it

- `GET /health` of the monitor's status answers 200 only while it is healthy, its last check is fresh, its Kaspa
  view does not lag, and its status file is less than a minute old. Point an uptime alert at it, and alert as well
  when it does not answer at all: that is the status process down, while the monitor may still be judging.
- `GET /api/v1/health` of the API answers 503 when the coordinator's public copy is more than 15 seconds old; the
  coordinator's own health (warning when the API process has not been reached for a minute) is on 127.0.0.1:9309 in
  its container. Since rc.22 both warn when the coordinator's requests for burn claims reach the API process and are
  refused for their token (the claims bearer files of the two differ), both log it once a minute, and a wallet's
  `POST /redeems` is told that the operators' claims setting is wrong and that its burn is still found on the chain
  and paid, instead of "the coordinator is stopped or restarting". No token is shown. What to do: `deploy/RUNBOOK.md`, "The API process is down or stale" and "The status process is down
  or stale".
- `GET /api/v1/monitor` gives the numbers behind INV-1 (minted, released, owed, backing per chain), every alarm
  and every pause it made.
- `GET /api/v1/signal` is the integrators' answer: `ok` false means stop taking new kUSDT. Pools, exchanges and
  wallets that hold kUSDT should poll it on more than one monitor (see [The monitor](/security/monitor/#the-integrators-signal)).
- The coordinator logs every mint, release and follower move. `MINTER NOT FOLLOWED` or `POOL NOT FOLLOWED` needs
  a human. Before a follower gives a move up it reads that chain block from its node once more, and logs
  `[kaspa scan] no body in hand proved a spend of a followed state`. That line alone needs nothing: only a
  `NOT FOLLOWED` line or an alarm after it does.

## When the monitor alarms

It has already paused every vault, the minter and the pool. Then:

1. Read the alarm (`GET /api/v1/monitor`): which invariant, which transactions.
2. **If it is real:** keep everything paused, rotate the affected keys (vault owner: `setSigners`, `setGuardian`;
   Kaspa: `set_signers`, which needs 4 honest signers), and account for every unit against INV-1 before anything
   resumes. In this order, since nothing on chain enforces it:
   1. **`setSigners`.** It takes the AccessManager's 48 hours, so a vault resumes 48 hours later at the earliest,
      even though `unpause` alone could run after 6. Until it lands the old signatures still count for anything
      that was not cancelled, so stolen keys could queue a new forged payout the moment the vault runs.
   2. **`cancelRelease`, `cancelRefund`** for every bad queued payout: a pause only holds it, and it is paid once the
      vault runs again. Each alarm names the transaction that queued it, and `flagged` in the monitor's status lists
      what is still queued. A cancelled payout stays cancelled: the vault refuses to queue it again, even with the
      signatures it was first queued with, until the owner reinstates it. The mark is on the id: a forged payout
      that named a real burn's `redeemId` (alarms `release-mismatch`, `release-before-finality`,
      `release-burn-dropped`) or a real skip's nonce (`refund-mismatch`, `refund-before-finality`) bars that
      honest payout too. Reinstate such an id once `setSigners` has run on that vault, never before: until then
      the forged payout's own signatures would queue it again. The coordinator's `/health` names the ids of burns
      and skips it read that a cancel holds. An id no real burn or skip stands behind is never reinstated.
      A deposit whose forged refund was cancelled is minted as any other afterwards: the monitor forgets a refund
      when it reads the vault's `RefundCancelled`, so that mint is no alarm. A refund that is reinstated counts again.
      `reinstateRelease` and `reinstateRefund` are for a payout that was cancelled and should be paid after all
      (an honest payout cancelled by mistake, or one cancelled because the token blocked its recipient during the
      wait and has unblocked it since). They wait 48 hours, a canceller can cancel them, and they must be announced
      like any owner call. After a reinstate the coordinator asks the signers and queues the payout again by itself,
      within ten minutes, and it waits in the vault again.
   3. **Announce each call** in every monitor's `expectedOwnerCalls` before scheduling it, or a monitor with a
      canceller key cancels it.
   4. **Forged kUSDT.** Work out what any forged mint became before unpausing, and restore INV-1: its burns are real
      and would be paid. See the [threat model](/security/threat-model/#a-bad-quorum-three-signer-keys).
   5. **`unpause`.** Every payout still queued then waits a full wait again.
3. **If it is a false alarm:** fix the cause, acknowledge it (`POST /api/v1/alarms/:id/acknowledge` with the
   operator bearer, on the monitor's operator listener), then resume: the vault owner unpauses each vault, 4 of 5 signers sign `unpause` for the
   minter, and the pool admin unpauses the pool (`pool-unpause`). The minter's `unpause` must be signed after
   the pause, at the admin nonce the minter has now: the pause moved the nonce, so a signature made before it no
   longer counts.
4. Announce planned governance in the monitor's `expectedGovernance` before it lands, or it alarms, on purpose.

See [The monitor](/security/monitor/) for every alarm.

**`vault-blocked`** is special: the token's issuer has blacklisted a vault, so it can pay nothing out. Keep it
paused. Nothing in the bridge can fix it; only the issuer can unblock the address.

**`crash-loop`** means the monitor itself kept dying: it started three times or more over `failClosedMs` without
finishing one round, so nothing was judged in that time. It paused everything before it raised the alarm. Find
what ends it before you acknowledge: its log, its memory limit, its state file, and the RPC it was reading when it
died. See [A monitor that keeps dying](/security/monitor/#a-monitor-that-keeps-dying).

## Keys

| Key | Holds | If lost or stolen |
|---|---|---|
| Signer (Kaspa Schnorr and EVM ECDSA) ×5 | A fifth of the quorum | Rotate it. 3 stolen keys are contained by the allowances and the monitor; 4 need the monitor and the vault owner |
| Guardian (Kaspa and EVM) | Pause only: the vaults, the minter and the pool | Rotate it; it can only stop things. The pool's copy is rotated by the pool admin (`set_keys`) |
| Coordinator (Kaspa funding, EVM relayer) | KAS for mints, gas for releases | Rotate it; no bridge funds are at risk |
| Vault owner (a Safe, through an AccessManager on mainnet) | Parameters within hard bounds, the signer set, the guardian, unpause, cancelling and reinstating payouts, fee withdrawal | Every change waits its delay (48 hours; 6 for the guardian, unpause and a cancel), the monitor alarms when it is queued, and the cancellers can cancel it, a power-adding change to the manager itself included. To get past the cancellers a stolen Safe must remove them or outlast them: 48 hours from their last cancel, 96 only if they cancel every try until they are removed. It can pause at once and keep a vault paused while it holds the Safe. The owner can never take backing |
| Pool admin | Protocol fees, unpausing the pool, the pool's keys, and opening the pool: only its signature makes the first deposit, or the first into a pool every provider has left | Rotate it with `set_keys`. It cannot touch the reserves, a position or the circuit breaker |
| Pool keeper (Kaspa) | KAS for its ticks' network fees, nothing else | Make a new key and move the KAS. A stolen one can only send ticks, which anyone may send |

## Signer keys in an HSM or KMS

A signer can keep both keys out of its own memory: set `signing: { backend: "command", command: ["/hsm/kusdt-sign"],
kaspaKey, evmAddress, timeoutMs }` in `signer.json`, in place of `kaspaSecretPath` and `evmSecretPath`. For every
signature the signer runs that program directly (no shell, stdin closed) with `schnorr <digest>` (a mint or a
governance action: BIP-340) or `evm <digest>` (a release or a refund: the EIP-712 hash, signed raw with ECDSA
secp256k1). The program prints one hex signature and exits 0.

The HSM keeps the keys from being copied; it does not stop a signer host someone took over from having anything
signed. The program is given a 32-byte digest and nothing else, so a mint, a governance action, a release and a
refund all look alike to it (run 21, R21-CRYPTO-6). A policy HSM that checks what it signs would need the message's
fields (the mint's, the EIP-712 struct, the governance action), which the signer does not send.

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

BridgeMint's governance (`unpause`, `set_limits`, `set_signers`, `skip_nonce` and `set_value`, each 4 of 5) is
signed by the signers themselves, each on its own machine with its own key:

```sh
kusdt govern-digest <signer.json> action.json <adminNonce> [--age <DAA>]                           # signs nothing: shows the nonce, the age and the digest
kusdt govern-sign <signer.json> action.json <adminNonce> --age <DAA> > signature-<i>.json           # on each signer's machine, all with the same age
kusdt govern-submit <coordinator.json> action.json <coordinator API | state> signature-*.json  # by the coordinator's operator
#   [--funding <Kaspa key file>] [--minter-since <chain block hash>] [--scan-minutes <n>]   for addresses someone filled (below)
```

`action.json` is the action itself, for example `{"kind": "unpause"}`, never a digest. `govern-sign` recomputes the
digest from the action, the deployment's covenant ID, the admin nonce and the age, prints what it signs in words, and
prints the `expectedGovernance` line every monitor needs **before** the action lands. A govern digest commits to the
admin nonce, so a signature is good for one action, once. A `skipNonce` is signed only for the deposit the minter
stands at on that chain, as the signer's own follower holds it, and no option changes that (since run 21,
R21-SIG-1): a skip of a deposit the minter has not reached would stay good until it gets there, since mints do not
move the admin nonce, and one of a deposit it has passed was minted or skipped already. `govern-submit` checks every signature against the
deployment's signers, the action, the minter's current admin nonce and the one age they all name, and refuses
anything short of the quorum. The `<coordinator API>` is the process that faces the public: `govern-submit` and
`recovery-execute` take the minter it serves only once the coordinator config's own node holds that very coin
unspent, with that very state, and build on the node's copy of it; otherwise they send nothing and say why (since
round 15). They refuse a redirect.

The tools do not need the public API process (since round 18, R18-PUB-1). Give `state` in place of the
`<coordinator API>` and they read the minter from the coordinator's own state file (the `statePath` of the
coordinator config they are given) and ask no process at all. Given a URL that does not answer, or answers with no
minter, they read the state file too and say so. Either way the minter is used only once the operator's own node
holds that coin, so where it was read changes nothing that is sent. In the mainnet coordinator package, run them in
the coordinator's container, which mounts its config and state:
`docker compose run --rm coordinator govern-submit /config/coordinator.json /config/action.json state /config/signature-0.json ...`
(the action and signature files go in `./config`). The API process's own address there is `http://api:9300/api/v1`,
on the compose network, which a flood through the proxy does not reach.

Anyone can send the minter's address coins, and a paused minter moves only by governance. When its address holds
more coins than one read takes, `govern-submit` and `recovery-execute` prove the coin from the transactions the same
node accepted instead: a chain block of the node's chain accepted the coin's transaction with the served state's
script, kUSDT's covenant ID and the served amount, and nothing it accepted since spends it (since run 20). The read
starts at the block before the one the coordinator's own state file says accepted the coin, or at
`--minter-since <chain block hash>`, and stops after `--scan-minutes <n>` (15 unless given). When the coordinator's
funding address is the one filled, `--funding <Kaspa key file>` pays with another key. The runbook has the steps
(`deploy/RUNBOOK.md`, "A governance action at a filled minter address").

### The age every signer signs

A governance transaction claims an age of the minter's UTXO, and the mint allowance refills by that age. Since rc.16
the signers sign the age, so nobody can send a copy of their action that claims less. Three things follow for the
people signing:

- **All signers sign the same age.** It is part of the digest, and each `govern-sign` prints it with the digest
  before it signs.
- **A transaction signed for an age above 0 is valid only once the minter coin is that old.** That is true when you
  sign, and stays true unless something spends the minter first. The new coin then starts at age 0, and the action
  waits for it to reach the signed age. `govern-submit` does not send in that case. It prints the DAA score the
  action is valid from, roughly how long that is, and whether the minter coin was replaced since the signers signed.
  Run it again then, with the same files. The wait is at most one full refill (24 hours at the launch limits), but
  every further spend of the minter starts it again.
- **Other people can spend the minter.** Every deposit leads to a mint, and anyone can make a deposit. Whoever holds
  three signer keys can mint one unit at a time, or propose and veto a recovery in turn. The guardian can pause. So
  an age above 0 is a wait that someone else can keep restarting.

That decides the default of each action:

| Action | Age when `--age` is left out |
|---|---|
| `setSigners` (a rotation), `proposeRecovery`, `vetoRecovery` | 0. These must never wait: they are what you sign when keys may be stolen. Valid at once on any minter coin, and needs no node on the signer's machine. Credits no refill: mints wait for the allowance to refill. `--age <N>` is accepted with a warning |
| `unpause`, `setLimits`, `skipNonce`, `setValue` | The age of the minter coin as the signer's own follower and node show it, less a margin of 600 DAA (one minute), at most what a full refill needs. Run `govern-digest` (or the first `govern-sign`) without `--age`, then every signer signs with `--age <that number>` and checks that its tool prints the same digest |
| Any action | `--age 0` is always accepted |

For a routine action with mints flowing, pass `--age 0`, or hold mints first: `"holdMints": true` in the
coordinator's config and a restart of the coordinator. That stops the honest coordinator from starting new mints,
and nothing else: not a mint it had already sent, not a holder of three keys, not a pause, not a recovery spend.

`govern-sign` refuses an age the coin has not reached by its own signer's view, an age above what a full refill
needs (it would credit nothing more and only lengthen the wait), and an age above 0 that it cannot check (its node
is down or its follower is behind). `govern-submit` refuses signature files that name different ages, and files
from before rc.16, which name none.

`govern-sign` signs only at the nonce its own signer's follower holds for the minter, and refuses any other
(`--any-nonce` overrides this, for a nonce read from your own node). A signature has no expiry: it stays good until
the minter's admin nonce moves past it, which any 4-of-5 action and a guardian pause both do. Keep signature files
private until the action is submitted, and void an action that will not be sent, as the runbook says
(`deploy/RUNBOOK.md`, "A governance action was signed and will not be sent").

An `unpause` is signed for the paused minter coin itself (its transaction ID and output index), so it cannot be signed
before the pause it lifts. `govern-sign` takes that coin from its own signer's follower state and from nowhere else,
refuses while that state does not show the minter paused, and prints the coin it signed for; `--any-nonce` does not
change this. Anything else that spends the paused minter (another governance action, a recovery proposal, a veto, a
recovery carried out) makes a new coin: `govern-submit` then says so, and the four sign the unpause again. After a
theft of signer keys, rotate first and unpause second: a rotation is signed at the nonce, not at a coin, so a thief who
keeps spending the minter with three stolen keys can delay an unpause but not the rotation that locks them out.

Three more rules of the minter to keep in mind (since rc.16):

- **A guardian pause moves the admin nonce.** Every signature gathered before the pause is void. Read the minter's
  admin nonce again, sign again, and give every monitor the new `expectedGovernance` line: the old one names the
  old nonce.
- **`unpause` works on a paused minter only.** Don't sign one "in case".
- **`set_limits` takes at most 10¹⁵ units** for the ceiling and for the refill rate.
- **The refill rate is per DAA score, ten a second** (`refillPerDaa`). A full refill in a day is `capacity / 864000`;
  a rate written per second (`capacity / 86400`, as the vault's release refill is written) refills the allowance ten
  times faster, in 2.4 hours. Since run 20 (D9-3) `govern-digest` and `govern-sign` refuse a `setLimits` that refills
  the ceiling faster than once a day, the bound the vault keeps for its own release refill, and print how long a full
  refill takes. `--fast-refill` signs one on purpose, with a warning every signer sees.
- **A `setValue` that lowers the minter's KAS deposit frees KAS to whoever sends it first** (run 20, RT-1): the
  signatures cover the action, not the transaction, so anyone who sees it before a block can send it with the freed
  KAS paid to themselves. At most the operators' own deposit, never user money. `govern-submit` sends a lowering to
  the block-building nodes of the coordinator config's `kaspaSubmitRpcs` first: name one there (a mining pool's node)
  before you lower the deposit ([Known limits](/security/known-limits/#a-lowering-setvalue-pays-its-freed-kas-to-whoever-sends-it-first)).

And one limit: the allowance that refills after the age the signers signed is not credited, and an action signed for
age 0 credits none. Mints wait for the refill again; nothing else changes
([Known limits](/security/known-limits/#a-governance-action-credits-the-mint-allowance-only-up-to-the-age-its-signers-signed)).

## Rotating a signer

The five signers sit in three places, and a rotation changes all three: BridgeMint (4 of the current signers sign
`set_signers`) and each vault (its owner calls `setSigners`). The tools:

```sh
kusdt keygen --role signer <dir>                       # on the new signer's machine (or --public-only for an HSM)
kusdt rotate-plan deployment.json <coordinator API | state> out/ 4=<new signer's public.json> [--state <the coordinator's state file>] [--rpc 1=<Ethereum RPC>] [--rpc 2=<BNB Chain RPC>]
```

`rotate-plan` reads only. It refuses while refunds are open (a signer rotated in cannot sign them): with `--state`
it counts them in the coordinator's own state file, without it it takes the count from the API and says that this
is the word of the process that faces the public. The admin nonce in `action.json` is the API's word too, or the
state file's: each signer's `govern-sign` refuses it unless its own follower holds the same. With `--state`, `state`
in place of the API reads everything from the file, and an API that does not answer is read past to it (since
round 18). Since run 20 (D7-5) it refuses a new
signer whose EVM address is the zero address or one of the deployment's own contracts (a vault, its AccessManager, its
Safe, its USDT): such a signer can never sign a payout, and the vault would take a contract without a word. Since
run 21 (R21-CRYPTO-1) it refuses a new signer key that is another role's: the minter's guardian, the pool's admin or
guardian (at the pool's genesis, and as the API says they are now), and, with `--rpc <chain>=<url>` for a chain (every
RPC given must agree), an EVM address that is that vault's `guardian()`; without `--rpc` it says it did not read the
guardian. `govern-sign` refuses the same keys in a `setSigners` or a `proposeRecovery`, and `kusdt check` fails a
coordinator whose funding key is a signer's, or whose relayer is a vault's signer or guardian. It writes `action.json` (the Kaspa action), `announce.json` (the monitors' lines),
`owner-calls.json` (each vault's `setSigners` calldata and the AccessManager `schedule` and `execute` calls) and
`deployment.next.json` (the new signers, with the genesis five kept in `launch.signers` for the preflight).

1. **Announce.** Every monitor adds `announce.json`'s `expectedGovernance` and `expectedOwnerCalls`, and restarts.
2. **The vaults.** The Safe queues `setSigners` in each vault's AccessManager (`schedule` from `owner-calls.json`).
   The monitors note it as announced. After 48 hours, the Safe executes it (`execute` from `owner-calls.json`), within a week.
3. **Kaspa.** Four current signers run `govern-sign` on `action.json`. It signs a rotation for age 0, so leave
   `--age` out ([the age every signer signs](#the-age-every-signer-signs)); the coordinator's operator runs
   `govern-submit`. It takes effect at once.
4. **Switch.** Everyone takes `deployment.next.json` and restarts. The new signer starts, on state and journal volumes
   of its own (since rc.24 a signer refuses the records of another signer or another key, which name it); the old one
   stops for good.
5. **Check.** `kusdt check` on every role, and `npm run mainnet:verify -- <deployment.json> --plan plan.json --rpc rpc.json --launched`
   from a checkout of the tag. `--launched` because the minter and the pool have moved since the launch: the two
   launch-only checks become warnings, and the plan is compared with the genesis five kept in `launch.signers`.
   If the rotation changed the minter's guardian, `deployment.next.json` records the new one in `launch.guardian`
   and verify fails on it unless it is named: add `--expected-guardian <the announced key>` (since round 12).
   `rpc.json` needs two providers per chain. Step 2's `schedule` and `execute` are transactions of each Safe since
   the launch: every operator adds them to the shared `since-launch.json` and gives it with
   `--since-launch since-launch.json` (since round 17, R17-OWN-2; deploy/RUNBOOK.md, "After any Safe transaction").
   Without it the Safe's history line fails, as it must for a transaction nobody listed. If the Safe also replaced
   a vault's EVM guardian (`setGuardian`) or a canceller, the chain's entry names the guardian now (`"guardian"`) or
   every canceller now (`"cancellers"`) as well (since round 18, R18-OWN-1), or those lines fail.

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

Queue `setGuardian` and `unpause` together, and announce both. **The new guardian goes in before the unpause, on
every side** (run 20, D7-6). On a vault, execute `setGuardian` first and `unpause` after it, best in one Safe
transaction: the AccessManager's `multicall` of the two `execute` calls, in that order, so there is no block between
them. An `unpause` executed while the stolen key is still the guardian is undone by that key at once, and the next
`unpause` waits its 6 hours again. Never queue the `unpause` before `setGuardian`, so it is never ready first. On
BridgeMint the `set_signers` with the new guardian lands first, then the four sign the `unpause` for the paused coin
it leaves (the `set_signers` moves the minter, so an unpause signed before it is void anyway); on the pool,
`set_keys` first, then `unpause`. A stolen guardian key never puts funds at risk, and kUSDT transfers keep working
throughout.

## Rebalancing the vaults

No key can move backing from one vault to the other: only a release (a Kaspa burn) or a refund takes USDT out. When
one vault runs short, for example in a run on Ethereum, an operator rebalances through the bridge's own paths:

1. Redeem kUSDT from the vault that has plenty (burn on Kaspa, paid on that chain).
2. Move that USDT to the short chain (an exchange or another bridge).
3. Deposit it into the short vault; the same kUSDT is minted back.

Backing moves for 0.5 % each way plus the crossing (the deposit pays more while that vault's deposit meter is over
half full, see [Fees](/protocol/fees/#the-rising-deposit-fee)); no new trust is added, and the monitor sees ordinary deposits and
releases. The operator needs kUSDT to start with, so keep an inventory sized to a day's release allowance. Holders
are paid meanwhile as long as the two vaults together cover the supply: a wallet offers the other chain when the one
they asked for cannot pay now. The vaults back kUSDT together, so a depeg of one chain's stablecoin is shared by all
holders (see [known limits](/security/known-limits/)).
