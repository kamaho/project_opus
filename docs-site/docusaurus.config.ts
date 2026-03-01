import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

/**
 * Bygg uten internt-dokumentasjon (offentlig deploy):
 *   DOCS_PUBLIC_ONLY=true npm run build
 *
 * Bygg med internt (internt.revizo.no):
 *   npm run build
 */
const isPublicOnly = process.env.DOCS_PUBLIC_ONLY === 'true';

const config: Config = {
  title: 'Revizo dokumentasjon',
  tagline: 'Avstemming og regnskapsflyt — enkelt og trygt',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://docs.revizo.no',
  baseUrl: '/',

  organizationName: 'revizo',
  projectName: 'docs',

  onBrokenLinks: 'warn',

  i18n: {
    defaultLocale: 'nb',
    locales: ['nb'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
          editUrl: undefined, // Sett til GitHub-repo når repo er bestemt
          exclude: isPublicOnly ? ['**/internt/**'] : [],
        },
        blog: {
          showReadingTime: true,
          routeBasePath: 'blog',
          editUrl: undefined,
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/revizo-social-card.jpg',
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Revizo',
      logo: {
        alt: 'Revizo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Dokumentasjon',
        },
        {to: '/blog', label: 'Blogg', position: 'left'},
        {
          href: 'https://github.com/revizo/project_opus',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Dokumentasjon',
          items: [
            {label: 'Kom i gang', to: '/docs/kom-i-gang/opprett-konto'},
            {label: 'Guider', to: '/docs/guider/administrasjon/brukeradministrasjon'},
            {label: 'FAQ', to: '/docs/faq/generelt'},
          ],
        },
        {
          title: 'Revizo',
          items: [
            {label: 'App', href: 'https://app.revizo.no'},
            {label: 'Support', href: 'mailto:support@accountcontrol.no'},
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Revizo. Bygget med Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
