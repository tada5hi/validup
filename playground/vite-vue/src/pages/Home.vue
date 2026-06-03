<!--
  Copyright (c) 2026.
  Author Peter Placzek (tada5hi)
  For the full copyright and license information,
  view the LICENSE file that was distributed with this source code.
-->
<script setup lang="ts">
import { RouterLink } from 'vue-router';

const routes = [
    {
        to: '/basic',
        title: 'Basic form',
        summary: 'A registration form: per-field $model / $dirty / $errors, $validate() on submit.',
    },
    {
        to: '/groups',
        title: 'Groups (create / update)',
        summary: 'One container, two flows. The `password` mount only runs when group = "create".',
    },
    {
        to: '/nested',
        title: 'Nested forms',
        summary: 'A parent useValidup composes two child composables via $getResultsForChild.',
    },
    {
        to: '/async',
        title: 'Async + debounce',
        summary: '`username` is checked against a fake server via zod async refine, debounced.',
    },
    {
        to: '/server-errors',
        title: 'Server errors',
        summary: 'A failed submit injects server-side issues via setExternalIssues — auto-cleared on edit.',
    },
    {
        to: '/severity',
        title: 'Severity',
        summary: 'Optional mounts emit warnings; required mounts upgrade severity to error.',
    },
];
</script>

<template>
    <section
        class="panel"
        style="grid-column: 1 / -1;"
    >
        <h2>validup · Vite + Vue 3 playground</h2>
        <p class="lede">
            Each route exercises a distinct facet of <code>@validup/vue</code> against the
            local workspace packages. Source under <code>playground/vite-vue/src/pages</code>.
        </p>
        <ul style="padding: 0; margin: 0; list-style: none; display: grid; gap: 0.8rem;">
            <li
                v-for="r in routes"
                :key="r.to"
                style="border: 1px solid var(--border); border-radius: 8px; padding: 0.9rem;"
            >
                <RouterLink :to="r.to">
                    <strong>{{ r.title }}</strong>
                </RouterLink>
                <p style="margin: 0.3rem 0 0; color: var(--muted);">
                    {{ r.summary }}
                </p>
            </li>
        </ul>
    </section>
</template>
