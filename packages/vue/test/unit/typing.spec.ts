/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { describe, expect, it } from 'vitest';
import { nextTick, reactive } from 'vue';
import { Container } from 'validup';
import type { ObjectLiteral, Validator } from 'validup';
import { useValidup } from '../../src';
import type {
    Composable,
    FieldState,
    FieldsAccessor,
} from '../../src';

const isString: Validator = (ctx) => {
    if (typeof ctx.value !== 'string') {
        throw new Error('Value must be a string');
    }
    return ctx.value;
};

async function flush() {
    await nextTick();
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
    });
    await nextTick();
}

// Compile-time only — these assertions live in declarations so they fail
// `tsc --noEmit` if the typing regresses. No runtime assertions needed.
type User = {
    id: number,
    name: string,
    email: string,
    createdAt: Date,
};

describe('typing: fields strict-mode access (issue #391)', () => {
    it('typed key access returns FieldState<T[K]> (never undefined)', async () => {
        const container = new Container<User>();
        container.mount('name', isString);

        const state = reactive({ name: '', email: '' });
        const $v = useValidup(container, state);
        await flush();

        // Compile-time: `$v.fields.name` must be `FieldState<string>`, not
        // `FieldState<string> | undefined`. Strict equality with a non-null
        // target proves the absence of `| undefined` in the inferred type.
        const nameField: FieldState<string> = $v.fields.name;
        expect(nameField).toBeDefined();
    });

    it('optional keys of T also return FieldState (never undefined)', async () => {
        // `nickname?: string | null` — an optional key. Without the `-?`
        // modifier the homomorphic FieldsAccessor mapping preserves the
        // optional marker and widens `$v.fields.nickname` to
        // `FieldState<...> | undefined`, forcing strict-mode consumers
        // into non-null assertions (the Proxy materialises the state on
        // first access, so it is never undefined at runtime).
        type Profile = {
            name: string,
            nickname?: string | null,
        };

        const container = new Container<Profile>();
        container.mount('name', isString);

        const state = reactive({ name: '', nickname: '' });
        const $v = useValidup(container, state);
        await flush();

        // Compile-time: assignment to a non-optional target proves the
        // absence of `| undefined` on the property itself.
        const nicknameField: FieldState<string | null | undefined> = $v.fields.nickname;
        expect(nicknameField).toBeDefined();
        expect(nicknameField.$model.value).toBe('');
    });

    it('fields.at(path) accepts dotted / bracketed paths', async () => {
        const container = new Container<{ user: { email: string }; tags: string[] }>();
        const child = new Container<{ email: string }>();
        child.mount('email', isString);
        container.mount('user', child);

        const state = reactive({ user: { email: 'peter@example.com' }, tags: ['urgent'] });
        const $v = useValidup(container, state);
        await flush();

        expect($v.fields.at('user.email').$model.value).toBe('peter@example.com');
        expect($v.fields.at('tags[0]').$model.value).toBe('urgent');

        // Returned identity should match what typed-key access returns for
        // the same path — both go through the same FieldState cache.
        const a = $v.fields.at('user');
        const b = $v.fields.user;
        expect(a).toBe(b);
    });

    it('fields.at returns a typed FieldState (generic V)', async () => {
        const container = new Container<{ name: string }>();
        container.mount('name', isString);

        const state = reactive({ name: 'peter' });
        const $v = useValidup(container, state);
        await flush();

        const named: FieldState<string> = $v.fields.at<string>('name');
        expect(named.$model.value).toBe('peter');
    });
});

describe('typing: state accepts Partial<T> (issue #392)', () => {
    it('accepts a form narrower than the container entity', async () => {
        const container = new Container<User>();
        container.mount('name', isString);
        container.mount('email', isString);

        // Form omits `id` / `createdAt` — server-set fields not relevant to
        // the validator. Pre-fix this required `form as any`.
        const form = reactive({ name: 'peter', email: 'peter@example.com' });
        const $v: Composable<User> = useValidup(container, form);
        await flush();

        // T stays bound to User, so typed-key access still works against
        // the entity shape, not the narrower form.
        const nameField: FieldState<string> = $v.fields.name;
        expect(nameField.$model.value).toBe('peter');
        expect($v.fields.email.$model.value).toBe('peter@example.com');
    });

    it('accepts an empty form (every field is optional in Partial<T>)', async () => {
        const container = new Container<User>();
        container.mount('name', isString);

        const form = reactive({} as Partial<User>);
        const $v: Composable<User> = useValidup(container, form);
        await flush();

        // Form starts empty; writing through $model populates state.
        $v.fields.name.$model.value = 'peter';
        await flush();
        expect(form.name).toBe('peter');
    });
});

/*
 * `FieldsAccessor` has to satisfy three constraints that pull against each
 * other, and every single-line spelling of the mapped type found so far
 * satisfies exactly two. The three cases below are the ones that broke
 * historically — keep all three, they are not redundant:
 *
 *   - `K in keyof T as …`      (0.3.3)  keeps #423 + #455, breaks #391
 *   - `K in keyof T as …`-?    (b65e2ce) keeps #391 + #455, breaks #423
 *   - `K in Exclude<keyof T,…>` (29d0cab) keeps #391 + #423, breaks #455
 *
 * These are COMPILE-TIME assertions and only run under
 * `npm run test:types` (`tsc --noEmit`) — vitest erases types, so a
 * regression here is invisible to `npm run test`.
 *
 * They must be EXACT-TYPE assertions (`Equals`), not assignability
 * checks. The #455 regression degrades a typed key to `FieldState<any>`,
 * and `FieldState<any>` is assignable to `FieldState<string>` in both
 * directions — so `const x: FieldState<string> = fields.name` passes
 * against the very defect it would exist to catch.
 */
type Equals<X, Y> = (<G>() => G extends X ? 1 : 2) extends (<G>() => G extends Y ? 1 : 2) ? true : false;
type Assert<T extends true> = T;

/** Entity carrying extra attributes — the authup `User` shape from #455. */
type Indexed = {
    name: string,
    email: string,
    nickname?: string | null,
    [key: string]: any,
};

type Profile = {
    name: string,
    nickname?: string | null,
};

declare const cUser: Composable<User>;
declare const cProfile: Composable<Profile>;
declare const cIndexed: Composable<Indexed>;
declare const cOpen: Composable<ObjectLiteral>;

/* #391 — the property carries no optional marker, but the value type keeps
 * its own `undefined`. Both halves matter: `-?` also strips `undefined`
 * from the value when the mapped value is a bare `T[K]`. */
export type _t391 = Assert<Equals<
    typeof cProfile.fields.nickname,
    FieldState<string | null | undefined>
>>;

/* #455 — declared keys keep their type when `T` also has an index
 * signature. `keyof Indexed` is `string | number`, so any mapping keyed
 * off `keyof T` as a set collapses these to the index entry. */
export type _t455a = Assert<Equals<typeof cIndexed.fields.name, FieldState<string>>>;
export type _t455b = Assert<Equals<typeof cIndexed.fields.email, FieldState<string>>>;
export type _t455c = Assert<Equals<
    typeof cIndexed.fields.nickname,
    FieldState<string | null | undefined>
>>;

/* Baseline: an index-signature-free entity is unaffected. */
export type _t455d = Assert<Equals<typeof cUser.fields.name, FieldState<string>>>;
export type _t455e = Assert<Equals<typeof cUser.fields.createdAt, FieldState<Date>>>;

/* The catch-all entry an index signature contributes is `any`, exactly.
 * This is the documented cost of the #423 leg (a `FieldState<…>` value
 * type there rejects the sibling `at` method), so it is pinned rather
 * than left to whatever falls out. `.$model.value` alone would not pin
 * it: that expression compiles for `any` AND for `FieldState<any>`.
 * A union such as `FieldState<any> | AtFn` satisfies #423 too, and only
 * these two cases tell it apart from `any`. */
export type _t455f = Assert<Equals<typeof cIndexed.fields.whatever, any>>;
export type _t455g = Assert<Equals<typeof cOpen.fields.whatever, any>>;

/*
 * Assignment-based assertions. These are values, so they live in a
 * function that is declared and never invoked — a module-scope
 * `const x: Wide = narrow` would run at import time and blow up on the
 * erased `declare const` bindings above.
 */
function assertAssignability(
    user: Composable<User>,
    profile: Composable<Profile>,
    indexed: Composable<Indexed>,
    open: Composable<ObjectLiteral>,
    userFields: FieldsAccessor<User>,
) {
    /* #423 — generic components declare props as `Composable<ObjectLiteral>`
     * (the playground's `ResultPanel.vue`) and receive typed composables. */
    const widened1: Composable<ObjectLiteral> = user;
    const widened2: Composable<ObjectLiteral> = profile;
    const widened3: Composable<ObjectLiteral> = indexed;

    /* …and the accessor widens on its own, not only via TypeScript's
     * variance fast path for `Composable`. The `Exclude` spelling passed
     * the three assignments above while failing this one, so it is a
     * separate case rather than a redundant one. */
    const widenedFields: FieldsAccessor<ObjectLiteral> = userFields;

    /* `at` is reachable in every shape, including when `T`'s index
     * signature supplies a competing catch-all entry. */
    const dynamic1: FieldState<string> = user.fields.at<string>('a.b');
    const dynamic2: FieldState<string> = indexed.fields.at<string>('a.b');
    const dynamic3: FieldState<string> = open.fields.at<string>('a.b');

    /* Undeclared keys stay usable wherever `T` admits them. */
    const loose1 = open.fields.whatever.$model.value;
    const loose2 = indexed.fields.whatever.$model.value;

    return [
        widened1, 
        widened2, 
        widened3, 
        widenedFields,
        dynamic1, 
        dynamic2, 
        dynamic3, 
        loose1, 
        loose2,
    ];
}

describe('typing: FieldsAccessor mapped-type constraints', () => {
    it('resolves typed keys at runtime for an entity with an index signature', async () => {
        // Runtime companion to the compile-time block above: the Proxy
        // materialises a FieldState for declared and undeclared keys alike,
        // which is what makes the missing `| undefined` honest. `extra` is
        // the undeclared half — it exists only via the index signature, so
        // it is the key the type-level `any` case describes.
        const container = new Container<Indexed>();
        container.mount('name', isString);

        const state = reactive<Indexed>({
            name: 'peter',
            email: 'peter@example.com',
            extra: 'rides along',
        });
        const $v = useValidup(container, state);
        await flush();

        expect($v.fields.name.$model.value).toBe('peter');
        expect($v.fields.email.$model.value).toBe('peter@example.com');
        expect($v.fields.extra.$model.value).toBe('rides along');
        expect($v.fields.at('name')).toBe($v.fields.name);
        expect($v.fields.at('extra')).toBe($v.fields.extra);

        // A key absent from state entirely still materialises rather than
        // returning undefined — the contract the missing `| undefined`
        // on typed keys rests on.
        expect($v.fields.absent).toBeDefined();
        expect($v.fields.absent.$model.value).toBeUndefined();
    });
});
