<!--
  Copyright (c) 2026.
  Author Peter Placzek (tada5hi)
  For the full copyright and license information,
  view the LICENSE file that was distributed with this source code.
-->
<script setup lang="ts">
interface IntegrationCard {
    name: string;
    accent: string;
    href: string;
    summary: string;
    bullets: string[];
}

const integrations: IntegrationCard[] = [
    {
        name: '@validup/standard-schema',
        accent: 'var(--vu-color-info-500)',
        href: '/integrations/standard-schema',
        summary: 'Bridge to any Standard Schema library — zod 3.24+, valibot, arktype, effect-schema, …',
        bullets: [
            'Vendor-neutral validator',
            'Path normalization',
            'Issue mapping out of the box',
        ],
    },
    {
        name: '@validup/zod',
        accent: 'var(--vu-color-primary-500)',
        href: '/integrations/zod',
        summary: 'Vendor-specific bridge for zod 3 / 4 — surfaces expected & received fields on each issue.',
        bullets: [
            'safeParseAsync under the hood',
            'expected / received preserved',
            'Reverse helper buildZodIssuesForError',
        ],
    },
    {
        name: '@validup/express-validator',
        accent: 'var(--vu-color-warning-500)',
        href: '/integrations/express-validator',
        summary: 'Drop existing express-validator chains into a Container — no rewrite required.',
        bullets: [
            'Wraps any ContextRunner',
            'Translates ValidationError nodes',
            'Re-export createValidationChain()',
        ],
    },
    {
        name: '@validup/routup',
        accent: '#a855f7',
        href: '/integrations/routup',
        summary: 'Run a Container against a routup HTTP request — body, cookies, params, or query.',
        bullets: [
            'RoutupContainerAdapter',
            'Try locations until one passes',
            'AbortSignal & context propagation',
        ],
    },
    {
        name: '@validup/vue',
        accent: '#10b981',
        href: '/integrations/vue',
        summary: 'Vue 3 composable: vuelidate-shaped reactive form state driven by safeRun().',
        bullets: [
            '$invalid · $dirty · $errors · $model',
            'Debounce & abort on state changes',
            'Nested form scoping',
        ],
    },
];
</script>

<template>
    <section class="vu-integrations">
        <div class="vu-integrations-inner">
            <h2 class="vu-integrations-heading">
                Pick your integration
            </h2>
            <p class="vu-integrations-sub">
                validup keeps a pure-JS core. Drop in a thin adapter to bridge your favorite validator
                or the framework you already ship with.
            </p>

            <div class="vu-integrations-grid">
                <a
                    v-for="t in integrations"
                    :key="t.name"
                    :href="t.href"
                    class="vu-integration-card"
                    :style="{ '--accent': t.accent }"
                >
                    <h3 class="vu-integration-name">{{ t.name }}</h3>
                    <p class="vu-integration-summary">{{ t.summary }}</p>
                    <ul class="vu-integration-list">
                        <li
                            v-for="b in t.bullets"
                            :key="b"
                        >{{ b }}</li>
                    </ul>
                    <span class="vu-integration-cta">Read more →</span>
                </a>
            </div>
        </div>
    </section>
</template>

<style scoped>
.vu-integrations {
    padding: 4rem 1.5rem;
    background: var(--vu-color-bg-muted);
}

.vu-integrations-inner {
    max-width: 1152px;
    margin: 0 auto;
}

.vu-integrations-heading {
    font-size: clamp(1.75rem, 3.5vw, 2.5rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    text-align: center;
    margin: 0 0 0.75rem;
}

.vu-integrations-sub {
    text-align: center;
    max-width: 38rem;
    margin: 0 auto 2.5rem;
    color: var(--vu-color-fg-muted);
    line-height: 1.6;
}

.vu-integrations-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem;
}

@media (min-width: 640px) { .vu-integrations-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 960px) { .vu-integrations-grid { grid-template-columns: repeat(3, 1fr); } }

.vu-integration-card {
    --accent: var(--vu-color-primary-500);
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    border: 1px solid var(--vu-color-border);
    border-top: 3px solid var(--accent);
    border-radius: 0.75rem;
    background: var(--vu-color-bg);
    text-decoration: none !important;
    color: inherit;
    transition: transform 120ms, border-color 120ms;
}
.vu-integration-card:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
}

.vu-integration-name {
    font-size: 1.0625rem;
    font-weight: 700;
    margin: 0 0 0.5rem;
    font-family: ui-monospace, monospace;
}

.vu-integration-summary {
    font-size: 0.9375rem;
    color: var(--vu-color-fg-muted);
    margin: 0 0 1rem;
    line-height: 1.5;
}

.vu-integration-list {
    list-style: none;
    padding: 0;
    margin: 0 0 1.25rem;
    flex: 1;
}
.vu-integration-list li {
    padding: 0.375rem 0;
    font-size: 0.875rem;
    color: var(--vu-color-fg);
    border-bottom: 1px solid var(--vu-color-border-muted);
}
.vu-integration-list li:last-child { border-bottom: none; }
.vu-integration-list li::before {
    content: '✓';
    margin-right: 0.5rem;
    color: var(--accent);
    font-weight: 700;
}

.vu-integration-cta {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--accent);
}
</style>
