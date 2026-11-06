import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ValidatorContext } from 'validup';



export type StandardSchemaCreateFn<C, S extends StandardSchemaV1> = (
    ctx: ValidatorContext<C>,
) => S;

export type StandardSchemaCreateValidatorOptions = {
    /**
     * Mark the resulting validator as having side effects (network
     * calls, sibling-field reads, observable state) so the framework
     * never caches its outcome. Default `false` — most Standard
     * Schema validators (regex / length / enum / type checks) are
     * deterministic and safe to cache by `(ctx.value, ctx.context,
     * ctx.group)`. Set to `true` for schemas that resolve against
     * external state.
     */
    sideEffect?: boolean,
};
