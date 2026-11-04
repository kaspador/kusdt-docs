// kUSDT documentation site. Static output only: `npm run build` writes dist/.
//
// SITE_URL (optional) is the public origin the site will be served from, for
// example https://docs.example.org. It enables the sitemap and canonical URLs.
// BASE_PATH (optional) is the path under that origin, for a site that doesn't
// live at its root (GitHub Pages: https://<owner>.github.io/<repo>/ needs
// BASE_PATH=/<repo>). The pages link to each other with root paths
// ("/protocol/finality/"): `npm run build:pages` prefixes them after the build
// (scripts/base-links.mjs).
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import pearlDark from './src/themes/pearl-dark.json' with { type: 'json' };
import pearlLight from './src/themes/pearl-light.json' with { type: 'json' };

const site = process.env.SITE_URL || undefined;
const base = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  integrations: [
    starlight({
      title: 'kUSDT',
      description:
        'kUSDT: USDT locked on Ethereum and BNB Chain, issued 1:1 on Kaspa Layer 1 as a KCC-20 covenant token.',
      favicon: '/favicon.svg',
      customCss: ['./src/styles/pearl.css'],
      // Links are validated on the root build (`npm run build`); a build under a base path
      // keeps the pages' root links and prefixes them afterwards (scripts/base-links.mjs).
      plugins: base === '/' ? [starlightLinksValidator()] : [],
      expressiveCode: {
        themes: [pearlDark, pearlLight],
        useStarlightUiThemeColors: true,
        styleOverrides: {
          borderRadius: '0.375rem',
          codeFontFamily: 'var(--__sl-font-mono)',
          uiFontFamily: 'var(--__sl-font)',
          frames: { tooltipSuccessBackground: '#5a4e42', tooltipSuccessForeground: '#f0efea' },
        },
      },
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      sidebar: [
        {
          label: 'Overview',
          items: [
            { label: 'What is kUSDT', link: '/' },
            'overview/why-kaspa-l1',
            'overview/status',
          ],
        },
        {
          label: 'Getting started',
          items: [
            'getting-started/public-testnet',
            'getting-started/web-app',
            'getting-started/bridge-in',
            'getting-started/swap',
            'getting-started/redeem',
            'getting-started/wallet',
          ],
        },
        {
          label: 'Concepts',
          items: [
            'concepts/covenants',
            'concepts/covenant-ids',
            'concepts/states-and-templates',
            'concepts/owner-schemes',
            'concepts/kcc20-tokens',
            'concepts/borrowed-receive',
            'concepts/metadata',
          ],
        },
        {
          label: 'Architecture',
          items: [
            'architecture/overview',
            'architecture/components',
            'architecture/communication',
            'architecture/following-states',
          ],
        },
        {
          label: 'Protocol',
          items: [
            'protocol/identifiers-and-units',
            'protocol/deposits-and-mints',
            'protocol/redemptions-and-releases',
            'protocol/burn-owner-and-payload',
            'protocol/refunds',
            'protocol/fees',
            'protocol/limits',
            'protocol/finality',
            'protocol/messages',
            'protocol/coordinator-api',
            'protocol/wallet-provider',
          ],
        },
        {
          label: 'Contracts',
          items: ['contracts/bridge-mint', 'contracts/kusdt-token', 'contracts/kaspool', 'contracts/kusdt-vault'],
        },
        {
          label: 'Security',
          items: [
            'security/trust-model',
            'security/threat-model',
            'security/invariants',
            'security/governance',
            'security/guardian',
            'security/monitor',
            'security/known-limits',
            'security/audit-status',
            'security/mainnet-checklist',
          ],
        },
        {
          label: 'Kaspa specifics',
          items: [
            'kaspa/signature-operations',
            'kaspa/storage-mass',
            'kaspa/relay-fees',
            'kaspa/kcc20-template',
          ],
        },
        {
          label: 'Developers',
          items: [
            'developers/repository',
            'developers/build-and-test',
            'developers/kusdt-tx',
            'developers/verify-template',
            'developers/simnet',
            'developers/operations',
          ],
        },
        {
          label: 'Reference',
          items: ['reference/faq', 'reference/glossary', 'reference/roadmap'],
        },
      ],
    }),
  ],
});
