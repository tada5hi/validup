/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            // Point at the workspace sources so edits to the core / vue / zod
            // packages hot-reload here without a rebuild.
            validup: fileURLToPath(new URL('../../packages/validup/src/index.ts', import.meta.url)),
            '@validup/vue': fileURLToPath(new URL('../../packages/vue/src/index.ts', import.meta.url)),
            '@validup/zod': fileURLToPath(new URL('../../packages/zod/src/index.ts', import.meta.url)),
        },
    },
    server: { port: 5173 },
});
