/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

// `./collector` and `./projection` are deliberately absent — `src/index.ts`
// re-exports this barrel wholesale, so anything listed here becomes public,
// semver-protected API. Both are internal wiring for `useValidup`; specs
// import them by module path.
export * from './child';
export * from './severity';
