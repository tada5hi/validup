/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export * from './helpers';
export * from './constants';
export * from './error';

// Backward-compatibility re-export of the issue model, which lives in
// `blemish` since #464. Everything in this repo — including all four
// integration packages — imports it from `'blemish'` directly; this line
// exists purely so pre-extraction consumer imports keep resolving.
//
// Scheduled for removal in v2.0.0 (#466). Do not add internal usages that
// depend on it, and prefer `blemish` in docs aimed at library authors.
// `scripts/verify-reexport.mjs` guards that it stays a real `export *` in
// the emitted declarations while it is still here.
export * from 'blemish';

export * from './container';
export * from './builder';
export * from './cache';
export * from './types';
export * from './utils';
export * from './validator';
