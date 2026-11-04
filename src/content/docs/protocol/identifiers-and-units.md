---
title: Networks, units and recipients
description: The networks kUSDT runs on, the chain codes, the base unit, and how a Kaspa address becomes a deposit recipient.
---

This section is the protocol specification in readable form. Where code and the specification disagree, one of
them is a bug.

## Networks

| | Testnet | Mainnet |
|---|---|---|
| Kaspa | testnet-10 | mainnet |
| Ethereum | Sepolia (chain ID 11155111) | Ethereum (chain ID 1) |
| BNB Chain | BSC testnet (chain ID 97) | BNB Smart Chain (chain ID 56) |
| Ethereum USDT | `MockUSDT`, 6 decimals (kUSDT's own test token) | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| BNB Chain USDT | `MockUSDT`, 18 decimals (kUSDT's own test token) | `0x55d398326f99059fF775485246999027B3197955` (BSC-USD) |

## Chain codes

Kaspa-side messages name the EVM chain with one byte:

| Code | Chain |
|---|---|
| `0x01` | Ethereum |
| `0x02` | BNB Chain |

BridgeMint refuses any other code.

## Deployments

A **deployment** is the pair (kUSDT covenant ID, vault addresses). Testnet and mainnet are separate
deployments. Every signature names the deployment it is for: mint and governance digests include the covenant
ID, and EIP-712 messages include the chain ID and the vault address. A signature for one deployment is useless
in another.

## Units

| Rule | Detail |
|---|---|
| Base unit | 10⁻⁶ USDT. kUSDT has 6 decimals. Every amount in the protocol, on every chain, is a whole number of base units |
| EVM conversion | token amount = units × 10^(decimals − 6). This factor is the vault's `scale` |
| Ethereum | USDT has 6 decimals, so `scale` = 1 |
| BNB Chain | BSC-USD has 18 decimals, so `scale` = 10¹² and a deposit moves `units × 10¹²` of the token. Amounts that are not a whole number of units cannot be deposited |
| Kaspa integers | 64-bit signed. The hard cap of 10¹⁵ units keeps every sum far below 2⁶³ |

For example, 25.5 USDT is 25 500 000 units on every chain. On BNB Chain the vault moves 25 500 000 × 10¹² of
BSC-USD's smallest unit.

## Kaspa recipients

A deposit names its Kaspa recipient as a KCC-2 owner: a pair (`owner_scheme`, `owner`). The wallet and the web
app derive it from a Kaspa address:

| Kaspa address | `owner_scheme` | `owner` (32 bytes) |
|---|---|---|
| Schnorr P2PK (`kaspa:q…`, 32-byte key) | `0x00` p2pk-schnorr | The x-only public key |
| ECDSA P2PK (33-byte key) | `0x02` p2pkh-ecdsa | `BLAKE3(compressed key)` |
| P2SH (`kaspa:p…`) | `0x03` p2sh | The 32-byte script hash |
| (no address) | `0x04` covenant-id | A covenant ID, for contracts |

`0x01` (p2pkh-schnorr, `BLAKE3` of a 32-byte Schnorr key) is accepted too. The vaults reject any other scheme
byte and a zero owner.

:::caution
A deposit to an owner nobody controls cannot be recovered after it is minted. Wallets should derive the owner
from the user's own address, not ask the user to type it.
:::
