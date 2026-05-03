/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { defineConfig } from 'vitepress';

export default defineConfig({
    title: 'validup',
    description: 'Composable, path-based validation for TypeScript — mount validators on any path, run them in groups, collect structured issues.',
    base: '/',
    cleanUrls: true,
    lastUpdated: true,

    head: [
        ['link', {
            rel: 'icon',
            type: 'image/svg+xml',
            href: '/logo.svg',
        }],
        ['meta', { name: 'theme-color', content: '#22c55e' }],
        ['meta', { property: 'og:type', content: 'website' }],
        ['meta', { property: 'og:title', content: 'validup' }],
        ['meta', {
            property: 'og:description',
            content: 'Composable, path-based validation for TypeScript.',
        }],
    ],

    themeConfig: {
        logo: '/logo.svg',

        nav: [
            {
                text: 'Getting Started',
                link: '/getting-started/',
                activeMatch: '/getting-started/',
            },
            {
                text: 'Guide',
                link: '/guide/',
                activeMatch: '/guide/',
            },
            {
                text: 'Integrations',
                link: '/integrations/',
                activeMatch: '/integrations/',
            },
        ],

        sidebar: {
            '/getting-started/': [
                {
                    text: 'Getting Started',
                    items: [
                        { text: 'Introduction', link: '/getting-started/' },
                        { text: 'Installation', link: '/getting-started/installation' },
                        { text: 'Quick Start', link: '/getting-started/quick-start' },
                    ],
                },
            ],
            '/guide/': [
                {
                    text: 'Concepts',
                    items: [
                        { text: 'Overview', link: '/guide/' },
                        { text: 'Container', link: '/guide/container' },
                        { text: 'Builder API', link: '/guide/builder' },
                        { text: 'Validator', link: '/guide/validator' },
                        { text: 'Issues & Errors', link: '/guide/issues' },
                    ],
                },
                {
                    text: 'Mount Options',
                    items: [
                        { text: 'Groups', link: '/guide/groups' },
                        { text: 'Optional Values', link: '/guide/optional' },
                        { text: 'Path Filtering', link: '/guide/path-filtering' },
                        { text: 'One-Of', link: '/guide/one-of' },
                    ],
                },
                {
                    text: 'Execution',
                    items: [
                        { text: 'Run Modes', link: '/guide/run-modes' },
                        { text: 'Cancellation', link: '/guide/cancellation' },
                    ],
                },
            ],
            '/integrations/': [
                {
                    text: 'Integrations',
                    items: [
                        { text: 'Overview', link: '/integrations/' },
                        { text: 'Standard Schema', link: '/integrations/standard-schema' },
                        { text: 'Zod', link: '/integrations/zod' },
                        { text: 'express-validator', link: '/integrations/express-validator' },
                        { text: 'Routup', link: '/integrations/routup' },
                        { text: 'Vue', link: '/integrations/vue' },
                        { text: 'Vuecs Forms (preview)', link: '/integrations/vuecs-forms' },
                    ],
                },
            ],
        },

        socialLinks: [
            { icon: 'github', link: 'https://github.com/tada5hi/validup' },
        ],

        editLink: {
            pattern: 'https://github.com/tada5hi/validup/edit/master/docs/src/:path',
            text: 'Edit this page on GitHub',
        },

        search: { provider: 'local' },

        footer: {
            message: 'Released under the Apache 2.0 License.',
            copyright: 'Copyright © 2024-present Peter Placzek',
        },
    },
});
