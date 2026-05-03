/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import config from '@tada5hi/eslint-config';

export default [
    ...await config(),
    { ignores: ['**/dist/**', '**/*.d.ts', '**/.vitepress/cache/**'] },
    {
        languageOptions: { globals: { NodeJS: true } },
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-use-before-define': 'off',
        },
    },
];
