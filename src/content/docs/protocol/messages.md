---
title: Messages and digests
description: Every signed message, digest, identifier and event in kUSDT, byte for byte.
---

This page collects every exact format. Unless stated otherwise, `‖` is byte concatenation and integers in Kaspa
digests are **8-byte little-endian** and must not be negative.

## Kaspa digests (signed with Schnorr)

### Mint digest

```text
BLAKE3( "kUSDT/mint/v2" ‖ covenant_id[32] ‖ chain[1] ‖ first_nonce[8] ‖ age_daa[8]
        ‖ for each recipient (1 to 3): owner_scheme[1] ‖ owner[32] ‖ amount[8] )
```

Signed by 3 distinct signers. Signatures are 64-byte Schnorr signatures over the 32-byte digest, checked with
`OpCheckSigFromStack`. They are passed with the signer indices (0 to 4) in strictly increasing order.

### Govern digest

```text
BLAKE3( "kUSDT/govern/v2" ‖ covenant_id[32] ‖ nonce[8] ‖ age_daa[8] ‖ action[1] ‖ params )
```

`nonce` is the minter's `admin_nonce`, or its `recovery_nonce` for a recovery proposal or veto. `age_daa` is the age of
the minter UTXO the governance transaction claims, which refills the mint allowance: it is signed, so the transaction
must claim exactly that age, and it is valid once the UTXO is that old. 0 is always valid and credits no refill.
Integers are 8 bytes, little-endian. The string was `kUSDT/govern/v1` before the age was signed (rc.16): a signature
over the old message never verifies under this one.

| Action | Code | `params` | Length | Quorum |
|---|---|---|---|---|
| `unpause` | `0x01` | none; signed over the unpause digest below, not the govern digest | 0 | 4 |
| `set_limits` | `0x02` | `capacity[8] ‖ refill_per_daa[8]` | 16 | 4 |
| `set_signers` | `0x03` | `signer_set[32] ‖ guardian[32]` | 64 | 4 |
| `skip_nonce` | `0x04` | `chain[1] ‖ nonce[8]`; the nonce must be the chain's current one | 9 | 4 |
| `set_value` | `0x05` | `value[8]`, the minter's own KAS deposit in sompi, above 0 | 8 | 4 |

### Unpause digest

```text
BLAKE3( "kUSDT/unpause/v2" ‖ covenant_id[32] ‖ admin_nonce[8] ‖ age_daa[8] ‖ outpoint_txid[32] ‖ outpoint_index[8] )
```

The outpoint is the transaction ID and output index of the paused minter UTXO the unpause spends, and `age_daa` is the
age of that UTXO the unpause claims, signed as in the govern digest (integers as 8-byte little-endian; 104 bytes in
all). An unpause is therefore good for that one coin: it cannot be signed before the pause
exists, and any other spend of the paused minter (another governance action, a recovery proposal, a veto, a recovery
carried out) makes a new coin and voids it.

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
event ReleaseQueued(bytes32 indexed redeemId, address indexed recipient,
                    uint256 units, uint256 fee, uint256 payout, uint64 readyAt);
event RefundQueued(uint64 indexed nonce, address indexed recipient, uint256 units, uint64 readyAt);
// The USDT has left the vault:
event Released(bytes32 indexed redeemId, address indexed recipient,
               uint256 units, uint256 fee, uint256 payout);
event Refunded(uint64 indexed nonce, address indexed recipient, uint256 units);
```

Administrative events: `FeesSet`, `DepositSurgeSet`, `DepositLimitsSet`, `ReleaseLimitsSet`, `PayoutDelaySet`, `ReleaseCancelled`, `RefundCancelled`, `ReleaseReinstated`, `RefundReinstated`, `SignersSet`, `GuardianSet`,
`FeesWithdrawn`, and OpenZeppelin's `Paused`, `Unpaused`, `OwnershipTransferStarted` and
`OwnershipTransferred`.

## Domain separation

| String | Used in |
|---|---|
| `kUSDT/mint/v2` | Mint digest |
| `kUSDT/govern/v2` | Govern digest |
| `kUSDT/unpause/v2` | Unpause digest |
| `kUSDT/redeem/v1` | Burn script `R` |
| `kusdt/redeem/v1` | EVM redeem ID |
| `KUSDT` | Redemption payload magic |
| `kUSDT Vault`, version `1` | EIP-712 domain |
