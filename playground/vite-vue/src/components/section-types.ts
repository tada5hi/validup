/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

// State shapes shared between the nested-forms page (which owns the state)
// and the section components (which validate it).
export type Profile = { firstName: string; lastName: string };

export type Address = { street: string; city: string };
