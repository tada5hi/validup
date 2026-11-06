import { IssueCode } from '@ebec/core';



export type ValidatorJsFn = (value: string, ...args: any[]) => boolean;

// Public interface name supports downstream declaration merging.
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface BaseFactoryOptions {
    /**
     * Override the default English message produced by the factory. The
     * default tracks `@ilingo/validup`'s `en` catalog so the same wording
     * surfaces with and without i18n.
     */
    message?: string;
}

// Public interface name supports downstream declaration merging.
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface CreateValidatorOptions extends BaseFactoryOptions {
    /**
     * `IssueCode` value (or any project-specific string) attached to the
     * `IssueItem` on failure.
     */
    code: string;
    /**
     * Optional structured payload surfaced on `IssueItem.data` — what
     * the i18n template's `{{placeholders}}` resolve against.
     */
    data?: Record<string, unknown>;
}
