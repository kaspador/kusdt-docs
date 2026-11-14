---
title: FAQ
description: Short answers to common questions about kUSDT.
---

## General

### What is kUSDT?

A token on Kaspa Layer 1 backed by USDT locked in vaults on Ethereum and BNB Chain. One kUSDT corresponds to one
USDT in a vault. See [What is kUSDT](/).

### Is kUSDT issued by Tether?

No. kUSDT is a bridged token. The vaults hold USDT on Ethereum and BSC-USD on BNB Chain; kUSDT is not issued by
the issuers of those tokens. kUSDT's own rules are the covenants and contracts described here.

### Is it live?

kUSDT launches on mainnet on 14 November 2026: Kaspa, Ethereum and BNB Chain. Until the launch is verified,
[trestly.io](https://trestly.io) shows a "Launching today" page; the web app opens there once it is, and the
addresses are published on [Status](/overview/status/#addresses). The public testnet ran from 4 to 14 November 2026
and has ended ([The public testnet](/getting-started/public-testnet/)).

### Where are the mainnet addresses?

On [Status](/overview/status/#addresses), once the launch is verified. Until then no mainnet address is published.
Trust no vault address, covenant ID or API that claims to be kUSDT's and is not listed there.

### Who runs the bridge?

Five independent operators run the signers, each on its own machine; any 3 approve a mint or a payout. Two monitors
watch the bridge and can pause it. Each vault is owned by an AccessManager under a 2-of-3 Safe. See the
[trust model](/security/trust-model/) and [Governance](/security/governance/).

### Has it been audited?

No. No independent audit has been done, and the legal review is still open. Internal attack rounds and outside
reviews have taken place, but none of them is an audit. See [Audit status](/security/audit-status/).

### Does kUSDT use Igra or Kasplex?

No. kUSDT runs on Kaspa L1 only. See [Kaspa L1, not a layer 2](/overview/why-kaspa-l1/).

## Using kUSDT

### How do I get kUSDT?

Deposit USDT into the vault on Ethereum or BNB Chain ([Bridge USDT in](/getting-started/bridge-in/)), or buy it
with KAS in KasPool ([Swap](/getting-started/swap/)).

### What does bridging cost?

0.50 % each way. The minimum is 0.50 USDT per deposit, and 5 USDT (Ethereum) or 0.50 USDT (BNB Chain) per
release. A deposit pays more on a busy day: the deposit fee rises with the deposits made on that chain in the last 24 hours,
up to 2.50 %, and the web app and the wallet send nothing that would mint less than they showed you, within a
quarter of a percent. Bridging back always pays the flat fee. You also pay gas on the EVM
chain and a network fee in KAS on Kaspa. See [Fees](/protocol/fees/).

### Why does my kUSDT UTXO hold KAS?

Kaspa requires each UTXO to carry KAS for the storage it uses, and covenant UTXOs count double. Each kUSDT state
carries about 1.5 KAS. It remains yours and moves with the token. The exception is a redemption's burn output: it
carries 0.3 KAS, which is gone for good, since nothing can spend a burn. See [Storage mass](/kaspa/storage-mass/).

### Can I redeem on a different chain from the one I deposited on?

Yes. kUSDT is one token. A redemption names the payout chain, and that chain's vault pays it if it holds enough
backing. See [Known limits](/security/known-limits/#redemptions-depend-on-one-vault).

### What if I send a burn to the wrong address?

The payout goes to that address. Nobody can redirect it, including you. Check the address before you sign.

### Is there a minimum redemption?

A burn must be larger than the release fee: more than 5 USDT on Ethereum, more than 0.50 USDT on BNB Chain.
Smaller burns are never paid.

### Can the bridge freeze my kUSDT?

No. The guardian can pause minting, the vaults and the pool, but kUSDT transfers on Kaspa have no pause. A paused
pool stops swaps and new liquidity; liquidity providers can still withdraw.

### What if USDT blacklists my address?

The bridge pays nothing to an address the token blocks: the USDT would be frozen there for good. Only Ethereum
USDT keeps a blacklist; BSC-USD keeps none. The wallet and the web app check the address before every burn and refuse a blocked one.
If such a burn lands anyway, it is held and paid if Tether unblocks the address. Nobody can send it elsewhere. See
[Blocked recipients](/security/known-limits/#blocked-recipients).

### Which wallets support kUSDT?

Any wallet with KCC-20 support can read kUSDT states, because kUSDT uses the standard template. The mainnet
version of the kUSDT Wallet extension is published right after the launch, and [The wallet](/getting-started/wallet/#install)
will link it then. Always check the covenant ID.

On the web app, kUSDT Wallet is the only Kaspa wallet. KasWare and Kastle are not supported: they signed transactions the
page built and showed neither the amounts nor the network fee in their own windows.

For the Ethereum and BNB Chain side, the web app works with MetaMask and with WalletConnect.

## Security

### Who controls the bridge?

Five independent signers; any 3 approve a mint or a payout. Both sides limit how much can move per day. See the
[trust model](/security/trust-model/).

### What happens if 3 signers are compromised?

They could mint unbacked kUSDT up to the Kaspa allowance (100 000 USDT at once at the mainnet launch) and pay out
from each vault up to its release allowance (50 000 USDT at once at the launch), each refilling over 24 hours. They cannot undo the guardian's pause:
unpausing the minter takes 4 signers, and unpausing a vault takes the owner. See the
[threat model](/security/threat-model/).

### Can the coordinator steal funds?

No. It holds no key that moves funds. It can only stall the bridge.

### Can the vault owner take the USDT?

Not directly: no function lets the owner withdraw backing. It could, after its 48-hour delay and unless a canceller cancels it, replace the
vault's signers and raise its limits within the hard bounds. That is why the owner is a Safe behind an AccessManager, with delays and independent cancellers. See
[Governance](/security/governance/).

### Is the pool safe from sandwich attacks?

Yes. A swap spends the exact pool state it was built on and names the exact output, so a competing swap makes it
invalid rather than worse. See [KasPool](/contracts/kaspool/#why-it-cannot-be-sandwiched).
