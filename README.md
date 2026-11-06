# kUSDT documentation

kUSDT is USDT locked on Ethereum and BNB Chain and issued 1:1 on Kaspa Layer 1 as a KCC-20
covenant token, with a KAS ⇄ kUSDT pool on Kaspa L1.

**Read the documentation: https://kaspador.github.io/kusdt-docs/** (also at
https://trestly.io/docs/, next to the testnet itself)

It covers how the bridge and the pool work, the security model (trust, threats and attack
vectors, the monitor, known limits) and how to operate and build on them.

**Status:** a public testnet at https://kusdt.pearlchain.live (Ethereum Sepolia, BSC testnet,
Kaspa testnet-10), with test coins only; start with
[Test on the public testnet](https://kaspador.github.io/kusdt-docs/getting-started/public-testnet/).
Not audited. Nothing is deployed on any mainnet, and no real funds are involved.

## This repository

The source of the site, built with [Astro Starlight](https://starlight.astro.build). The pages
are Markdown files under `src/content/docs/`.

| Command | Does |
|---|---|
| `npm ci` | Installs the dependencies from the lockfile (use `npm install --legacy-peer-deps` if npm reports an "edgesOut" error) |
| `npm run dev` | Local preview at `http://localhost:4321` |
| `npm run build` | Builds the site into `dist/` for the root of a domain, and fails on any broken internal link |
| `npm run build:pages` | Builds for a sub-path: set `SITE_URL` and `BASE_PATH` (for this site `https://kaspador.github.io` and `/kusdt-docs`) |

The published site is the `gh-pages` branch.
