---
title: Mainnet servers
description: Every server a kUSDT mainnet launch needs, what each one requires, what can share a machine, and the keys that need no server.
---

Everything the mainnet launch has to run, in one place. Nothing is on mainnet yet. The steps for each role are in its package's own guide, in the [mainnet packages](/developers/operations/#the-mainnet-packages).

In short: **8 large servers and 1 small one**, none of them shared.

## The servers

| Server | How many | CPU, RAM, disk | Funds on it |
|---|---|---|---|
| Signer | 5 | 8 cores, 16 GB, 500 GB NVMe | None |
| Coordinator | 1 | 8 cores, 16 GB, 500 GB NVMe | 1 000 KAS (about 600 deposits), 0.5 ETH and 0.5 BNB to start with, kept topped up |
| Monitor | 2 | 8 cores, 16 GB, 500 GB NVMe | A few KAS, and 0.05 ETH and 0.05 BNB, for a pause |
| Website | 1 | The smallest plan: static files, its container capped at 128 MB | None, and no keys |

Each large server runs its own pruned Kaspa node. All of them run Linux with Docker Engine 24+ and the Compose plugin.

### Network and domains

| Server | Network | Domain |
|---|---|---|
| Signer | A static public IP. Ports 80 and 443 open, nothing else but SSH | Its own name, pointing straight at the machine, with no CDN or proxy |
| Coordinator | A static public IP, which the signers let through. Ports 80 and 443 open | The API's name. A CDN is fine |
| Monitor | Ports 80 and 443 open, and a static IP of your own for operator access | The monitor's name |
| Website | Ports 80 and 443 open | The site's name |

### RPCs

Each large server needs **at least 2 RPCs per chain, for Ethereum and for BNB Chain, from different providers**, with your own API keys. Every RPC must agree, or the service signs nothing or raises an alarm, so one provider alone protects nothing.

Spread them across operators as well: signers should prefer providers the others don't use, and monitors should not use the ones the signers use.

## What can share a machine

Nothing should.

| Combination | |
|---|---|
| A signer with another signer, the coordinator or a monitor | **No.** A signer's machine is its operator's alone |
| A monitor with a signer or the coordinator | **No.** It has to see what they do from outside |
| Two monitors | **No.** Their value is independence: another hosting company and other RPC providers |
| The website with a server that holds keys | **Avoid.** Both want ports 80 and 443, and a public website does not belong next to keys |

A second monitor can hold the same guardian keys, which is recommended since a guardian can only pause, or only watch. The monitor package's guide has both.

## Who runs them

**Five independent signer operators matter more than the hardware.** Minting and releases take 3 of the 5 signers, and governance on Kaspa takes 4. If one person or one hosting company can reach enough machines, those thresholds protect nothing, and a hosting company can reach what runs on its virtual servers. So each signer should be a different operator on a different provider, and the coordinator and the monitors should be spread out too. See the [threat model](/security/threat-model/#four-or-five-signer-keys).

Private keys stay on the machine that made them, with two exceptions: your offline backup, and the guardian keys a second monitor may hold, which its guide says how to copy. Only `public.json` files are sent around.

## What needs no server

| Role | Where it lives | What it needs |
|---|---|---|
| Deployer | A computer with a checkout of the release, used once at launch | 25 KAS (the launch spends about 20) and gas for about 7.5 M gas on each chain, and a synced mainnet Kaspa node to talk to |
| Pool admin | A key on an **offline** machine | A little KAS for the fee when it acts, and a way to carry the signed transaction to a node |
| Cancellers | A hardware wallet, at least one per chain | A little gas. Not a Safe owner, and no other role |
| The Safe's owners | Their own wallets | Gas for their transactions |

## Before buying

- **The 250 GB for a Kaspa node is a planning figure**, scaled up from the testnet node's 60 GB, not a measurement on mainnet. Sync one mainnet node first, then order the rest.
- **The guides set no bandwidth figure.** Avoid plans with a low traffic cap: a node moves a lot of data.
- **Don't copy the testnet.** It runs on one host, which suits test coins and nothing else.
