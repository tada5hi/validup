/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import * as blemish from 'blemish';
import { describe, expect, it } from 'vitest';
import * as validup from '../../src';

// The issue model lives in `blemish` and is re-exported wholesale by
// `src/index.ts`. Its behaviour is covered there; what validup owns is the
// SURFACE — that the extraction stayed invisible to consumers who import
// these symbols from `validup`, as promised in tada5hi/validup#464.
//
// Scope note: this asserts source-level identity. The other half of the
// promise is a BUILD property — tsdown must emit `export * from "blemish"`
// in `dist/index.d.mts` rather than inlining the declarations, because
// inlining would break cross-package type identity and the documented
// `declare module 'validup' { interface IssueDataByCode { … } }`
// augmentation. That is verified against built artifacts, not here; see
// `.agents/architecture.md`.

describe('issue model re-export', () => {
    // Every symbol validup exported from its own `src/issue/` before the
    // extraction. A missing entry here is a breaking change for consumers,
    // which is exactly what the extraction promised not to be.
    const RE_EXPORTED = [
        'IssueCode',
        'defineIssueItem',
        'defineIssueGroup',
        'isIssue',
        'isIssueItem',
        'isIssueGroup',
        'flattenIssueItems',
        'flattenIssueGroups',
        'formatIssue',
        'interpolate',
    ] as const;

    it.each(RE_EXPORTED)('still exports %s', (name) => {
        expect(validup).toHaveProperty(name);
    });

    it.each(RE_EXPORTED)('exports the same %s object as blemish, not a copy', (name) => {
        // `toBe`, not `toEqual` — a re-implementation or a second bundled copy
        // would satisfy structural equality while silently doubling the model.
        expect(validup[name]).toBe(blemish[name]);
    });

    it('additionally exports prefixIssuePath', () => {
        // New to validup's surface: it was a private `Container` method and is
        // now the shared rule every producer of a nested tree needs. Additive,
        // so not a break — but it IS part of the public API now.
        expect(validup.prefixIssuePath).toBe(blemish.prefixIssuePath);
    });

    it('keeps interpolate behaviourally identical to the @ebec/core one it replaced', () => {
        // validup re-exported `@ebec/core`'s `interpolate` publicly; blemish
        // now supplies an inlined reproduction. Pin the three properties a
        // consumer could depend on: `{name}` syntax, the third `regex`
        // argument, and leaving an unresolved placeholder verbatim.
        expect(validup.interpolate('hello {who}', { who: 'world' })).toBe('hello world');
        expect(validup.interpolate('hello %who%', { who: 'world' }, /%(\w+)%/g)).toBe('hello world');
        expect(validup.interpolate('hello {who}', {})).toBe('hello {who}');
    });

    it('produces issues the runtime and the model agree on', () => {
        // End-to-end across the seam: an issue built through validup's
        // re-export must satisfy blemish's own guard, and vice versa. Both
        // directions matter — this is the property that lets a validup issue
        // tree nest inside another library's.
        const viaValidup = validup.defineIssueItem({
            code: validup.IssueCode.MIN_LENGTH,
            path: ['name'],
            message: 'too short',
            data: { min: 3 },
        });
        const viaBlemish = blemish.defineIssueItem({
            code: blemish.IssueCode.REQUIRED,
            path: ['email'],
            message: 'required',
        });

        expect(blemish.isIssueItem(viaValidup)).toBe(true);
        expect(validup.isIssueItem(viaBlemish)).toBe(true);
    });
});
