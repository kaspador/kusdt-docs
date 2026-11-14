---
title: Exchanges and custodians
description: Crediting kUSDT deposits on Kaspa, sending kUSDT out, checking the reserves and the bridge's health, and what to do while the bridge is paused.
---

:::caution[Mainnet, not audited]
kUSDT launches on mainnet (Kaspa mainnet, Ethereum and BNB Chain) on 14 November 2026, with real USDT. The
deployment's vaults, covenant ID, pool ID and API address are published on [Status](/overview/status/#addresses)
once the launch is verified. Nothing has been independently audited, and a legal review is open
([Audit status](/security/audit-status/)). To test first, use the public testnet at
[testnet.trestly.io](https://testnet.trestly.io) ([Test on the public testnet](/getting-started/public-testnet/)).
:::

## Know what you are listing

- kUSDT is a token on Kaspa Layer 1. It is not USDT and is not issued by Tether
  ([FAQ](/reference/faq/#is-kusdt-issued-by-tether)).
- It is identified by its covenant ID alone. Anyone can deploy a token named "kUSDT"
  ([Token metadata](/concepts/metadata/#what-metadata-does-not-do)). Take the ID from
  [Status](/overview/status/#addresses) and from the API's `GET /status` (`kaspa.covenantId`), and make it a setting
  rather than code. These pages give no mainnet ID: it is published on Status once the launch is verified.
- It has 6 decimals ([Units](/protocol/identifiers-and-units/#units)).
- It is a KCC-20 token with the standard token code, so tools that read KCC-20 read it
  ([Wallets](/integrate/wallets/)).
- To test your deposit and withdrawal flow before mainnet, use the public testnet: the web app and faucet at
  [testnet.trestly.io](https://testnet.trestly.io), the API at `https://testnet.trestly.io/api/v1`
  ([Test on the public testnet](/getting-started/public-testnet/)). Or run the whole stack locally
  ([Run the simnet flow](/developers/simnet/)).

## Crediting kUSDT deposits

A kUSDT deposit to your exchange is an ordinary KCC-20 transfer to an address you control.

1. **Find the state** with your KCC-20 tooling, or through `GET /tokens?owner=…`, and check it on your own node
   ([Showing a holder's kUSDT](/integrate/wallets/#showing-a-holders-kusdt)). Credit only states with kUSDT's
   covenant ID.
2. **Wait for depth.** Set your own policy. For reference, the bridge's signers count a Kaspa transaction as final
   once its accepting block is at least 1 000 DAA scores below the virtual DAA score (about 100 seconds), and wait
   deeper for larger amounts: 6 000 DAA scores above 10 000 kUSDT, 36 000 above
   100 000 kUSDT ([Finality](/protocol/finality/)).
3. **Check that the bridge is not paused** before you credit (below). kUSDT transfers cannot be paused, and forged
   kUSDT looks exactly like the real token, so the pause, which the monitors set on any alarm, is how you learn that
   something is wrong.

## Sending kUSDT out

A withdrawal to a user is a KCC-20 transfer ([Sending kUSDT](/integrate/wallets/#sending-kusdt)). Keep KAS in the
hot wallet: every kUSDT output carries KAS for its storage (1.5 KAS by default, `tokenValue` in `GET /status`), and
every transaction pays a network fee ([Fees](/protocol/fees/#kas-carried-by-token-states)).

Never send to a burn owner unless you mean to redeem: kUSDT sent to a burn owner is paid out as USDT on an EVM chain
and can never move again ([Burn owner and payload](/protocol/burn-owner-and-payload/)).

## USDT on Ethereum and BNB Chain

If your users bridge from your exchange, warn them: USDT sent to a vault's address with a plain transfer (an exchange
withdrawal, say) is lost. Only the vault's `deposit` bridges
([Known limits](/security/known-limits/#usdt-sent-straight-to-a-vault-is-lost)). Send users to the web app or
kUSDT Wallet instead ([Websites and apps](/integrate/websites/)).

## Checking the reserves and the bridge's health

Before you take kUSDT, and while you hold it:

| Check | Where | Healthy when |
|---|---|---|
| The coordinator's reserves | `GET /reserves` on the API | `healthy` is true: backing ≥ minted − released (INV-1) |
| Proof of reserves, read in your browser | The web app's Reserves page (`https://trestly.io/reserves`, once the launch is verified) | It reads the vaults and the minter itself, next to `GET /reserves` |
| On-chain flags | The minter's `paused` flag, each vault's `paused()`, the pool's `paused` ([how to read them](/integrate/developer-guide/#is-the-bridge-paused)) | All false |
| The same flags, from the API | `GET /status` (each vault's `paused`, the minter's state) and `GET /pool` (`paused`) | All false, and the same as on chain |

The mainnet monitors are private: their alarms go to their operators, and what you see is the pause they set. Treat
no answer, or an answer you cannot read, as paused. The answers and their fields:
[Reading the bridge's state](/integrate/bridge-state/). On the public testnet the monitor's signal is public too
(`https://testnet.trestly.io/monitor/api/v1/signal`), to test against.

## When the bridge is paused

On any alarm the guardian pauses both vaults, the minter and the pool. Then:

- **Stop crediting new kUSDT deposits** and stop accepting kUSDT as payment, until nothing is paused again.
- **Don't send users to bridge.** A paused vault refuses new deposits.
- **Payouts wait.** A burn made while a vault is paused is paid once it runs again
  ([How long it takes](/getting-started/redeem/#how-long-it-takes)).
- **Transfers keep working.** kUSDT has no pause, so users can still move kUSDT on Kaspa. The pool stops swaps and
  new liquidity; withdrawals of liquidity stay open ([What a pause stops](/security/guardian/#what-a-pause-stops)).
- **Resuming is a separate decision.** The monitor never unpauses. The minter needs 4 of 5 signers, each vault its
  owner, the pool its admin ([Who resumes](/security/guardian/#who-resumes)).

Ask in [t.me/trestly](https://t.me/trestly) while it lasts.
