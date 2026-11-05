---
title: Mainnet checklist
description: The steps the specification requires before kUSDT can launch on mainnet.
---

kUSDT does not go to mainnet until every item below is done. Mainnet deployments also need a funded deployer and
the project owner's explicit approval.

| # | Requirement | Why | Status |
|---|---|---|---|
| 1 | Five independent signer operators, each with their own nodes | The federation is only as strong as the independence of its members | Open |
| 2 | External audits of `BridgeMint` and `KasPool` (and the SilverScript they compile to) and of the vault | No part is audited yet | Open |
| 3 | The vault owner is an AccessManager whose admin is a Safe: 48-hour delays, about 6 for the guardian and unpause, and independent cancellers | The owner is the one role not capped by the release allowance | Open: the deployer builds it (`mainnet:plan` refuses anything else on mainnet); the Safe's holders and the cancellers are still to be chosen |
| 4 | Legal review of holding users' USDT | The vaults custody user funds | Open |
| 5 | Proof of reserves published live (INV-1) | Anyone should be able to see that backing covers circulation | Open |
| 6 | kUSDT's genesis reviewed by kascov.io | Wallets mark unreviewed tokens "unvalidated" | Open |
| 7 | The pool admin key held offline by the operator | It can take only the accrued protocol fees, unpause the pool and hand the keys over ([KasPool](/contracts/kaspool/#protocol-fees-and-the-admin)) | Open |
| 8 | A decision on redemptions to a blocked recipient | Ethereum USDT can blacklist an address, and a payout there would be frozen | Done (4 November 2026): a blocked recipient is never paid; the burn is held and paid if the address is unblocked. No re-target power exists. See [Blocked recipients](/security/known-limits/#blocked-recipients) |
| 9 | Burn finality scaled to the payout | A release cannot be undone | Done (5 November 2026): 6 000 DAA above 10 000 kUSDT, 36 000 above 100 000; the preflight refuses shallower tiers |

## Operations

Not items of the specification's checklist, but part of running the bridge safely:

- the [monitor](/security/monitor/) running on its own nodes, with the guardian keys, and its `GET /health` wired to
  uptime alerts;
- planned governance announced in the monitor's `expectedGovernance` before the signers sign it, or the monitor
  pauses everything;
- an operator ready to investigate and acknowledge alarms. Acknowledging never unpauses.

The runbook is on [Operations](/developers/operations/).

## From the attack review

The [attack review](/security/threat-model/#attack-vectors) adds these, in order:

1. The pool's circuit breaker. **Done.**
2. No silent worse re-quotes in the wallet. **Being built.**
3. At least 2 independent monitors, with external alerts on `/health`.
4. Five independent signer operators (item 1), each with a pruned Kaspa node and independent EVM RPCs (see
   [What a signer needs](/developers/operations/#what-a-signer-needs)).
5. External audits (item 2), and allowances sized to what can be lost. With 3 stolen keys, today's limits risk
   about 500 000 USDT from the vaults, plus at most about 10 % of the pool's KAS.

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
  the pool admin, the coordinator and the deployer, each key in one role only; the owners are contracts; the SPEC
  §8 limits, with every override named; the deployer can pay.
- `execute` runs only the plan whose SHA-256 the reviewers confirmed, behind
  `KUSDT_CONFIRM_MAINNET=deploy-kusdt-mainnet`, with the plan's deployer keys, and after the live checks pass
  again. It records each step and never deploys anything twice.
- `verify` is for every operator: each vault's token, signers in order, guardian, owner and limits, and the launch
  states against the scripts their UTXOs commit to.

`npm run mainnet:rehearse` (in `bridge/devnet`, with `npm run local:stack` up) runs the three commands against
forks of Ethereum and BNB Chain that keep their chain IDs, so the vault deploy takes its mainnet path against the
real USDT, and a simnet Kaspa node. It passed on 5 November 2026. It covered:
- the refusals: a wrong plan hash, no confirmation, the wrong keys;
- the deploy;
- a second execute that sent nothing;
- verify;
- the five signers running, and each role's preflight;
- each vault's AccessManager: the Safe's direct calls revert, it pauses at once, its unpause waits the
  emergency delay, a canceller cancels a queued `setSigners` but not an admin call;
- a live monitor with a canceller key: an announced call passes quietly, an unannounced `setSigners` is alarmed
  and cancelled, the Safe's admin call is alarmed, the guardian pauses, and the integrators' signal says stop.

The rehearsal for release candidate `mainnet-v0.9.8-rc.1` passed all 48 checks.
