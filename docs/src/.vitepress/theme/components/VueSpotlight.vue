<!--
  Copyright (c) 2026.
  Author Peter Placzek (tada5hi)
  For the full copyright and license information,
  view the LICENSE file that was distributed with this source code.
-->
<script setup lang="ts">
const code = `// SignupForm.vue
import { Container } from 'validup';
import { useValidup } from '@validup/vue';
import { reactive } from 'vue';

const signup = new Container<{ email: string; password: string }>();
signup.mount('email', isEmail);
signup.mount('password', isStrongPassword);

const state = reactive({ email: '', password: '' });
const v = useValidup(signup, state, { debounce: 200 });

async function submit() {
    const result = await v.$validate();
    if (result.success) save(result.data);
}`;
</script>

<template>
    <section class="vu-spot">
        <div class="vu-spot-inner">
            <div class="vu-spot-text">
                <p class="vu-spot-eyebrow">
                    @validup/vue
                </p>
                <h2 class="vu-spot-heading">
                    Reactive forms, vuelidate-shaped
                </h2>
                <p class="vu-spot-tagline">
                    A single composable turns any <code>Container</code> into reactive form state.
                    Errors gate on dirty paths, debounce on keystrokes, and abort cleanly when the
                    user keeps typing.
                </p>
                <ul class="vu-spot-list">
                    <li><strong>$invalid · $dirty · $errors</strong> — vuelidate-style API, no schema lock-in</li>
                    <li><strong>$model</strong> — two-way bound, dirty-tracked, deep-path safe</li>
                    <li><strong>Debounce + abort</strong> — stale runs cancel automatically on new input</li>
                    <li><strong>Nested forms</strong> — scope composables, aggregate child results from a parent</li>
                </ul>
                <a
                    class="vu-btn vu-btn-primary"
                    href="/integrations/vue"
                >Read the Vue guide →</a>
            </div>

            <div class="vu-spot-code">
                <div class="vu-spot-code-toolbar">
                    <span>SignupForm.vue</span>
                </div>
                <pre><code>{{ code }}</code></pre>
            </div>
        </div>
    </section>
</template>

<style scoped>
.vu-spot {
    padding: 4rem 1.5rem;
    background: var(--vu-color-bg-muted);
}
.vu-spot-inner {
    max-width: 1152px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr;
    gap: 3rem;
    align-items: center;
}
@media (min-width: 960px) {
    .vu-spot-inner { grid-template-columns: 1fr 1fr; gap: 4rem; }
}

.vu-spot-eyebrow {
    text-transform: uppercase;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: var(--vu-color-primary-500);
    margin: 0 0 0.75rem;
    font-family: ui-monospace, monospace;
}

.vu-spot-heading {
    font-size: clamp(1.75rem, 3.5vw, 2.5rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 1rem;
}

.vu-spot-tagline {
    font-size: 1.0625rem;
    line-height: 1.6;
    color: var(--vu-color-fg-muted);
    margin: 0 0 1.25rem;
}
.vu-spot-tagline code {
    background: var(--vu-color-bg-elevated);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.85em;
    font-family: ui-monospace, monospace;
}

.vu-spot-list {
    list-style: none;
    padding: 0;
    margin: 0 0 2rem;
}
.vu-spot-list li {
    padding: 0.5rem 0;
    color: var(--vu-color-fg);
    font-size: 0.9375rem;
    border-bottom: 1px solid var(--vu-color-border-muted);
}
.vu-spot-list li:last-child { border-bottom: none; }
.vu-spot-list strong { color: var(--vu-color-primary-500); font-weight: 600; }

.vu-btn {
    display: inline-flex;
    align-items: center;
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.95rem;
    text-decoration: none !important;
    transition: background-color 120ms;
}
.vu-btn-primary {
    background: var(--vu-color-primary-600);
    color: var(--vu-color-on-primary);
}
.vu-btn-primary:hover { background: var(--vu-color-primary-500); }

.vu-spot-code {
    border: 1px solid var(--vu-color-border);
    border-radius: 0.75rem;
    overflow: hidden;
    background: var(--vu-color-bg);
}
.vu-spot-code-toolbar {
    padding: 0.625rem 1rem;
    border-bottom: 1px solid var(--vu-color-border);
    font-size: 0.75rem;
    color: var(--vu-color-fg-muted);
    font-family: ui-monospace, monospace;
    background: var(--vu-color-bg-elevated);
}
.vu-spot-code pre {
    margin: 0;
    padding: 1.25rem;
    overflow-x: auto;
    font-size: 0.8125rem;
    line-height: 1.65;
    color: var(--vu-color-fg);
}
.vu-spot-code code { font-family: ui-monospace, monospace; }
</style>
