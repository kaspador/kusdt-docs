---
title: Reading the bridge's state
description: The coordinator's public API, the pause state on chain, what each answer means for an integrator, the limits per client and CORS; and the testnet monitor's signal.
---

:::caution[Mainnet, not audited]
kUSDT launches on mainnet (Kaspa mainnet, Ethereum and BNB Chain) on 14 November 2026, with real USDT. The
deployment's vaults, covenant ID, pool ID and API address are published on [Status](/overview/status/#addresses)
once the launch is verified. Nothing has been independently audited, and a legal review is open
([Audit status](/security/audit-status/)). To test first, use the public testnet at
[testnet.trestly.io](https://testnet.trestly.io) ([Test on the public testnet](/getting-started/public-testnet/)).
:::

On mainnet one public, read-only service describes the bridge: the coordinator's API. The two mainnet monitors are
private: they have no public address, and their alarms go to their operators, who act on them. On the public testnet
the monitor's status is public too, so you can test how your code reacts to it. Neither service can move funds.

| Service | Mainnet | Public testnet | Reference |
|---|---|---|---|
| The coordinator's API | The address on [Status: Addresses](/overview/status/#addresses), once the launch is verified | `https://testnet.trestly.io/api/v1` | [Coordinator API](/protocol/coordinator-api/) |
| The monitor's status | Private | `https://testnet.trestly.io/monitor` | [The monitor](/security/monitor/) |

The API is answered from what the coordinator writes. A monitor reads every chain from its own nodes and takes
nothing from the coordinator, so the two are separate views.

## When to stop accepting kUSDT

On mainnet, read the pause state from the chain, where nobody can fake it, and check it against the API:

- each vault's `paused()`, on Ethereum and on BNB Chain;
- the minter's `paused` flag and the pool's `paused` flag, in their states on Kaspa;
- the API's `GET /status` (each vault's `paused`, and the minter's state), `GET /pool` (`paused`) and `GET /reserves`
  (`healthy` is false while the backing does not cover what is owed).

**While any of them is paused, or `/reserves` is not healthy, stop accepting new kUSDT**: no new deposits credited,
no kUSDT taken as payment. kUSDT transfers cannot be paused, and forged kUSDT looks like the real token, so the pause
is the warning: on any alarm the monitors pause both vaults, the minter and the pool. Treat no answer, or an answer
you cannot read, as paused. What to do meanwhile:
[When the bridge is paused](/integrate/exchanges/#when-the-bridge-is-paused). How to read each flag:
[Is the bridge paused?](/integrate/developer-guide/#is-the-bridge-paused).

## The monitor's signal (public testnet)

A monitor answers `GET /api/v1/signal` with everything above in one place
([The integrators' signal](/security/monitor/#the-integrators-signal)). On mainnet it is private; on the public
testnet it is at `https://testnet.trestly.io/monitor/api/v1/signal`:

```json
{
  "version": 1, "at": "2026-11-05T12:00:00.000Z", "ok": true, "reasons": [],
  "checkedAt": "2026-11-05T11:59:58.000Z",
  "backing": { "healthy": true, "owed": "249000000", "total": "249000000", "unverifiedMinted": "0" },
  "paused": { "minter": false, "pool": false, "vaults": { "ethereum": false, "bsc": false } },
  "alarms": { "open": 0, "codes": [] }
}
```

`ok` is false while an alarm is open, while the backing does not cover what is owed (INV-1), while kUSDT was minted
for a deposit the monitor has not seen yet (since round 20: a forged mint shows here minutes before its alarm),
while the minter, the pool or a vault is paused, when the last check is over 5 minutes old, or when the monitor's
Kaspa view lags. `reasons` says which. `backing.healthy` is never true while `owed` exceeds `total`;
`unverifiedMinted` is the part of `owed` the monitor has not judged against a deposit yet.

On the testnet, treat `ok: false`, no answer, or an answer you cannot read as the stop above, so that your code is
ready for a pause before mainnet.

## The testnet monitor's other answers

| Call | Means |
|---|---|
| `GET /health` | 200 while the monitor is healthy (no alarm open, the backing read covers what is owed, and no kUSDT minted for a deposit it has not seen yet), its last check is under 5 minutes old and its status file under a minute; otherwise 503. Point uptime checks here, and alert when it does not answer at all |
| `GET /api/v1/monitor` | The last check in full: minted, released, owed and backing per chain, the alarms, the warnings, the pauses and the pool |

The paths are relative to `https://testnet.trestly.io/monitor`. An answer can be a few seconds old: the status
process reads the monitor's files at most once a second ([Operating it](/security/monitor/#operating-it)).

## The coordinator's answers

The full list, with every field, is on [Coordinator API: Calls](/protocol/coordinator-api/#calls). What each one is
for:

| Call | Use it to |
|---|---|
| `GET /health` | See whether the coordinator is running and following its chains. 503 says it is stopped, behind, or cannot write, and says why |
| `GET /status` | Read the deployment: kUSDT's covenant ID (`kaspa.covenantId`), the pool's (`kaspa.poolId`), each vault's address, parameters, fees and `paused`, and the finality tiers. Take the IDs and addresses from here instead of hard-coding them |
| `GET /reserves` | Read the supply and the backing. `healthy` means backing ≥ minted − released (INV-1) |
| `GET /tokens?owner=…` | List an owner's kUSDT states |
| `GET /positions?owner=…` | List an owner's liquidity positions |
| `GET /pool` | Read the pool for a quote: its states, spot prices, the circuit breaker's room, `paused`. 404 until the pool exists, 503 with `retryAt` while the coordinator is not keeping it current |
| `GET /deposits/:chain/:nonce`, `GET /deposits?sender=…` | Follow a deposit until it is `minted`, or `refunded` |
| `GET /recipients/:chain/:address` | Ask whether the vault would pay an EVM address. Burn only when `payable` is true |
| `GET /redeems/:txid/:outputIndex` | Follow a redemption until it is `released` |
| `POST /redeems` | Report a burn the coordinator has not seen. A report is a claim, not a fact ([Reporting a burn](/protocol/coordinator-api/#reporting-a-burn)) |

The statuses a deposit, a refund and a redemption go through are on
[Status values](/protocol/coordinator-api/#status-values).

Every answer that matters can be checked against a node. A wallet, an exchange or a site that holds value should
check token and pool states on its own node before it acts on them
([Verifying answers](/protocol/coordinator-api/#verifying-answers)).

## Reading the answers

- **Exact integers.** Amounts can exceed 2⁵³, and a large one can arrive as a decimal string. Some fields are always
  strings (every `breaker` and `exact` value, `genesisRemaining`, each tier's `above`). Parse numbers and strings
  exactly, never as JavaScript numbers.
- **How old.** The records are as of the coordinator's last save, a few seconds behind. `GET /health` and
  `GET /pool` answer 503 rather than serve a copy more than 15 seconds old
  ([Where the answers come from](/protocol/coordinator-api/#where-the-answers-come-from)).
- **503 and 429 carry `retryAt`.** Ask again then, not before.
- **`stale: true`** on `/tokens` or `/positions` is the last answer, given while the reads are over their budget.

## Limits per client

| Limit | API | Monitor status |
|---|---|---|
| Requests per client address per minute | 240 by default, when the operator turns the count on; 429 past it | 240 by default, when the operator turns the count on; 429 past it |
| Request body | 512 kB (413 above it), whole within 10 seconds | |
| Bodies read at a time | 64 in all, 4 from one client, 16 from one client network (an IPv4 /24, an IPv6 /48), the last 16 only for a network that holds none (429 past it) | |
| Recipient checks not already answered (`/recipients`) | 120 a minute in all by default (503 with `retryAt` past it), 20 a minute from one client network (429 with `retryAt`) | |
| Reported burns waiting (`POST /redeems`) | 32 at once, each for 15 seconds; 503 with `retryAt` past it | |

Details: [Request limits](/protocol/coordinator-api/#request-limits) and
[Operating it](/security/monitor/#operating-it). A proxy in front can add limits of its own.

## CORS

Both services answer with `Access-Control-Allow-Origin: *`, allow `GET`, `POST` and `OPTIONS` and the
`Content-Type` header, and answer a preflight `OPTIONS` with 204. A page on any site can read them from the browser.
A preflight counts as a request toward the client's limit per minute, and is refused with 429 past it like any other
(since run 21; it used to be answered whatever the count).
