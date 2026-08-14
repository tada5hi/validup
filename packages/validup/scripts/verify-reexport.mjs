/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Post-build guard on the `blemish` re-export.
 *
 * The issue model lives in `blemish` and is re-exported by `src/index.ts`.
 * Two consumer-facing guarantees depend on that surviving into the emitted
 * declarations as a REAL `export * from "blemish"` rather than being inlined
 * by the bundler:
 *
 * 1. **Cross-package type identity.** `@validup/vue`, `@validup/zod` and
 *    `@validup/standard-schema` import `Issue` / `IssueItem` from `blemish`
 *    directly. If validup inlined its own copies of those declarations, the
 *    two sides would be structurally similar but separately declared.
 * 2. **`declare module 'validup' { interface IssueDataByCode { … } }`.**
 *    TypeScript resolves a module augmentation through a star re-export to
 *    the original declaration. Inline the declarations and the augmentation
 *    silently lands on a different interface, so `ParameterizedIssueCode`
 *    never sees the added code and the producer gatekeep stops applying.
 *
 * Both failures are silent: nothing throws, no test fails, and the emitted
 * `.d.mts` still type-checks. So this runs as part of `npm run build` rather
 * than living in a doc as a "check this after a toolchain change" note —
 * which is what it was until PR #465 review pointed out that a manual step
 * is not a check.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'dist', 'index.d.mts');

let content;
try {
    content = readFileSync(target, 'utf8');
} catch {
    console.error(`[verify-reexport] cannot read ${target} — run the build first.`);
    process.exit(1);
}

const failures = [];

// The star re-export itself. Quote style is bundler-dependent, so accept either.
if (!/export\s+\*\s+from\s+["']blemish["']/.test(content)) {
    failures.push('missing `export * from "blemish"` — the model appears to have been inlined.');
}

// Declarations that must come FROM blemish, never be re-declared here. If the
// bundler inlines the model these show up as local `declare`s.
const INLINED = [
    /^declare\s+const\s+IssueCode\b/m,
    /^declare\s+function\s+defineIssueItem\b/m,
    /^declare\s+function\s+defineIssueGroup\b/m,
    /^declare\s+function\s+flattenIssueItems\b/m,
    /^declare\s+function\s+prefixIssuePath\b/m,
    /^interface\s+IssueDataByCode\b/m,
];

for (const pattern of INLINED) {
    const match = content.match(pattern);
    if (match) {
        failures.push(`inlined blemish declaration found: \`${match[0].trim()}\``);
    }
}

if (failures.length > 0) {
    console.error('[verify-reexport] dist/index.d.mts does not re-export blemish correctly:');
    for (const failure of failures) {
        console.error(`  - ${failure}`);
    }
    console.error('\nSee packages/validup/scripts/verify-reexport.mjs for why this matters.');
    process.exit(1);
}

console.log('[verify-reexport] ok — dist/index.d.mts re-exports blemish without inlining.');
