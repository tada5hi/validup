<!--
  Copyright (c) 2026.
  Author Peter Placzek (tada5hi)
  For the full copyright and license information,
  view the LICENSE file that was distributed with this source code.
-->
<script setup lang="ts">
interface Feature {
    icon: string;
    title: string;
    detail: string;
}

const features: Feature[] = [
    {
        icon: '🧩',
        title: 'Composable',
        detail: 'Mount validators and nested Containers on any path. Stay flat or nest as deep as the input demands.',
    },
    {
        icon: '🛤️',
        title: 'Path-based',
        detail: 'Mount via dotted paths (a.b.c), brackets (foo[0]), or globs (**.foo) — expansion is handled by pathtrace.',
    },
    {
        icon: '🚦',
        title: 'Group-aware',
        detail: 'Run different validations for create / update / custom groups from the same container — no schema duplication.',
    },
    {
        icon: '📋',
        title: 'Structured issues',
        detail: 'Discriminated Issue items and groups with code, path, message, expected, received — ready for any UI.',
    },
    {
        icon: '🌐',
        title: 'Universal',
        detail: 'Pure JS, ESM-only. Runs in Node, browsers, Deno, Bun, and edge runtimes — no Node-specific deps.',
    },
    {
        icon: '🛡️',
        title: 'Type-safe',
        detail: 'Container<T, C> propagates output shape and a typed user context all the way through nested mounts.',
    },
];
</script>

<template>
    <section class="vu-features">
        <div class="vu-features-inner">
            <h2 class="vu-features-heading">
                One model. Six superpowers.
            </h2>
            <p class="vu-features-sub">
                A small core (Container · Validator · Issue) — and everything else falls out from how you compose it.
            </p>
            <div class="vu-features-grid">
                <article
                    v-for="f in features"
                    :key="f.title"
                    class="vu-feature"
                >
                    <div class="vu-feature-icon">
                        {{ f.icon }}
                    </div>
                    <h3 class="vu-feature-title">
                        {{ f.title }}
                    </h3>
                    <p class="vu-feature-detail">
                        {{ f.detail }}
                    </p>
                </article>
            </div>
        </div>
    </section>
</template>

<style scoped>
.vu-features {
    padding: 4rem 1.5rem;
    background: var(--vu-color-bg);
}

.vu-features-inner {
    max-width: 1152px;
    margin: 0 auto;
}

.vu-features-heading {
    font-size: clamp(1.75rem, 3.5vw, 2.5rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 0.75rem;
    text-align: center;
}

.vu-features-sub {
    text-align: center;
    color: var(--vu-color-fg-muted);
    max-width: 38rem;
    margin: 0 auto 2.5rem;
}

.vu-features-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem;
}

@media (min-width: 640px) { .vu-features-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 960px) { .vu-features-grid { grid-template-columns: repeat(3, 1fr); } }

.vu-feature {
    padding: 1.5rem;
    border: 1px solid var(--vu-color-border);
    border-radius: 0.75rem;
    background: var(--vu-color-bg);
    transition: border-color 120ms, transform 120ms;
}
.vu-feature:hover {
    border-color: var(--vu-color-primary-500);
    transform: translateY(-2px);
}

.vu-feature-icon {
    font-size: 1.75rem;
    margin-bottom: 0.75rem;
    line-height: 1;
}

.vu-feature-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
}

.vu-feature-detail {
    font-size: 0.9375rem;
    line-height: 1.55;
    color: var(--vu-color-fg-muted);
    margin: 0;
}
</style>
