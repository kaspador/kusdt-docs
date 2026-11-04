---
title: Messages and digests
description: Every signed message, digest, identifier and event in kUSDT, byte for byte.
---

This page collects every exact format. Unless stated otherwise, `‖` is byte concatenation and integers in Kaspa
digests are **8-byte little-endian** and must not be negative.

## Kaspa digests (signed with Schnorr)

### Mint digest

```text
BLAKE3( "kUSDT/mint/v1" ‖ covenant_id[32] ‖ chain[1] ‖ first_nonce[8]
        ‖ for each recipient (1 to 3): owner_scheme[1] ‖ owner[32] ‖ amount[8] )
```

Signed by 3 distinct signers. Signatures are 64-byte Schnorr signatures over the 32-byte digest, checked with
`OpCheckSigFromStack`. They are passed with the signer indices (0 to 4) in strictly increasing order.

### Govern digest

```text
BLAKE3( "kUSDT/govern/v1" ‖ covenant_id[32] ‖ admin_nonce[8] ‖ action[1] ‖ params )
```

| Action | Code | `params` | Length | Quorum |
|---|---|---|---|---|
| `unpause` | `0x01` | none | 0 | 4 |
| `set_limits` | `0x02` | `capacity[8] ‖ refill_per_daa[8]` | 16 | 4 |
| `set_signers` | `0x03` | `signer_set[32] ‖ guardian[32]` | 64 | 4 |
| `skip_nonce` | `0x04` | `chain[1] ‖ nonce[8]`; the nonce must be the chain's current one | 9 | 4 |
| `set_value` | `0x05` | `value[8]`, the minter's own KAS deposit in sompi, above 0 | 8 | 3 |

Each accepted action moves `admin_nonce` forward by one, so every governance message is single-use.

### Signer set

```text
signer_set = BLAKE3( k₀ ‖ k₁ ‖ k₂ ‖ k₃ ‖ k₄ )      // the five 32-byte x-only Schnorr keys, in order
```

BridgeMint stores only this hash. A mint or governance transaction supplies all five keys; the covenant hashes
them and compares.

### Pause

`pause` takes no digest. The guardian signs the transaction itself (a normal transaction signature), and the
covenant checks it against the stored `guardian` key.

## EVM messages (signed with ECDSA, EIP-712)

### Domain

```text
EIP712Domain { name: "kUSDT Vault", version: "1", chainId, verifyingContract }
```

`chainId` and `verifyingContract` make every signature specific to one vault on one chain.

### Types

```text
Release(bytes32 redeemId,address recipient,uint256 units)
Refund(uint64 nonce,address recipient,uint256 units)
```

| Type | Type hash (`keccak256` of the type string) |
|---|---|
| `Release` | `db81a01974a4adb35845f457adf2050874165e1d4b664b7d8094e6b4675adc22` |
| `Refund` | `539b8e204dd36db72fc7fd5517acb891dea7731575f151f5085a553c9a839946` |

The type hashes were computed from the type strings; the vault exposes its own as `RELEASE_TYPEHASH` and
`REFUND_TYPEHASH`, and its digests as `releaseDigest(r)` and `refundDigest(r)`.

At least 3 signatures. The recovered signer addresses must be strictly increasing, which proves they are
distinct. The vault uses OpenZeppelin's `ECDSA.recover`, which rejects malleable (high-s) signatures.

### Redeem ID

```text
redeemId = keccak256( abi.encodePacked("kusdt/redeem/v1", bytes32 kaspaTxId, uint32 outputIndex) )
```

## Kaspa scripts and payloads

### Burn script and burn owner

```text
R(chain, address) = 6a ‖ 0f ‖ "kUSDT/redeem/v1" ‖ 01 ‖ chain ‖ 14 ‖ address[20]
burn owner        = owner_scheme 0x03, owner = BLAKE2b-256(R)
```

### Redemption payload

```text
"KUSDT" ‖ 01 ‖ count[1] ‖ count × ( output_index[1] ‖ chain[1] ‖ address[20] )
```

### Metadata payload (KCC-23)

```text
0x00 ‖ UTF-8 JSON object        // in the version 1 preparation transaction
```

Details: [Burn owner and payload](/protocol/burn-owner-and-payload/), [Token metadata](/concepts/metadata/).

## EVM events

```solidity
event Deposit(uint64 indexed nonce, address indexed sender, uint8 ownerScheme,
              bytes32 owner, uint256 units, uint256 fee, uint256 minted);
event Released(bytes32 indexed redeemId, address indexed recipient,
               uint256 units, uint256 fee, uint256 payout);
event Refunded(uint64 indexed nonce, address indexed recipient, uint256 units);
```

Administrative events: `FeesSet`, `DepositLimitsSet`, `ReleaseLimitsSet`, `SignersSet`, `GuardianSet`,
`FeesWithdrawn`, and OpenZeppelin's `Paused`, `Unpaused`, `OwnershipTransferStarted` and
`OwnershipTransferred`.

## Domain separation

| String | Used in |
|---|---|
| `kUSDT/mint/v1` | Mint digest |
| `kUSDT/govern/v1` | Govern digest |
| `kUSDT/redeem/v1` | Burn script `R` |
| `kusdt/redeem/v1` | EVM redeem ID |
| `KUSDT` | Redemption payload magic |
| `kUSDT Vault`, version `1` | EIP-712 domain |
