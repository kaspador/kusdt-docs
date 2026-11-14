---
title: Roadmap
description: What is done, the mainnet launch, and what comes next.
---

As of 14 November 2026. Order follows the project's working plan; apart from the launch there are no dates.

## Done

- Protocol specification v1.
- `BridgeMint` and the kUSDT token family on Kaspa L1, with VM tests; the `KCC20` template matches the standard.
- KasPool on Kaspa L1, with VM tests (175 Rust tests for both covenants and their builders).
- `KusdtVault` for Ethereum and BNB Chain, with 209 Hardhat tests, reviewed line by line against the specification.
- Transaction builders for every kUSDT and KasPool transaction, as a CLI and as WebAssembly.
- The full Kaspa-side flow, bridge and pool, accepted by a kaspad v2.1.0 simnet node.
- The signer and coordinator services, and a local end-to-end run of the whole bridge: two Hardhat chains, the
  simnet, 5 signers and the coordinator (deposit, mint, burn, release, healthy reserves, pool API).
- The monitor and guardian: in the local run it caught a forged 400 000 kUSDT mint and paused both vaults, the minter and the pool (within seconds until rc.19; since round 16 within `failClosedMs`, 5 minutes, of seeing the mint).
- `npm run local:stack`, the whole stack kept running for the wallet and the web app.
- The wallet extension, tested live against the local stack and on the public testnet.
- The web app, tested on the live stack and with the real wallet extension.
- Refunds, a load run, a rehearsal of the vault on mainnet forks, and an internal security review with its fixes.
- Deployment tooling: a services image, a testnet compose file, a runbook, and mainnet packages for the signer, coordinator, monitor, deployer and web app (built and rehearsed).
- The public testnet: vaults on Sepolia and BSC testnet, genesis and pool on testnet-10, and the services, public
  from 4 to 14 November 2026 with a testnet build of the wallet. It has ended
  ([The public testnet](/getting-started/public-testnet/)).
- The vault owner as an OpenZeppelin AccessManager under a Safe, which the mainnet deployer builds and verifies, and a monitor that watches the owner and can hold a canceller key.
- The pool's net-flow circuit breaker, finality tiers for larger burns, and an HSM or KMS signing option.
- `kusdt govern-sign`, `govern-submit` and `rotate-plan`, with a signer rotation rehearsal.
- The Reserves page, which showed proof of reserves live on the public testnet, and WalletConnect in the web app.
- A CI job that recompiles the covenant bytecode and compares it.
- Four outside reviews, each finding answered on [Audit status](/security/audit-status/). None of them is an audit.
- This documentation site.

## Now: the mainnet launch

kUSDT launches on mainnet on 14 November 2026 (Kaspa, Ethereum and BNB Chain), from the release
`mainnet-v0.9.8-rc.25`. The web app opens at [trestly.io](https://trestly.io) once the launch is verified, and the
addresses are published on [Status](/overview/status/#addresses) at the same time.

## Next

| # | Work |
|---|---|
| 1 | The mainnet version of kUSDT Wallet, published right after the launch |
| 2 | The open items of the [mainnet checklist](/security/mainnet-checklist/), among them an external audit, the legal review and a genesis review by kascov.io |

No independent audit has been done, and the legal review is still open ([Audit status](/security/audit-status/)).

## Later

**Zero-knowledge light-client verification** is the planned upgrade to the federated bridge: minting against a
proof checked on-chain, rather than signer signatures. It is not part of v1. See
[Known limits](/security/known-limits/).
