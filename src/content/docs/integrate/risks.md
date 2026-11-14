---
title: Risks to tell your users
description: What an integrator should tell users about kUSDT and the bridge before they use it, with links to the security pages.
---

:::caution[Mainnet, not audited]
kUSDT launches on mainnet (Kaspa mainnet, Ethereum and BNB Chain) on 14 November 2026, with real USDT. The
deployment's vaults, covenant ID, pool ID and API address are published on [Status](/overview/status/#addresses)
once the launch is verified. Nothing has been independently audited, and a legal review is open
([Audit status](/security/audit-status/)). The public testnet ended on 14 November 2026.
:::

If you offer kUSDT or the bridge to your users, tell them what can go wrong. The list below is a summary. The
security pages are the full account, and they change as the project does: link to them rather than copy them.

| Page | What it covers |
|---|---|
| [Known limits](/security/known-limits/) | Limits of the v1 design that users, partners and auditors should know about |
| [Threat model](/security/threat-model/) | What each party that could be compromised can and cannot do, with numbers |
| [Audit status](/security/audit-status/) | What has been reviewed and tested, and what has not |
| [Trust model](/security/trust-model/) | Who and what a kUSDT holder relies on |
| [Terms of Service](/reference/terms/) | The terms the web app and kUSDT Wallet ask users to accept |

## What to tell users

- **Not audited.** kUSDT is on mainnet with real USDT, and no part of it has had an independent audit: not the
  Kaspa covenants, not the vault, not the transaction builders. Internal and outside reviews are not audits. An
  independent audit and a legal review are open items of the [mainnet checklist](/security/mainnet-checklist/).
- **Real money.** From 14 November 2026 kUSDT runs on Kaspa mainnet, Ethereum and BNB Chain. A mistake costs real
  USDT. The public testnet ended the same day, so there is no public place left to try it with test coins.
- **kUSDT is not USDT.** It is not issued by Tether. It is backed by USDT held in the bridge's vaults
  ([FAQ](/reference/faq/#is-kusdt-issued-by-tether)).
- **The bridge is federated.** 5 signers attest to deposits and burns, and any 3 suffice. Three stolen keys could
  mint unbacked kUSDT or pay out without burns, within the daily limits
  ([The bridge is federated](/security/known-limits/#the-bridge-is-federated),
  [Threat model](/security/threat-model/#summary)).
- **Check the covenant ID.** Any token can call itself kUSDT. Only the covenant ID identifies the real one
  ([Holding kUSDT in another wallet](/getting-started/wallet/#holding-kusdt-in-another-wallet)).
- **A burn cannot be undone.** A redemption pays the address it names, and nobody can redirect it. A wrong address
  loses the funds ([Redeem kUSDT](/getting-started/redeem/#before-you-start)).
- **Some burns are never paid.** An amount at or below the release fee, and any burn that is not a plain one
  ([Small burns are not paid](/security/known-limits/#small-burns-are-not-paid),
  [Only plain burns are paid](/security/known-limits/#only-plain-burns-are-paid)).
- **Tether can block payouts.** A recipient the token blocks is not paid until it is unblocked; a blocked vault
  pays nothing out ([Blocked recipients](/security/known-limits/#blocked-recipients),
  [Tether can block payouts](/security/known-limits/#tether-can-block-payouts)).
- **A redemption is paid by one vault.** It must fit that vault's backing and release capacity
  ([Redemptions depend on one vault](/security/known-limits/#redemptions-depend-on-one-vault)).
- **USDT sent straight to a vault is lost.** Only the vault's deposit function bridges
  ([Known limits](/security/known-limits/#usdt-sent-straight-to-a-vault-is-lost)).
- **The bridge can be paused and can wait.** The guardian pauses the vaults, the minter and the pool on any alarm.
  Every payout waits 10 minutes in the vault before it is sent, and mints and payouts also wait when the daily
  limit (50 000 kUSDT per 24 hours at the launch) is used up
  ([Guardian and pause](/security/guardian/),
  [The daily limit can be used up by one party](/security/known-limits/#the-daily-limit-can-be-used-up-by-one-party)).
- **The pool caps sells and can be paused.** Sells may take at most 10 % of the pool's KAS per hour, net of buys; a
  paused pool takes no swaps ([The pool caps sells](/security/known-limits/#the-pool-caps-sells),
  [The pool can be paused](/security/known-limits/#the-pool-can-be-paused)).
- **Fees and KAS.** Bridging costs a fee each way, swaps cost 0.50 %, and every Kaspa transaction pays a network fee.
  A burn output locks 0.3 KAS for good ([Fees](/protocol/fees/),
  [Burns lock KAS too](/security/known-limits/#burns-lock-kas-too)).

## Your own part

Tell users who runs your integration and who to ask about it. Don't present the bridge's rules as your own
promises, and don't describe kUSDT with words the security pages don't support. See
[Using the name](/reference/media-kit/#using-the-name).
