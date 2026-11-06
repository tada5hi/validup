import type { IContainer } from '../container/types';
import { ValidupError } from '../error';
import type { IssueCode, IssueGroup } from '@ebec/core';



import type { Validator } from '../validator';
import type { compose } from './compose';




import type { OptionalValue } from '../constants';

export type ComposeElement<C = unknown> = Validator<C> | IContainer<any, any>;

export type ComposeOptions = {
    /**
     * Run every validator and require all to pass (default). Stages
     * thread their return into the next; `bail` controls whether the
     * first failure stops the chain (`true`, default) or every failure
     * is collected into one aggregate `ValidupError` (`false`).
     *
     * **Threading rule.** A stage's return replaces the threaded
     * `ctx.value` only when defined — `undefined` is treated as a
     * pass-through so pure checks that don't re-emit `ctx.value`
     * compose cleanly with transformers. Stages that DO want to
     * explicitly clear the field must throw or return a sentinel.
     */
    oneOf?: false,
    bail?: boolean,
} | {
    /**
     * Run branches as alternatives in registration order — the first
     * one to succeed wins, subsequent branches are not invoked, and
     * the composed validator returns the winning branch's value
     * (falling back to `ctx.value` if the winning branch returned
     * `undefined`). When *every* branch fails, the composed validator
     * throws a `ValidupError` whose first issue is an `IssueGroup`
     * with `code: IssueCode.ONE_OF_FAILED` carrying every branch's
     * collected failures (per-branch index surfaced via
     * `data: { branch }`). Symmetric with
     * `Container.options.oneOf`, just at the validator level.
     *
     * Each branch sees the original `ctx.value` — no threading
     * across alternatives, since branches aren't a pipeline.
     * `bail` is intentionally rejected at the type level under this
     * mode: there's no chain to fail-fast over.
     */
    oneOf: true,
};

export type ErrorToIssuesOptions = {
    /**
     * Code stamped on the synthetic `IssueItem` when the thrown value
     * is an `Error` or a non-`Error` throw. Defaults to
     * `IssueCode.VALUE_INVALID`. `ValidupError` issues are spread
     * verbatim and DO NOT get this code applied; their own codes are
     * preserved.
     */
    code?: IssueCode | (string & {}),
    /**
     * Path on the synthetic `IssueItem`. Defaults to `[]`.
     * `ValidupError` issues are spread verbatim with their original
     * paths intact — callers that want to prefix or transform spread
     * paths should do so after this fold (the surrounding Container
     * run loop does this in `prefixIssuePath`, for example).
     */
    path?: PropertyKey[],
};

export type BuildOneOfFailedGroupOptions = {
    /**
     * Path on the wrapping group. Defaults to `[]` — most callers
     * (compose's `composeAnyOf`, the run-loop entry to a oneOf
     * container) emit the group at the boundary they own and let the
     * surrounding context attach a path.
     */
    path?: PropertyKey[],
    /**
     * Override the default English message. The wrapping group
     * carries `code: IssueCode.ONE_OF_FAILED`, so i18n catalogs key
     * off the code rather than the message; the message is only the
     * fallback rendering.
     */
    message?: string,
};

export type OptionalValueInput = `${OptionalValue}` | readonly `${OptionalValue}`[];



export type PathFilterResolution = {
    skip: boolean,
    pathsToInclude: string[] | undefined,
    pathsToExclude: string[] | undefined,
};
