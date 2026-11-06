import type { $ZodRawIssue } from 'zod/v4/core';



import type { ZodType } from 'zod';

import type { ValidatorContext, ValidupError } from 'validup';



export type ZodIssue = $ZodRawIssue;

export type ZodCreateFn<C, Z extends ZodType> = (ctx: ValidatorContext<C>) => Z;

export type ZodCreateValidatorOptions = {
    /**
     * Mark the resulting validator as having side effects (network
     * calls, sibling-field reads, observable state) so the framework
     * never caches its outcome. Default `false` — most zod schemas
     * (`z.string().email()`, length / regex / enum checks) are
     * deterministic and safe to cache by `(ctx.value, ctx.context,
     * ctx.group)`. Set to `true` for schemas that use async refines,
     * `superRefine` calls reading external state, or transforms with
     * side effects.
     */
    sideEffect?: boolean,
};
