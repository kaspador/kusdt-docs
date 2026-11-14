---
title: Token metadata (KCC-23)
description: How kUSDT's name, symbol and decimals are bound to its covenant ID at genesis.
---

KCC-23 ("Metadata JSON") binds a JSON description to a covenant ID. kUSDT uses it to declare its name, symbol
and decimals once, at launch, without repeating them in every token UTXO.

## How the binding works

Deployment takes two transactions:

1. A **preparation transaction** (version 1) whose payload is the byte `0x00` followed by a UTF-8 JSON object.
   It creates one output.
2. The **genesis transaction**, which spends that output to create the covenant's first UTXOs.

The preparation transaction's ID commits to its payload. Under KIP-20, the covenant ID commits to the outpoint
the genesis spends. So the covenant ID, through the outpoint and the transaction ID, commits to the exact
metadata bytes, including whitespace and key order.

```text
payload = 0x00 ‖ UTF-8 JSON object
```

## kUSDT's metadata

The specification fixes these fields: `{"name":"kUSDT","symbol":"kUSDT","decimals":6,…}`. The simnet run used:

```json
{
  "name": "kUSDT",
  "symbol": "kUSDT",
  "decimals": 6,
  "description": "USDT from Ethereum and BNB Chain, on Kaspa L1"
}
```

On mainnet the deploy plan uses the description "USDT from Ethereum and BNB Chain on Kaspa L1". The mainnet metadata is published with the deployment, whose IDs are on [Status](/overview/status/#addresses) once the launch is verified. The public testnet, which ended on 14 November 2026, used "USDT from Ethereum and BNB Chain on Kaspa L1 (testnet)".

## Verifying it yourself

A reader with the two transactions can check the binding without trusting whoever supplied them:

1. Confirm the preparation transaction is version 1 and its payload is `0x00` plus one JSON object.
2. Recompute its transaction ID from its fields and payload.
3. Check that the genesis transaction's authorizing input spends an output of that transaction.
4. Recompute the covenant ID from that outpoint and the genesis outputs under KIP-20, and compare it with the
   kUSDT covenant ID.

## What metadata does not do

Metadata is descriptive. It adds no spending authority and changes no rule. Anyone can deploy another token
named "kUSDT"; only the covenant ID identifies the real one.
