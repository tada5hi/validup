/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { IssueCode } from './constants';
import type {
    BareIssueCode,
    IssueDataByCode,
    ParameterizedIssueCode,
} from './constants';
import type {
    IssueBase,
    IssueGroup,
    IssueItem,
    IssueItemBare,
    IssueItemRaw,
    IssueItemTyped,
    ResolveIssueCode,
} from './types';

interface DefineIssueItemCommon extends Omit<IssueBase, 'data'> {
    received?: unknown,
    expected?: unknown,
}

/**
 * Per-call `data` shape for {@link defineIssueItem}. The `data`
 * requirement is selected from the resolved `code`:
 *
 * - Parameterized code → `data` required, typed per {@link IssueDataByCode}.
 * - Bare code (incl. omitted, which resolves to `VALUE_INVALID`)
 *   → `data` must be absent / `undefined`.
 * - Ad-hoc string code → `data` optional `Record`.
 */
type DefineIssueItemData<C> = DefineIssueItemCommon & {
    code?: C,
} & (
    ResolveIssueCode<C> extends ParameterizedIssueCode ?
        { data: IssueDataByCode[ResolveIssueCode<C> & ParameterizedIssueCode] } :
        ResolveIssueCode<C> extends BareIssueCode ?
            { data?: undefined } :
            { data?: Record<string, unknown> }
);

/**
 * Return type for {@link defineIssueItem} — picks the concrete `IssueItem`
 * variant matching the resolved `code`.
 */
type DefineIssueItemReturn<C> =    ResolveIssueCode<C> extends ParameterizedIssueCode ?
    Extract<IssueItemTyped, { code: ResolveIssueCode<C> }> :
    ResolveIssueCode<C> extends BareIssueCode ?
        Extract<IssueItemBare, { code: ResolveIssueCode<C> }> :
        IssueItemRaw;

/**
 * Build an `IssueItem`. TS uses the supplied `code` to pick the right
 * `data` requirement at the call site — passing `MIN_LENGTH` without
 * `data: { min }` is a compile error; passing `STRONG_PASSWORD` with
 * `data: { pointsPerUnique: 5 }` is a compile error.
 *
 * `code` may be omitted (defaults to `IssueCode.VALUE_INVALID` — bare,
 * no data).
 */
export function defineIssueItem<C extends string | undefined = undefined>(
    data: DefineIssueItemData<C>,
): DefineIssueItemReturn<C> {
    return {
        type: 'item',
        ...data,
        code: (data as { code?: string }).code || IssueCode.VALUE_INVALID,
    } as unknown as DefineIssueItemReturn<C>;
}

export function defineIssueGroup(data: Omit<IssueGroup, 'type'>): IssueGroup {
    return {
        type: 'group',
        ...data,
    };
}
