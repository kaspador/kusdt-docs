---
title: Mainnet checklist
description: The steps the specification requires before kUSDT can launch on mainnet.
---

kUSDT launches on mainnet on 14 November 2026 with the items marked **Open** below still open: in particular, no
external audit and no legal review have been done. Read [Known limits](/security/known-limits/) and the
[trust model](/security/trust-model/) before you use it. The launch also needed a funded deployer and the project
owner's explicit approval.

| # | Requirement | Why | Status |
|---|---|---|---|
| 1 | Five independent signer operators, each with their own nodes | The federation is only as strong as the independence of its members | Launch day (14 November 2026): five independent operators, each on a machine of their own with their own nodes |
| 2 | External audits of `BridgeMint` and `KasPool` (and the SilverScript they compile to) and of the vault | No part is audited yet | Open |
| 3 | The vault owner is an AccessManager whose admin is a Safe: 48-hour delays, about 6 for the guardian and unpause, and independent cancellers, who can cancel the Safe's queued vault calls and its power-adding calls on the manager itself | The owner is the one role not capped by the release allowance | Launch day (14 November 2026): the deployer builds it (`mainnet:plan` refuses anything else on mainnet), the cancellers' say over the manager included since rc.16; the Safe is 2 of 3 on each chain, with two cancellers |
| 4 | Legal review of holding users' USDT | The vaults custody user funds | Open |
| 5 | Proof of reserves published live (INV-1) | Anyone should be able to see that backing covers circulation | Open until mainnet: built, and live on the public testnet (4 to 14 November 2026), reading the vaults and the minter itself, next to `GET /reserves` and the monitor's check. The mainnet web package carries the same page; its URL goes on the [Status](/overview/status/) page once the launch is verified |
| 6 | kUSDT's genesis reviewed by kascov.io | Wallets mark unreviewed tokens "unvalidated" | Open |
| 7 | The pool admin key held offline by the operator | It can take only the accrued protocol fees, unpause the pool and hand the keys over, and only its signature opens the pool or reopens an emptied one ([KasPool](/contracts/kaspool/#protocol-fees-and-the-admin)) | Open |
| 8 | A decision on redemptions to a blocked recipient | Ethereum USDT can blacklist an address, and a payout there would be frozen | Done (4 November 2026): a blocked recipient is never paid; the burn is held and paid if the address is unblocked. No re-target power exists. See [Blocked recipients](/security/known-limits/#blocked-recipients) |
| 9 | Burn finality scaled to the payout | A release cannot be undone | Done (5 November 2026): 6 000 DAA above 10 000 kUSDT, 36 000 above 100 000; the preflight refuses shallower tiers |
| 10 | Every payout waits in the vault, so a pause can stop it | Stolen signer keys could otherwise drain a vault's allowance in small payouts before anyone reacts | Built (7 November 2026): 10 minutes, the deployer and the preflight refuse less than 5. A change to the vault itself, so item 2's audit must cover it. Every mainnet vault has it from the launch |
| 11 | `trestly.io` serves mainnet | Before the launch it redirected to the testnet | Done (14 November 2026): `trestly.io` no longer redirects to the testnet. It shows the launch page until the launch is verified, then the mainnet app. The public testnet has ended, and `testnet.trestly.io` redirects to `trestly.io` |

## Operations

What all of this runs on: [Mainnet servers](/developers/mainnet-servers/).

Not items of the specification's checklist, but part of running the bridge safely:

- the [monitor](/security/monitor/) running on its own nodes, with the guardian keys, and its `GET /health` wired to
  uptime alerts;
- planned governance announced in the monitor's `expectedGovernance` before the signers sign it, or the monitor
  pauses everything;
- an operator ready to investigate and acknowledge alarms. Acknowledging never unpauses.
- at least one pool keeper (`kusdt keeper`) with its own node, a funded key of its own and its `GET /health` on the
  uptime alerts, so that pool spends which leave their UTXO's age unclaimed can't hold the cap's refill back
  ([the keeper](/contracts/kaspool/#the-keeper)).

The runbook is on [Operations](/developers/operations/).

## From the attack review

The [attack review](/security/threat-model/#attack-vectors) adds these, in order:

1. The pool's circuit breaker. **Done.**
2. No silent worse re-quotes in the wallet. **Done.**
3. At least 2 independent monitors, with external alerts on `/health`.
4. Five independent signer operators (item 1), each with a pruned Kaspa node and independent EVM RPCs (see
   [What a signer needs](/developers/operations/#what-a-signer-needs)). Five are lined up.
5. External audits (item 2), and allowances sized to what can be lost. With 3 stolen keys, the launch limits risk
   about 100 000 USDT from the vaults, plus at most about 10 % of the pool's KAS.

## Rehearsal on mainnet forks

`npm run fork:rehearsal` (in `bridge/devnet`, passed on 3 November 2026) deploys the vault on local forks of
Ethereum and BNB Chain against the real tokens: USDT (6 decimals, no ERC-20 return values) and BSC-USD (18
decimals). On each it runs a deposit, a 3-of-5 release, refusals of a replay and of misordered signatures, a refund
of exactly the minted amount, a fee withdrawal bounded by the fees, a guardian pause and an owner unpause. It also
checks the tokens' blocklists: a release to an address Tether blacklists is paid and frozen there, a vault Tether
blacklists pays nothing, and BSC-USD keeps no blacklist. Nothing touches a real chain.

## Guard rails in the deploy script

The vault's deploy script (`bridge/evm/scripts/deploy.ts`) enforces part of this on chain IDs 1 and 56:

- it refuses the mock token;
- it requires the USDT address and decimals from the specification;
- it requires the owner to be a contract;
- it asks for the confirmation `KUSDT_CONFIRM_MAINNET=deploy-to-<chainId>`;
- it checks the hard bounds before sending anything.

The mainnet deployer (`bridge/devnet/src/mainnet-deploy.ts`, guide in `deploy/mainnet-deployer`) wraps it:

- `plan` checks every input and only reads: the five signers' keys (on the curve, in signer order), the guardian,
  the pool admin, the coordinator and the deployer, each key in one role only; on mainnet each owner is an AccessManager with a Safe and named cancellers, a plain owner is refused, and each Safe must be a contract; the SPEC
  §8 limits, with every override named; the deployer can pay.
- `execute` runs only the plan whose SHA-256 the reviewers confirmed, behind
  `KUSDT_CONFIRM_MAINNET=deploy-kusdt-mainnet`, with the plan's deployer keys, and after the live checks pass
  again. It records each step and never deploys anything twice.
- `verify` is for every operator: each vault's token, signers in order, guardian, owner and limits, its AccessManager (OpenZeppelin's code byte for byte, every role, delay and function), and the launch
  states against the scripts their UTXOs commit to.

`npm run mainnet:rehearse` (in `bridge/devnet`, with `npm run local:stack` up) runs the three commands against
forks of Ethereum and BNB Chain that keep their chain IDs, so the vault deploy takes its mainnet path against the
real USDT, and a simnet Kaspa node. A rehearsal plan runs on simnet and local RPCs only; a plan whose name and network disagree is refused. It first passed on 5 November 2026. It covered:
- the refusals: a wrong plan hash, no confirmation, the wrong keys, a rehearsal plan whose network says mainnet;
- the deploy;
- a second execute that sent nothing;
- verify;
- the five signers running, and each role's preflight;
- each vault's AccessManager: the Safe's direct calls revert, it pauses at once, its unpause waits the
  emergency delay, a canceller cancels a queued `setSigners` but not an admin call;
- a live monitor with a canceller key: an announced call passes quietly, an unannounced `setSigners` is alarmed
  and cancelled, the Safe's admin call is alarmed, the guardian pauses, and the integrators' signal says stop.

The rehearsal for release candidate `mainnet-v0.9.8-rc.25` passes, the payout wait of both vaults among those it verifies.

Since rc.16 a canceller can also cancel the Safe's power-adding calls on the manager (see
[Governance](/security/governance/#kusdtvault-evm-the-owner)), and the rehearsal's governance drill now includes a
canceller cancelling one. Since round 11 a canceller can cancel a `revokeRole` too, and a canceller is removed with
`revokeCanceller`; the drill was changed to match and has not been run again since.
