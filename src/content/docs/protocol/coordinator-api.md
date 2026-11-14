---
title: Coordinator API
description: The coordinator's public, read-mostly JSON API. Nothing in it moves funds.
---

:::note[Where it runs]
The coordinator's API process (`kusdt api`, `bridge/services/src/api/`) serves this API for mainnet at
`https://<the API address on the Status page>/api/v1`, and in the local stack at `http://127.0.0.1:9100/api/v1` (see
[Run the simnet flow](/developers/simnet/#a-stack-that-keeps-running)). The mainnet address is published on
[Status: Addresses](/overview/status/#addresses) once the launch is verified. The public testnet serves it at
`https://testnet.trestly.io/api/v1`, for testing integrations
([Test on the public testnet](/getting-started/public-testnet/)).
:::

The API is public and read-mostly: JSON over HTTPS under `/api/v1`. Nothing in it moves funds. Every answer that
matters can be checked against a node: a token state against its UTXO, a pool state against its script.

**Amounts are JSON integers, and some exceed 2⁵³,** so clients must parse them exactly (not as JavaScript numbers). A value of 16 or more digits can also arrive as a decimal string, because the coordinator reads its saved state that way: the minter's `remaining` is one. `genesisRemaining`, every `breaker` and `exact` value, and each tier's `above` are always strings. Accept both forms. In a request body, the coordinator reads an integer exactly in any JSON notation: `12345678901234567`, `12345678901234567.0` and `1.2345678901234567e16` are the same integer. A deployment's services may lag this page (see [Status](/overview/status/) for the release each one runs).

## Where the answers come from

Since the work after round 12 the API is answered by a process of its own beside the coordinator, never by the
coordinator itself: a flood of requests can at worst slow or stop these answers, and costs the process that mints
and pays nothing. That process reads what the coordinator writes: its state, its token index and positions, its archive of closed
records, and a public copy written once a second (the pool and the minter as followed now, how far each chain was
read, the coordinator's last health check). It asks the node and the EVM RPCs over connections of its own. The paths,
the fields and the status codes are the ones they always were. How old an answer can be:

- **`GET /health`** is the coordinator's last health check, with its own `at`. It answers 503 when the public copy
  is more than 15 seconds old: the coordinator is stopped, restarting or cannot write, and every answer here is that
  old. It also answers 503 when the coordinator's Kaspa follower has not seen its node move on for 60 seconds, when
  a chain has not been read in full for five minutes, and when the coordinator cannot write its state file: the copy
  says how long ago each follower last read its chain, and a quiet chain with nothing new still counts as read. A
  chain whose reads go through is still not followed when its blocks stand still across the coordinator's RPCs: one
  RPC frozen or far behind holds the reads back to it, and `/health` answers 503 once the lowest head has not risen
  for five minutes (the lowest finalized block for 20 minutes on Ethereum, 10 on BNB Chain), or one RPC has trailed
  the best one by over two minutes for five, naming the chain and the RPC by its place in the coordinator's list. The
  Kaspa follower counts only while its node calls itself synced and its virtual DAA keeps a tenth of the network's
  pace (since round 16). When the node answers and the follower's reads of the chain do not come back, the 503 says
  so, where it used to say the node was down (since run 20). Since rc.22 it also answers 503 when no payout has had three signatures for five minutes
  because signers did not answer or answered that they cannot sign, naming those signers by their place in the
  coordinator's list (signers that refuse a payout, a burn not deep enough for them yet, are judging it and do not
  count; since run 20 one that refuses because it holds itself, its daily limits counted as spent for up to a day after
  a lost journal or a restore, does count). It says what each did in fixed words, "no answer", the HTTP status it
  answered or "holds itself" with the time the hold ends, never the signer's own error text, which can name the
  signer's Kaspa node; the signer's own `/health` and logs give the reason. Since round 18 a chain's mints are
  counted the same way, per chain: `for N min no mint on bsc has had three signatures: ...`, once three signers have
  answered that chain's mints with anything but a signature or a refusal for five minutes (an HTTP 500 when their
  RPCs disagree about a deposit, say). Until then only payouts were counted, and a chain's mints could stop with
  nothing said for an hour.
  Since run 21 its `warnings` also name each payout or mint batch held for the signers' daily limits: the payout or
  batch, its chain, the signers whose refusals started the hold and when it ends at the latest (R21-COORD2-1). Such a
  refusal starts a hold only with the signer's signed proof that its limit is used up, checked against the signers'
  agreed limit and what signers signed for the coordinator in the last 25 hours; any other is ordinary, and a warning
  names the signer and why its refusal was not believed.
  `HEAD /health` is answered as `GET`, without the body.
- **`GET /pool`** answers 503 with `retryAt` once the copy is more than 15 seconds old, once the Kaspa follower has
  not seen its node move on for 60 seconds, and while the follower lags its node by more than 600 DAA (catching up
  after a start, or its reads of the chain failing), rather than hand a wallet a pool state the coordinator is not updating. Within those bounds it is
  the coordinator's newest state, as before. Since the deep round of the second outside review of rc.22 (D4-3) it
  also answers 503 once the pool coin the coordinator follows has been missing from its node's UTXO set for two
  minutes while its follower is caught up (a transaction it could not follow spent it, or a reorg undid a pool move it
  could not undo): every trade built on that coin would be refused, and `/health` is 503 naming the coin.
- **The records** (deposits, redemptions, positions, the reserves' figures, the minter in `/status`) are as of the
  coordinator's last save, a few seconds behind what it knows. Every output `/tokens` and `/positions` list is still
  looked up on the node when it is answered. Since the deep round of the second outside review of rc.22 (D4-1) a
  reorg that drops a block undoes what that block changed in the token index: the outputs its transactions spent are
  listed again, and those they made are not. The journal behind it keeps the blocks of the last `finalityDaa` (1,000
  DAA at least) and at most 2,000 spent outputs, the newest block always; until then only the minter's own mints were
  undone, and a transfer a reorg dropped for good left its sender's kUSDT out of `/tokens`.
- Before the coordinator has written anything, the routes that need its files answer 503 with `retryAt`.

The coordinator learns the minter, the pool and the positions the way the monitor does: from accepted
transactions, checking every successor against the outputs (see
[Following covenant states](/architecture/following-states/)). It takes supply from the chain:

```text
minted   = genesis remaining − the minter's remaining
released = the sum of the vaults' Released events
```

## Calls

| Call | Answer |
|---|---|
| `GET /status` | `{network, kaspa: {covenantId, poolId, virtualDaa, minter: {utxo, state}, genesisRemaining, tokenValue, burnValue, finalityDaa, finalityTiers}, chains: [{chain, name, chainId, vault, token, decimals, scannedBlock, depositNonce, backing, unreservedBacking, reservedUnits, releaseAvailable, paused, fees: {feeBps, minDepositFee, minReleaseFee, minDeposit, maxDeposit, releaseCapacity, releaseRefillPerSecond}, blocklist}]}`. Each vault's parameters as it reports them. `blocklist` is the token view the bridge honours (`isBlackListed`), or `null` for a token that keeps none (BSC-USD). `scannedBlock` is the last final block the coordinator read (`finalizedBlock` is its old name). Since run 21 a vault's figures (`depositNonce`, `backing`, `unreservedBacking`, `reservedUnits`, `releaseAvailable`, `paused`, `fees`, `payoutDelay`) are read at one block that every one of the API's RPCs has (the lowest head, two blocks back) and shown only when all of them answer the same; until then all but `fees` were the first RPC's word. While they disagree the entry holds the last state they agreed on, with `staleSeconds` (its age) and `rpcsDisagree` (the figures they answer differently); before they have agreed once, the call fails, as it does while the RPCs cannot be read. `staleSeconds` alone means the last read failed |
| `GET /tokens?owner=<kaspa address or x-only hex>` | `{states: [{utxo, state}], unread?}`: the owner's unspent kUSDT states. `unread` (since rc.19) lists apart the coordinator's records of the owner's states at an address that holds too many coins for the node's answer to be read at all, with the KAS each coin carried as recorded: the node said neither that they are there nor that they are gone, so they are never in `states` (see [Known limits](/security/known-limits/)). Answers 400 for an owner that is neither, and 503 with `retryAt` while the API process, just started, has not yet read the token index to its end (since round 14: it used to answer every owner `states: []`). A state whose owner is a script's hash (P2SH: a multisig, a script of its own) is listed to that owner as a key's is (since run 21; until then only one minted to it was, Daybreak [57]); a burn the transaction's payload names is not, as it is a redemption. A burn with no payload is listed under its burn owner, which nobody holds a key for. |
| `GET /pool` | `{pool, reserve, pending: [txid], confirmed: {pool, reserve}, prices: {kasInKusdt, kusdtInKas}, exact: {unitsPerKas, sompiPerKusdt}, breaker, paused, tvlKas}`. `pool` and `reserve` (each `{utxo, state}`) are the newest, mempool included, carried through the pool moves in `pending` (only moves a block can take: a pool transaction that no block will include is never listed, see [Known limits](/security/known-limits/#a-spend-of-the-pool-or-the-minter-that-no-block-can-take)); `confirmed` is the newest accepted. A reserve whose making move the coordinator followed also carries `made`, the id of that transaction, whose body `GET /pool/made/:txid` serves (not in `confirmed`; see [Verifying answers](#verifying-answers)). `exact: {unitsPerKas, sompiPerKusdt}` gives the spot prices as integer strings, rounded down (kUSDT units per KAS, sompi per kUSDT); `prices` are floats for display. `breaker: {maxOutBps, windowLen, maxKasOutNow, windowEndsDaa, virtualDaa, poolDaa, minAgeDaa, readyAtDaa}` is what sells may still take out of the KAS reserve now (see [the circuit breaker](/contracts/kaspool/#the-circuit-breaker)): `poolDaa` is the DAA score the pool UTXO was accepted at (`null` while it is only in the mempool, and for a moment while the coordinator does not know it yet, see [Request limits](#request-limits)), `minAgeDaa` the least age a pool transaction must claim now, and `readyAtDaa` the DAA score before which none can be sent (`null` while the newest pool UTXO is only in the mempool, or while its age is not known and a claim is needed). `paused` says whether the guardian paused the pool. `priceKas` remains as an alias of `prices.kasInKusdt`. Answers 404 until the pool exists. |
| `GET /pool/made/:txid` | `{txid, made}`: the body of transaction `txid` (64 lowercase hex digits) that made the pool reserve the coordinator follows now (the confirmed one or the newest), without its signature scripts and with its payload's digest in place of the payload: `{version, inputs: [{previousOutpoint, sequence}], outputs: [{value, scriptPublicKey, covenant}], lockTime, subnetworkId, gas, payloadDigest}`. Any other id answers 404, from memory, with no read of the node. A body never changes, so the answer carries `Cache-Control: public, max-age=31536000, immutable`: keep it by its id and fetch it once (kUSDT Wallet and the web app do). The per-client limit counts it like any other request. It is not in `/pool` itself because a trader chooses the making transaction's outputs: about 1,200 fit a block, some 140 KB of body |
| `GET /positions?owner=<kaspa address or x-only hex>` | `{positions: [{utxo, state: {tokenCovid, shares, owner}}], unread?, truncated?, notListedAtOrBelowShares?}`: the owner's live liquidity positions, each found in the node's UTXO set; `unread` as for `/tokens`. The coordinator lists 50,000 positions at most (since round 15): while that index is full, positions of `notListedAtOrBelowShares` shares or fewer may be missing, and the answer says `truncated` (see [Known limits](/security/known-limits/)). Answers 400 for an owner that is neither, and 503 with `retryAt` while the API process, just started, has not yet read the positions to their end. |
| `GET /deposits/:chain/:nonce` | `{chain, nonce, txHash, blockNumber, logIndex, sender, ownerScheme, owner, units, fee, minted, status, kaspaTxid?, refund?}`. A nonce the coordinator has not read yet answers only `{chain, nonce, status: "pending"}`. `refund` appears once Kaspa skipped the nonce: `{chain, nonce, status, skipTxid, since, evmTxHash?, attempts?, nextTry?, lastError?}`, with status `skipped` → `refunded`, or `blocked` while the token blocks the depositor (see [Refunds](/protocol/refunds/)). `:chain` is the code (`1`, `2`), `ethereum`, `bsc` or `bnb`, or the deployment's chain name; an unknown chain answers 404, and a nonce that is not a decimal integer from 0 to 2⁵³ - 1 written with no leading zero (`5`, not `005`) 400 |
| `GET /recipients/:chain/:address` | `{chain, address, blocklist, blocked, payable, reason}`: whether the vault would pay `address`. `payable` is false for the zero address, the vault's own address, and an address the token blocks; `reason` says which, or is `null`. Answers 503 when the token can't be read, and 400 for an address that is not `0x` and 40 hex digits. Wallets refuse a burn unless `payable` is true |
| `GET /deposits?sender=0x…` or `?owner=…` | `{deposits: [{chain, ...}], total, limit, offset}`: the matching deposits, newest first, at most 1 000 per answer. `limit` and `offset` page them; with no filter an answer holds 100 unless `limit` says more. `sender` is an EVM address (`0x` and 40 hex digits, in any case): anything else matches no deposit and gets an empty page |
| `POST /redeems` | Body `{transaction, transactionId}` (a submitted burn in node JSON, with the ID the node answered) or `{txid, outputIndex, chain, address, state}` (the preimage of a burn without payload). `state` is `{amount, owner, ownerScheme, borrowScheme, borrowGuard, extensionCommitment}`. Answers `{redeems: [{redeemId, status}]}`. A malformed body answers 400, and one above 512 kB answers 413 (see [Request limits](#request-limits)), as does one whose text written out again by the API is over the 1.2 MB the coordinator reads of one exchange (since round 14). See [Reporting a burn](#reporting-a-burn) for what a report can and cannot do |
| `GET /redeems/:txid/:outputIndex` | `{redeemId, txid, outputIndex, chain, address, units, state, status, firstSeen, fee?, payout?, evmTxHash?, readyAt?, queuedTx?, attempts?, nextTry?, lastError?, note?, unverified?, checkedAt?, candidates?}`, or 404 if no such redemption was seen. A `txid` that is not 64 hex digits, or an `outputIndex` that is not a decimal integer from 0 to 65535, answers 400 (an index that was not a number used to be read as 0, and answered output 0's record). `unverified` marks a claim only a client has made so far, and `candidates` holds other claims waiting for the same outpoint. `status` `queued` means the payout is waiting in the vault: `readyAt` says until when (unix seconds) and `queuedTx` is the transaction that queued it. `fee` and `payout` come from the vault's `Released` event; `attempts`, `nextTry` and `lastError` show the relayer's retries, or why a payout is held |
| `GET /reserves` | `{supply: {minted, released, pendingBurns, circulating}, backing: {<chain name>: units, total}, at: {<chain name>: block}, healthy}`, where `healthy` means `total ≥ minted − released` (INV-1). Each vault's backing is read at the block its releases were counted to (`at`), so a release that just landed never looks like missing backing. `circulating` is `minted − released − pendingBurns`. `pendingBurns` counts burns not yet released, leaving out `invalid` records and claims neither the chain nor the node has shown, so a client's word cannot move it. `at` is `null` for a vault whose releases have not been counted yet: its backing is then read at the newest block every one of the API's RPCs has. Either way every RPC must answer the same (since run 21; the first RPC's word was taken for such a vault before), or the call fails. |

## Status values

| Object | Statuses, in order |
|---|---|
| Deposit | `pending` → `final` → `minting` → `minted`, or `refunded` |
| Refund (`refund.status`) | `skipped` → `refunded`, or `blocked` (held while the token blocks the depositor; back to `skipped` once it doesn't) |
| Redemption | `seen` → `final` → `signing` → `released`, or `invalid` (not in the UTXO set), or `unpayable` (at or below the release fee, back to `final` if the fee falls below it; or a zero or vault recipient, for good), or `blocked` (held while the token blocks the recipient; back to `final` once it doesn't) |

A `blocked` record is checked again every hour (`blockedRecheckMs`). It never holds up other records. See
[Blocked recipients](/security/known-limits/#blocked-recipients).

**A payout the vault's owner cancelled** keeps its status, and its `lastError` says that it waits until the owner
reinstates it. The coordinator asks no signer for it and sends nothing. It looks again every ten minutes and goes
on once the owner has reinstated it. It holds up no other record.

**Which burns are recorded.** Only a plain burn is recorded as a redemption: a state with no borrowing and no
extension, and an amount above zero. That is the signers' own rule for a burn they would pay. A plain burn at or
below the release fee is recorded and marked `unpayable`; the coordinator marks all of those at once, so they never
take a real burn's turn.

## Request limits

A request body is at most 512 kB (413 above it), and must arrive whole within 10 seconds or its connection is cut.
The server reads at most 64 bodies at a time, 4 from one client (an IPv4 address, an IPv6 /64), 16 from one client
network (an IPv4 /24, an IPv6 /48), and the last 16 only for a network that holds none: more answers 429. A request's headers must
arrive within 10 seconds and the whole request within 30. These limits are separate from the limit of requests per
minute per client, which an operator turns on in the API process's config (`apiClientIp`). A proxy in front can add its own: the
mainnet package's Caddy allows bodies up to 1 MB and limits how long a request may take to arrive.

The read routes have limits of their own (they kept the API process's own answers going before the split, and do
so still):

- **`/tokens` and `/positions`** read the owner's addresses on the node. One read per owner at a time, shared by
  everyone who asks; the answer is kept for a second, or for twenty times the time its read took, up to a minute.
  All these reads together have a budget of time. Past it an owner asked about lately gets the last answer with
  `stale: true`, and anyone else 503 or 429 with `retryAt`.
- **`/pool` reads no address.** The pool output's age (`poolDaa`) is the DAA score at which the coordinator's own
  follower saw that output accepted, and it keeps it in its state (and its public copy). For an output it did not see accepted (the first
  start after an upgrade from before rc.18, a pool that has not moved since the launch, a reorg that undid a pool
  move) the pool's address is read once, in the background, by the API process: until that read is back, `/pool`
  answers `poolDaa: null`, which claims no age, and it never waits for it. What it learns stays in the API process:
  the coordinator takes no word from the process that faces the public.
- **Everything the API asks the Kaspa node goes over connections of its own**, in a process of its own. Its reads of addresses wait in a
  line of their own, at most eight of them (503 with `retryAt` past that). The loops' reads never wait behind them.
- **The archive** (closed deposits and redemptions, on disk) is read within a budget of time; 503 or 429 with
  `retryAt` past it. A list read from it is kept for 30 seconds at the most.
- **What is kept in memory is bounded** by the records it holds and by its age: the owners' answers (100,000
  outputs in all), the lists read from the archive (20,000 records, an empty list counting as one), the pages of
  `/deposits` (20,000 deposits).

## Verifying answers

- A token state from `/tokens` names its UTXO. Recompute its locking script with
  [`kusdt-tx script`](/developers/kusdt-tx/#protocol-helpers) and compare it with the UTXO on your own node. The
  wallet does exactly this before it shows or spends a state.
- A pool state from `/pool`, and a position from `/positions`, can be checked the same way.
- The pool's kUSDT reserve can be checked without its address, which anyone can fill and anyone can trade the reserve
  back to (run 21, R21-POOL-1). `GET /pool/made/:txid`, for the id `reserve.made` names, serves the body of the
  transaction that made it, as far as its id goes: `{version, inputs: [{previousOutpoint, sequence}], outputs: [{value,
  scriptPublicKey, covenant}], lockTime, subnetworkId, gas, payloadDigest}` (a version 1 id commits to the payload by
  its digest alone, so the digest stands in for the payload). Check that its id (version 1: `transactionIdOf` in
  `bridge/packages/kaspa/src/txid.ts`, a port of rusty-kaspa's `hashing/tx.rs`) is the reserve's `transactionId`, and
  that the reserve is its first output bound to kUSDT's covenant ID, at the script of the reserve's state, in a
  transaction that also made a coin of the pool's (`reserveMadeBy` in `bridge/packages/protocol/src/pool-follow.ts`).
  When that transaction also made the pool coin you find on your node, that is the reserve, with the KAS its output
  holds, unspent while the pool coin is: a pool entry either refuses kUSDT beside it or makes the reserve's successor as
  its first kUSDT output, so the reserve is spent only with the pool coin of its time. A reserve made before the pool
  coin (a tick or a pause since) the body shows as it was made, not as still there: list its address as well. kUSDT
  Wallet and the web app do so, take the body for such a reserve only when its address cannot be listed, and list the
  address when `reserve.made` is missing (a coordinator that has not followed the reserve's last move). They keep each
  body by its id and fetch it once.
- `/reserves` can be checked against the vaults' `backing()`, read at the blocks in `at`, and the minter's
  `remaining`. `healthy` compares the
  backing with everything minted and not yet released, so a burn still waiting for its release still counts as
  owed.

The [monitor](/security/monitor/) computes the same supply figures from its own nodes and does not use this API.

## Reporting a burn

`POST /redeems` tells the coordinator about a burn it has not seen on its own, with its payload's chain and
address. The API process checks the body's shape and holds the claim until the coordinator fetches it, which it
does itself, at most five times a second and eight claims at a time, within the budget of time a claim always had.
At most 32 claims (4 MB) wait at once, each for 15 seconds: past any of these, and while the coordinator is not
asking (it is stopped or restarting), the answer is 503 with `retryAt`, and nothing is kept. A wallet asks again;
a burn nobody reported is still found on the chain, unless the coordinator was rebuilt or re-anchored past it: it
reads burns only from where it starts. So kUSDT Wallet keeps each burn's claim and sends the same claim again while
`GET /redeems` answers 404 for it, or while no claim of it was taken and the API cannot say: at once, then a minute
later, each wait twice the one before and at most six hours, twenty times in all (since run 21 round 2, R21-COORD2-5).
A burn its Kaspa node did not answer about ("May have been sent") is claimed only once the node shows it accepted: a
claim makes the burn show as pending, and one that never landed must not.
Since rc.22, when the coordinator does ask and the API process refuses it for its token (the operators' claims setting
is wrong), the 503 says so instead, and that the burn is still found on the chain and paid without the claim. A report
is a claim, not a fact:

- **A transaction a client posts** can only add redemption claims. Nothing proves it is the transaction with that
  id, so it never changes the coordinator's token index.
- **A deposit that names a burn owner needs a claim, unless it is the depositor's own.** Such a deposit is minted
  straight into a burn, and a mint carries no payload. Since run 21 the coordinator records the redemption itself when
  the owner is the burn owner of the depositor's own address on chain 1 or 2. For any other burn owner it records none,
  and the burn is never paid, until someone posts `{txid, outputIndex, chain, address, state}` for the minted output
  (the mint's transaction ID, the output's index, the chain and address the burn owner names, and the minted state).
  The web app and the wallet never build such a deposit; whoever deposits that way sends the claim.
- **Nothing is read from the node on the request.** A claim for an output the coordinator's own follower has read
  from an accepted transaction (the exact state, with kUSDT's covenant ID) is a burn at once and replaces whatever
  came first. Any other claim waits, and a loop of its own tries every waiting claim against the follower's records
  and then against the node's UTXO set; the one found wins. Before round 11 the claimed state's address was listed
  on the request itself: an address of the caller's choosing, holding any number of coins.
- **A burn the coordinator reads from the chain itself** always replaces a different claim.
- **Unproved claims are capped, and fairly.** The coordinator keeps at most 256 redemptions on a client's word alone (bulk claims read from a posted transaction counted apart). Since run 21, past that bound the client network that sent the most loses one first: what came to nothing, then what the node was asked about and did not show, then the newest of its others. Until then the oldest went, whoever sent it, and 257 claims about made-up outputs from one address pushed out anyone's (R21-IDENT-1). A claim the node was not asked about yet is never dropped to make room for a newer one from another network: when one claim from each of very many networks fills the bound, the next is refused with 503 and `retryAt`. A claim already found does not count, and an honest burn loses nothing, since the chain shows it anyway. Each pass looks up at most about 128 claims on the node, after everything the chain has shown. A claim that came to nothing stays visible for an hour.
- **Other claims about one output wait their turn.** Each redemption keeps at most 16 other claims (`candidates`), one per client network, and the node is asked about each of them, whatever it answers about the others. Since run 21 a claim takes the place of one the node was already asked about (`checkedAt`), never of one it was not: until then false states sent after the real one pushed it out before the node was asked, and the burn was never paid (Daybreak [10]). While the places are full a network's claim keeps its place for ten minutes after the node was asked about it: networks that sent again after every pass of the claims loop kept a newcomer out for good (run 21 review, RV-CK). A claim with no place for now (the places hold claims not yet asked about, or its network's own claim is not) is refused with 503 and `retryAt`; send it again after that.
- **The coordinator's record of a burn a claim names stays.** Its book of burns read from the chain keeps the record of any output a waiting claim names, by its first state or any other, however many larger outputs anyone makes (Daybreak [40]).
- **Unproved claims are not supply.** They are left out of `pendingBurns` in `GET /reserves` until the chain or the node shows them.

So reporting a wrong state first cannot strand someone else's redemption (fixed 5 November 2026).
Signers re-check every burn on their own nodes before they sign, whatever the coordinator says.
