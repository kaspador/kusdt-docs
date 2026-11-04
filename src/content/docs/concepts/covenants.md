---
title: Covenants in plain words
description: What a Kaspa covenant is, and the KIP-17 introspection opcodes that make covenants possible.
---

kUSDT and KasPool are built from **covenants**. This page explains the idea and the Kaspa feature behind it,
KIP-17.

## From coins to covenants

Kaspa keeps money in **UTXOs** (unspent transaction outputs). A UTXO holds an amount of KAS and a locking
script, the *script public key*. A transaction spends UTXOs as its inputs and creates new UTXOs as its outputs.
To spend a UTXO, the transaction must satisfy its locking script, usually with a signature.

An ordinary locking script asks one question: *is the spender allowed?* It does not care what the transaction
does with the money.

A **covenant** also asks: *is the transaction allowed?* KCC-1 defines it as "a spending program that inspects
transaction context and restricts how outputs of this transaction might be spent by future transactions". A
covenant can require that the transaction creates specific outputs, with specific scripts, amounts and data.

That is enough to build a token. A kUSDT balance is a UTXO whose covenant accepts a transaction only if it
creates new kUSDT UTXOs that preserve the total amount, and only if the owner approved it.

## KIP-17: the opcodes

KIP-17 ("Covenants and Improved Scripting Capabilities") gave Kaspa's script language what covenants need. It
activated with the **Toccata** hard fork.

| Group | Examples | What a covenant does with them |
|---|---|---|
| Transaction introspection | `OpTxVersion`, `OpTxLockTime`, `OpTxPayloadLen`, `OpTxPayloadSubstr` | Read the transaction's own fields, such as its lock time or payload |
| Input and output introspection | `OpTxInputAmount`, `OpTxInputSpk`, `OpTxOutputAmount`, `OpTxOutputSpk`, `OpTxInputDaaScore` | Check what is spent and what is created |
| Byte strings | `OpCat`, `OpSubstr`, `OpAnd`, `OpOr`, `OpXor` | Assemble and take apart encoded state and messages |
| Arithmetic | `OpMul`, `OpDiv`, `OpMod` | Compute fees, limits and pool prices (64-bit; errors on overflow) |
| Hashes | `OpBlake3`, `OpBlake3WithKey`, `OpBlake2bWithKey` | Hash messages and commitments |
| Signatures over data | `OpCheckSigFromStack` (Schnorr), `OpCheckSigFromStackECDSA` | Verify a signature over any 32-byte message, not only over the transaction |
| Number encoding | `OpNum2Bin`, `OpBin2Num` | Convert between numbers and fixed-width bytes |

After activation, a script element can be up to 1 000 000 bytes, up from 520. Transaction mass, Kaspa's measure
of a transaction's cost, bounds scripts long before that.

## How kUSDT uses them

| kUSDT needs to | Uses |
|---|---|
| Verify 3 signer signatures over a mint digest | `OpCheckSigFromStack` with Schnorr keys |
| Compute the mint and governance digests | `OpCat` and `OpBlake3` |
| Prove that a DAA score has been reached | The transaction's lock time (`OpTxLockTime`); consensus accepts the transaction only after the DAG reaches it |
| Compare pool reserves exactly | `OpMul`, `OpDiv`, `OpMod` on 31-bit limbs (see [KasPool](/contracts/kaspool/)) |
| Force the exact next state | Output introspection: rebuild the expected next script and compare it |

## Why introspection alone is not enough

With KIP-17 alone, a covenant can check its outputs, but it cannot easily tell a genuine kUSDT UTXO from a
forged copy that someone created with the same script. Proving lineage would require carrying parent and
grandparent transactions as witness data. [KIP-20 covenant IDs](/concepts/covenant-ids/) solve this at the
consensus level.

## How the contracts are written

kUSDT's covenants are written in **Argent**, an actor-based language and compiler for stateful, multi-contract
applications on covenant UTXOs. Argent builds on the **SilverScript** compiler, which produces the final Kaspa
script. In Argent, an *actor* owns typed state, an *entry* is one way to spend it, and `become` declares the
successor UTXOs that the transaction must create.
