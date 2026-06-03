/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        name: 'home',
        component: () => import('./pages/Home.vue'),
        meta: { title: 'Overview' },
    },
    {
        path: '/basic',
        name: 'basic',
        component: () => import('./pages/BasicForm.vue'),
        meta: { title: 'Basic form' },
    },
    {
        path: '/groups',
        name: 'groups',
        component: () => import('./pages/GroupsForm.vue'),
        meta: { title: 'Groups (create / update)' },
    },
    {
        path: '/nested',
        name: 'nested',
        component: () => import('./pages/NestedForms.vue'),
        meta: { title: 'Nested forms' },
    },
    {
        path: '/async',
        name: 'async',
        component: () => import('./pages/AsyncForm.vue'),
        meta: { title: 'Async + debounce' },
    },
    {
        path: '/server-errors',
        name: 'server-errors',
        component: () => import('./pages/ServerErrors.vue'),
        meta: { title: 'Server errors' },
    },
    {
        path: '/severity',
        name: 'severity',
        component: () => import('./pages/Severity.vue'),
        meta: { title: 'Severity (optional)' },
    },
];

export const router = createRouter({
    history: createWebHashHistory(),
    routes,
});
