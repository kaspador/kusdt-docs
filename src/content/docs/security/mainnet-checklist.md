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
| 3 | The vault owner is a Safe behind a 48-hour timelock | The owner is the one role not capped by the release allowance | Open. The deploy script refuses a mainnet owner that is not a contract |
| 4 | Legal review of holding users' USDT | The vaults custody user funds | Open |
| 5 | Proof of reserves published live (INV-1) | Anyone should be able to see that backing covers circulation | Open |
| 6 | kUSDT's genesis reviewed by kascov.io | Wallets mark unreviewed tokens "unvalidated" | Open |
| 7 | The pool admin key held offline by the operator | It can take only the accrued protocol fees, unpause the pool and hand the keys over ([KasPool](/contracts/kaspool/#protocol-fees-and-the-admin)) | Open |
| 8 | A decision on redemptions to a blocked recipient | Ethereum USDT can blacklist an address, and a payout there would be frozen | Done (4 November 2026): a blocked recipient is never paid; the burn is held and paid if the address is unblocked. No re-target power exists. See [Blocked recipients](/security/known-limits/#blocked-recipients) |

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
