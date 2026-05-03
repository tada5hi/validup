<!--
  Copyright (c) 2026.
  Author Peter Placzek (tada5hi)
  For the full copyright and license information,
  view the LICENSE file that was distributed with this source code.
-->
<script setup lang="ts">
import { computed, reactive } from 'vue';
import { useData } from 'vitepress';
import {
    Container,
    type Issue,
    type IssueItem,
    type Validator,
    flattenIssueItems,
    isIssueItem,
} from 'validup';

const { isDark } = useData();

const isString: Validator = ({ value }) => {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error('Must be a non-empty string');
    }
    return value;
};

const isEmail: Validator = ({ value }) => {
    if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new Error('Must look like an email address');
    }
    return value;
};

const isStrongPassword: Validator = ({ value }) => {
    if (typeof value !== 'string' || value.length < 8) {
        throw new Error('Must be at least 8 characters');
    }
    if (!/[A-Z]/.test(value) || !/\d/.test(value)) {
        throw new Error('Needs an uppercase letter and a digit');
    }
    return value;
};

const signup = new Container<{
    name: string; 
    email: string; 
    password: string 
}>();
signup.mount('name', isString);
signup.mount('email', isEmail);
signup.mount('password', isStrongPassword);

const form = reactive({
    name: 'Pe',
    email: 'peter@invalid',
    password: 'short',
});

type RunState = { ok: true; data: unknown } | { ok: false; issues: Issue[] };

const result = computed<RunState>(() => {
    const outcome = signup.safeRunSync({ ...form });
    return outcome.success ?
        { ok: true, data: outcome.data } :
        { ok: false, issues: outcome.error.issues };
});

const issues = computed(() => (result.value.ok ? [] : result.value.issues));
const valid = computed(() => result.value.ok);

const items = computed<IssueItem[]>(() => flattenIssueItems(issues.value));

const errorFor = (key: string): string | undefined => items.value
    .find((i) => isIssueItem(i) && i.path?.[0] === key)
    ?.message;

const summary = computed(() => (valid.value ?
    JSON.stringify({ success: true, data: result.value.ok ? result.value.data : null }, null, 2) :
    JSON.stringify({ success: false, issues: issues.value }, null, 2)));

const toggleDark = () => {
    isDark.value = !isDark.value;
};
</script>

<template>
    <section class="vu-hero">
        <div class="vu-hero-inner">
            <div class="vu-hero-text">
                <h1 class="vu-hero-title">
                    <span class="vu-hero-title-grad">validup</span>
                </h1>
                <p class="vu-hero-tagline">
                    Composable, path-based validation for TypeScript. Mount validators on any path,
                    run them in groups, and collect structured issues — without decorators or schema DSLs.
                </p>
                <div class="vu-hero-actions">
                    <a
                        class="vu-btn vu-btn-primary"
                        href="/getting-started/"
                    >Get Started</a>
                    <a
                        class="vu-btn vu-btn-ghost"
                        href="https://github.com/tada5hi/validup"
                        target="_blank"
                        rel="noopener"
                    >View on GitHub</a>
                </div>
                <p class="vu-hero-meta">
                    Apache 2.0 licensed · Node 22+ · ESM-only · TypeScript-first
                </p>
            </div>

            <div class="vu-hero-card">
                <div class="vu-hero-card-toolbar">
                    <span
                        class="vu-hero-card-dot"
                        style="background: var(--vu-color-error-500)"
                    />
                    <span
                        class="vu-hero-card-dot"
                        style="background: var(--vu-color-warning-500)"
                    />
                    <span
                        class="vu-hero-card-dot"
                        style="background: var(--vu-color-success-500)"
                    />
                    <span class="vu-hero-card-title">signup.safeRunSync(state)</span>
                    <button
                        class="vu-hero-card-toggle"
                        type="button"
                        @click="toggleDark"
                    >
                        {{ isDark ? 'Dark' : 'Light' }}
                    </button>
                </div>

                <div class="vu-hero-card-body">
                    <div class="vu-hero-form">
                        <label class="vu-hero-field">
                            <span class="vu-hero-field-label">name</span>
                            <input
                                v-model="form.name"
                                class="vu-hero-input"
                                :class="{ 'vu-hero-input-error': errorFor('name') }"
                                placeholder="Peter"
                            >
                            <span
                                v-if="errorFor('name')"
                                class="vu-hero-field-error"
                            >{{ errorFor('name') }}</span>
                        </label>
                        <label class="vu-hero-field">
                            <span class="vu-hero-field-label">email</span>
                            <input
                                v-model="form.email"
                                class="vu-hero-input"
                                :class="{ 'vu-hero-input-error': errorFor('email') }"
                                placeholder="peter@example.com"
                            >
                            <span
                                v-if="errorFor('email')"
                                class="vu-hero-field-error"
                            >{{ errorFor('email') }}</span>
                        </label>
                        <label class="vu-hero-field">
                            <span class="vu-hero-field-label">password</span>
                            <input
                                v-model="form.password"
                                type="password"
                                class="vu-hero-input"
                                :class="{ 'vu-hero-input-error': errorFor('password') }"
                                placeholder="At least 8 chars"
                            >
                            <span
                                v-if="errorFor('password')"
                                class="vu-hero-field-error"
                            >{{ errorFor('password') }}</span>
                        </label>
                    </div>

                    <div
                        class="vu-hero-output"
                        :class="{ 'vu-hero-output-ok': valid }"
                    >
                        <div class="vu-hero-output-head">
                            <span
                                class="vu-hero-status"
                                :class="valid ? 'vu-hero-status-ok' : 'vu-hero-status-err'"
                            >{{ valid ? '✓ valid' : `✗ ${issues.length} issue${issues.length === 1 ? '' : 's'}` }}</span>
                            <span class="vu-hero-output-hint">live</span>
                        </div>
                        <pre class="vu-hero-output-pre"><code>{{ summary }}</code></pre>
                    </div>

                    <p class="vu-hero-card-hint">
                        Each keystroke re-runs the <code>Container</code> and re-renders the structured
                        <code>Issue[]</code> — same model that powers integrations with zod, express-validator,
                        Routup, and Vue.
                    </p>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.vu-hero {
    padding: 4rem 1.5rem 3rem;
    background:
        radial-gradient(1200px 600px at 100% 0%, color-mix(in oklab, var(--vu-color-primary-500) 12%, transparent), transparent),
        radial-gradient(800px 400px at 0% 100%, color-mix(in oklab, var(--vu-color-info-500) 10%, transparent), transparent);
}

.vu-hero-inner {
    max-width: 1152px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr;
    gap: 3rem;
    align-items: center;
}

@media (min-width: 960px) {
    .vu-hero-inner { grid-template-columns: 1fr 1fr; gap: 4rem; }
}

.vu-hero-title {
    font-size: clamp(2.75rem, 6vw, 4.5rem);
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -0.02em;
    margin: 0 0 1.25rem;
}
.vu-hero-title-grad {
    background: linear-gradient(120deg, var(--vu-color-primary-500), var(--vu-color-info-500));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
}

.vu-hero-tagline {
    font-size: 1.125rem;
    line-height: 1.6;
    color: var(--vu-color-fg-muted);
    max-width: 36rem;
    margin: 0 0 2rem;
}

.vu-hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
}

.vu-hero-meta {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--vu-color-fg-muted);
}

.vu-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.95rem;
    border: 1px solid transparent;
    transition: background-color 120ms, color 120ms, border-color 120ms;
    cursor: pointer;
    text-decoration: none !important;
}

.vu-btn-primary {
    background: var(--vu-color-primary-600);
    color: var(--vu-color-on-primary);
}
.vu-btn-primary:hover { background: var(--vu-color-primary-500); }

.vu-btn-ghost {
    background: transparent;
    color: var(--vu-color-fg);
    border-color: var(--vu-color-border);
}
.vu-btn-ghost:hover {
    background: var(--vu-color-bg-elevated);
    border-color: var(--vu-color-fg-muted);
}

.vu-hero-card {
    border: 1px solid var(--vu-color-border);
    border-radius: 1rem;
    background: var(--vu-color-bg);
    box-shadow: 0 25px 50px -12px color-mix(in oklab, var(--vu-color-primary-500) 8%, rgba(0,0,0,0.25));
    overflow: hidden;
}

.vu-hero-card-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--vu-color-border);
    background: var(--vu-color-bg-elevated);
}
.vu-hero-card-dot {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 999px;
    display: inline-block;
}
.vu-hero-card-title {
    font-size: 0.75rem;
    color: var(--vu-color-fg-muted);
    font-family: ui-monospace, monospace;
    margin-left: 0.5rem;
}
.vu-hero-card-toggle {
    margin-left: auto;
    font-size: 0.75rem;
    padding: 0.25rem 0.625rem;
    border: 1px solid var(--vu-color-border);
    border-radius: 999px;
    background: transparent;
    color: var(--vu-color-fg-muted);
    cursor: pointer;
}
.vu-hero-card-toggle:hover { color: var(--vu-color-fg); }

.vu-hero-card-body { padding: 1.25rem; }

.vu-hero-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
}

.vu-hero-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.vu-hero-field-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    color: var(--vu-color-fg-muted);
}

.vu-hero-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--vu-color-border);
    background: var(--vu-color-bg);
    color: var(--vu-color-fg);
    font-size: 0.875rem;
    font-family: ui-monospace, monospace;
    transition: border-color 120ms;
}
.vu-hero-input:focus {
    outline: none;
    border-color: var(--vu-color-primary-500);
}
.vu-hero-input-error,
.vu-hero-input-error:focus {
    border-color: var(--vu-color-error-500);
}

.vu-hero-field-error {
    font-size: 0.75rem;
    color: var(--vu-color-error-500);
    margin-top: 0.25rem;
    line-height: 1.4;
}

.vu-hero-output {
    border: 1px solid var(--vu-color-border);
    border-radius: 0.5rem;
    background: var(--vu-color-bg-muted);
    overflow: hidden;
    margin-bottom: 1rem;
}
.vu-hero-output-ok { border-color: color-mix(in oklab, var(--vu-color-primary-500) 50%, var(--vu-color-border)); }

.vu-hero-output-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--vu-color-border);
    background: var(--vu-color-bg-elevated);
    font-size: 0.75rem;
}
.vu-hero-status {
    font-weight: 600;
    font-family: ui-monospace, monospace;
}
.vu-hero-status-ok { color: var(--vu-color-primary-600); }
.vu-hero-status-err { color: var(--vu-color-error-500); }

.vu-hero-output-hint {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--vu-color-fg-muted);
    font-size: 0.65rem;
}

.vu-hero-output-pre {
    margin: 0;
    padding: 0.75rem;
    font-size: 0.75rem;
    line-height: 1.5;
    color: var(--vu-color-fg);
    font-family: ui-monospace, monospace;
    max-height: 14rem;
    overflow: auto;
    background: transparent;
}

.vu-hero-card-hint {
    font-size: 0.8125rem;
    color: var(--vu-color-fg-muted);
    margin: 0;
    line-height: 1.5;
}
.vu-hero-card-hint code {
    background: var(--vu-color-bg-elevated);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.85em;
    font-family: ui-monospace, monospace;
}
</style>
