---
title: Glossary
description: Terms used in the kUSDT documentation.
---

| Term | Meaning |
|---|---|
| Accepting block | The Kaspa block that accepts a transaction into the ledger |
| Actor | In Argent, a covenant type that owns typed state and defines entries |
| Allowance | A rate limit that holds up to a capacity and refills at a fixed rate. BridgeMint has a mint allowance; each vault has a release allowance |
| Argent | The actor-based language kUSDT's covenants are written in. It builds on the SilverScript compiler |
| Backing | A vault's USDT minus its accrued fees: `balance − feesAccrued` |
| Base unit | 10⁻⁶ USDT. Every protocol amount is a whole number of base units |
| Borrowed receive | A KCC-20 feature that lets a sender add tokens to a recipient's existing UTXO. Disabled on minted, burn and reserve states |
| BridgeMint | The covenant actor that is the only issuer of kUSDT |
| Burn owner | A P2SH owner whose script starts with `OP_RETURN` and names a payout chain and address. Tokens sent to it never move again |
| Chain code | One byte naming the EVM chain on Kaspa: `0x01` Ethereum, `0x02` BNB Chain |
| Continuation | An output that a spent covenant UTXO accepts as its successor |
| Coordinator | The bridge server that collects signatures, submits transactions and serves status. Trusted with nothing that moves funds |
| Covenant | A locking script that checks the transaction spending it, not only who spends it |
| Covenant family | The UTXOs that share one covenant ID |
| Covenant ID | A 32-byte identifier carried by covenant UTXOs (KIP-20). kUSDT's covenant ID is its identity |
| DAA score | Kaspa's measure of DAG progress; it rises about 10 times per second |
| Delegator | In a multi-input covenant transition, an input that checks only its own conditions and relies on the leader |
| Deployment | The pair (kUSDT covenant ID, vault addresses) |
| Digest | A 32-byte hash that signers sign |
| EIP-712 | The Ethereum standard for signing typed structured data, used for `Release` and `Refund` |
| Entry, entrypoint | One way to spend a covenant, with typed arguments |
| Extension commitment | A 32-byte hash of extended token state. Zero for every kUSDT state |
| Finality | The point after which a chain does not reverse a block. See [Finality](/protocol/finality/) |
| Genesis | The transaction that creates a covenant ID's first UTXOs |
| Guardian | A key that can pause BridgeMint and the vaults, and nothing else |
| KAS | Kaspa's native coin. 1 KAS = 10⁸ sompi |
| KasPool | The KAS⇄kUSDT constant-product pool on Kaspa L1 |
| KCC | Kaspa Call for Conventions: a shared convention for the Kaspa ecosystem (KCC-1, -2, -20, -23) |
| KCC-20 | The Kaspa fungible-token convention |
| KIP | Kaspa Improvement Proposal: a consensus or node change (KIP-17, KIP-20) |
| Layer 1 (L1) | The Kaspa network itself |
| Layer 2 (L2) | A separate system built on top of Kaspa, such as Igra or Kasplex. kUSDT uses none |
| Leader | In a multi-input covenant transition, the first input of the family, which validates the whole transition |
| Mass | Kaspa's measure of a transaction's cost: compute, storage and transient |
| Minted | A deposit's amount less its fee: what BridgeMint mints for it |
| Monitor | The service that checks INV-1 and holds the guardian key |
| Nonce | A deposit's sequence number in its vault: 0, 1, 2, … |
| Owner scheme | A KCC-2 byte that says how a token state's `owner` is interpreted |
| P2SH | Pay to script hash: a UTXO locked to the hash of a script |
| Payload | A Kaspa transaction's free data field |
| Plurality | The number of 100-byte storage units a UTXO occupies; 2 for covenant UTXOs |
| Position | A KasPool UTXO that records liquidity shares and their owner |
| Quorum | The number of distinct signers required: 3 for mints and releases, 4 for most governance |
| Redeem ID | `keccak256("kusdt/redeem/v1" ‖ kaspaTxId ‖ outputIndex)`: identifies a burn output on the EVM side |
| Release | A vault payout for a Kaspa burn |
| Refund | A vault return of a deposit that Kaspa skipped |
| Reserve | The pool's KAS (in the Pool UTXO) and its kUSDT (a KCC20 state owned by the pool's covenant ID) |
| Signer | One of 5 independent parties that attest to deposits and burns |
| SilverScript | The covenant compiler that Argent builds on |
| Simnet | A local, private Kaspa test network |
| Sompi | The smallest unit of KAS, 10⁻⁸ KAS |
| Template | A covenant program with its state cut out. Its hash identifies the code |
| TokenSeed | A reference actor that creates zero-amount token states |
| UTXO | Unspent transaction output: a coin-like record a transaction spends in full |
| Vault | `KusdtVault`, the contract on each EVM chain that holds the backing USDT |
