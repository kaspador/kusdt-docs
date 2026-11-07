---
title: Roadmap
description: What is done, what comes next, and what has to happen before mainnet.
---

As of 7 November 2026. Order follows the project's working plan; there are no dates.

## Done

- Protocol specification v1.
- `BridgeMint` and the kUSDT token family on Kaspa L1, with 22 VM tests; the `KCC20` template matches the standard.
- KasPool on Kaspa L1, with 23 VM tests.
- `KusdtVault` for Ethereum and BNB Chain, with 102 Hardhat tests, reviewed line by line against the specification.
- Transaction builders for every kUSDT and KasPool transaction, as a CLI and as WebAssembly.
- The full Kaspa-side flow, bridge and pool, accepted by a kaspad v2.1.0 simnet node.
- The signer and coordinator services, and a local end-to-end run of the whole bridge: two Hardhat chains, the
  simnet, 5 signers and the coordinator (deposit, mint, burn, release, healthy reserves, pool API).
- The monitor and guardian: in the local run it caught a forged 400 000 kUSDT mint and paused both vaults, the minter and the pool within seconds.
- `npm run local:stack`, the whole stack kept running for the wallet and the web app.
- The wallet extension, tested live against the local stack, with a testnet build to download (not in any store).
- The web app, tested on the live stack and with the real wallet extension.
- Refunds, a load run, a rehearsal of the vault on mainnet forks, and an internal security review with its fixes.
- Deployment tooling: a services image, a testnet compose file, a runbook, and mainnet packages for the signer, coordinator, monitor, deployer and web app (built and rehearsed; nothing is on mainnet).
- The testnets: vaults on Sepolia and BSC testnet, genesis and pool on testnet-10, and the services, public since
  4 November 2026 at [trestly.io](https://trestly.io) with a downloadable testnet wallet.
- The vault owner as an OpenZeppelin AccessManager under a Safe, which the mainnet deployer builds and verifies, and a monitor that watches the owner and can hold a canceller key.
- The pool's net-flow circuit breaker, finality tiers for larger burns, and an HSM or KMS signing option.
- `kusdt govern-sign`, `govern-submit` and `rotate-plan`, with a signer rotation rehearsal.
- The Reserves page, showing proof of reserves live on the testnet, and WalletConnect in the web app.
- A CI job that recompiles the covenant bytecode and compares it.
- Four outside reviews, each finding answered on [Audit status](/security/audit-status/). None of them is an audit.
- This documentation site.

## Next

| # | Work |
|---|---|
| 1 | The next release candidate, with the fourth outside review's fixes |
| 2 | The open items of the mainnet checklist |

## Before mainnet

Every item of the [mainnet checklist](/security/mainnet-checklist/): five independent signer operators (five are lined up), external audits, the vault owner as an AccessManager under a Safe, legal review, live proof of reserves, and a genesis review by
kascov.io. Mainnet deployments also need the project owner's explicit approval.

## Later

**Zero-knowledge light-client verification** is the planned upgrade to the federated bridge: minting against a
proof checked on-chain, rather than signer signatures. It is not part of v1. See
[Known limits](/security/known-limits/).
