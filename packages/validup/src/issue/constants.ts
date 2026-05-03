/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Registry of well-known issue codes. Third-party packages can extend the
 * union via TypeScript declaration merging:
 *
 * ```ts
 * declare module 'validup' {
 *     interface IssueCodeRegistry {
 *         email_taken: 'email_taken';
 *     }
 * }
 * ```
 *
 * After augmentation, `IssueCode` widens to include the new literal so
 * `defineIssueItem({ code: 'email_taken', ... })` is type-checked.
 */
export interface IssueCodeRegistry {
    VALUE_INVALID: 'value_invalid',
    ONE_OF_FAILED: 'one_of_failed',
}

export type IssueCode = IssueCodeRegistry[keyof IssueCodeRegistry];

export const IssueCode = {
    VALUE_INVALID: 'value_invalid',
    ONE_OF_FAILED: 'one_of_failed',
} as const satisfies { [K in keyof IssueCodeRegistry]: IssueCodeRegistry[K] };
