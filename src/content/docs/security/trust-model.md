---
title: Trust model
description: Who and what you trust when you hold kUSDT, and what each party is trusted with.
---

kUSDT combines parts with very different trust. Transfers on Kaspa are as trustworthy as Kaspa itself. The bridge
between Kaspa and the EVM chains is a **federation**: it relies on a group of signers not colluding.

## What you rely on

| You rely on | For | If it fails |
|---|---|---|
| Kaspa consensus | Transfers, swaps and burns follow the covenant rules | kUSDT on Kaspa is unsafe |
| Ethereum and BNB Chain consensus | The vaults follow their code; deposits stay final | The affected vault is unsafe |
| No 3 of the 5 signers colluding | Every mint matches a deposit, every release matches a burn | A bad quorum can move up to the daily limits (see [Threat model](/security/threat-model/)) |
| At least 3 of the 5 signers being online and honest | Mints and releases happen at all | The bridge stalls; no funds move |
| The vault owner (a Safe behind a 48-hour timelock) | Vault parameters and the vault's signer set | After the timelock, it could replace the signers and raise limits within the hard bounds |
| The USDT issuers | The backing stays transferable | Tether can blacklist an address on Ethereum (BSC-USD keeps no blacklist). The bridge pays nothing to a blacklisted recipient: the burn waits until it is unblocked. A blacklisted vault can pay nothing out, and the guardian pauses everything ([Blocked recipients](/security/known-limits/#blocked-recipients)) |
| The contract code | Every rule on this site is what the code does | Not audited yet; see [Audit status](/security/audit-status/) |

## What each part is trusted with

| Part | Trusted with | Not trusted with |
|---|---|---|
| kUSDT covenant family | The token itself. `BridgeMint` is the only issuer | |
| Vault, one per chain | All locked USDT; pays out only with 3 of 5 signatures, within a daily limit. No proxy and no upgrade key: nobody can swap its code, and a bug means a new vault | |
| Signers (5, independent) | One Kaspa Schnorr key and one EVM ECDSA key each | Acting alone: one or two signers can do nothing |
| Guardian | One key that can pause the vaults, the minter and the pool | Anything else |
| Pool admin | The pool's protocol fees, unpausing it, its keys | The reserves, any position, the circuit breaker |
| Coordinator | Nothing that moves funds | Its claims are never taken as fact |
| Vault owner | Vault parameters within hard bounds, and the vault's signer set | The backing itself |
| Wallet and web app | The user's keys | They pin the deployment, so they cannot be pointed at a copy |

## Assumptions

- **Safety assumes at most 2 of the 5 signers misbehave.** A bad quorum of 3 still cannot mint or release more
  than the [allowances](/protocol/limits/), and cannot undo the guardian's pause, because unpausing takes 4.
- **With 4 bad signers, Kaspa's limits fall**, because 4 signers set them. The vaults' release allowance is set
  only by the vault owner, so USDT can leave no faster than that, and the guardian pauses the vaults the moment
  INV-1 fails. See the [threat model](/security/threat-model/).
- **Every signer checks every request against its own nodes** before signing. A signer never takes the
  coordinator's word for a deposit, a burn, finality or an amount.
- **Signers are independent.** Before mainnet, the five must be run by five independent operators, each with
  their own nodes ([mainnet checklist](/security/mainnet-checklist/)). Each needs a pruned Kaspa node with
  `--utxoindex` and at least 2 independent EVM RPC providers per chain, different from the other signers'. See
  [What a signer needs](/developers/operations/#what-a-signer-needs). Today all 5 testnet signers run on one
  machine.
- **Forged kUSDT looks real to the pool.** With 3 stolen signer keys it is the same token. The pool's circuit
  breaker caps a dump at about 10 % of its KAS per hour, until the guardian pauses it. See
  [KasPool](/contracts/kaspool/#the-circuit-breaker).

## Why a federation

Kaspa's script engine cannot read Ethereum or BNB Chain, and those chains cannot read Kaspa. Something must
attest to what happened on the other side. In v1, that is the signer federation, with rate limits on both sides
to cap the damage if it fails. The planned upgrade is zero-knowledge light-client verification, which would
replace the signers' attestation with proofs checked on-chain. See [Known limits](/security/known-limits/).
