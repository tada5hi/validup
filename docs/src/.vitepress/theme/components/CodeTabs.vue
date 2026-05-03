<!--
  Copyright (c) 2026.
  Author Peter Placzek (tada5hi)
  For the full copyright and license information,
  view the LICENSE file that was distributed with this source code.
-->
<script setup lang="ts">
import { ref } from 'vue';

interface Tab {
    label: string;
    code: string;
}

const tabs: Tab[] = [
    {
        label: 'Install',
        code: 'npm install validup',
    },
    {
        label: 'Compose',
        code: `// signup.ts
import { Container, type Validator } from 'validup';

const isString: Validator = ({ value, key }) => {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(\`\${key} must be a non-empty string.\`);
    }
    return value;
};

export const signup = new Container<{ name: string; email: string }>();
signup.mount('name', isString);
signup.mount('email', isString);`,
    },
    {
        label: 'Run',
        code: `import { isValidupError } from 'validup';
import { signup } from './signup';

try {
    const data = await signup.run({ name: 'Peter', email: 'peter@example.com' });
    // data is typed { name: string; email: string }
} catch (error) {
    if (isValidupError(error)) {
        console.error(error.issues);
    }
}`,
    },
];

const active = ref(0);
const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

const copy = async (code: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
        await navigator.clipboard.writeText(code);
    } catch {
        return;
    }
    copied.value = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { copied.value = false; }, 1500);
};
</script>

<template>
    <section class="vu-codetabs">
        <div class="vu-codetabs-inner">
            <h2 class="vu-codetabs-heading">
                From zero to first validation
            </h2>
            <p class="vu-codetabs-sub">
                Three steps. No decorators, no schema DSL, no build-time codegen.
            </p>

            <div class="vu-codetabs-card">
                <div
                    class="vu-codetabs-tabs"
                    role="tablist"
                >
                    <button
                        v-for="(tab, i) in tabs"
                        :key="tab.label"
                        type="button"
                        class="vu-codetabs-tab"
                        :class="{ 'vu-codetabs-tab-active': active === i }"
                        :aria-selected="active === i"
                        role="tab"
                        @click="active = i"
                    >
                        {{ tab.label }}
                    </button>
                    <button
                        type="button"
                        class="vu-codetabs-copy"
                        @click="copy(tabs[active].code)"
                    >
                        {{ copied ? 'Copied' : 'Copy' }}
                    </button>
                </div>
                <pre class="vu-codetabs-pre"><code>{{ tabs[active].code }}</code></pre>
            </div>
        </div>
    </section>
</template>

<style scoped>
.vu-codetabs {
    padding: 4rem 1.5rem;
    background: var(--vu-color-bg);
}

.vu-codetabs-inner {
    max-width: 960px;
    margin: 0 auto;
}

.vu-codetabs-heading {
    font-size: clamp(1.75rem, 3.5vw, 2.5rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    text-align: center;
    margin: 0 0 0.5rem;
}

.vu-codetabs-sub {
    text-align: center;
    color: var(--vu-color-fg-muted);
    margin: 0 0 2rem;
}

.vu-codetabs-card {
    border: 1px solid var(--vu-color-border);
    border-radius: 0.75rem;
    overflow: hidden;
    background: var(--vu-color-bg);
}

.vu-codetabs-tabs {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.5rem 0;
    border-bottom: 1px solid var(--vu-color-border);
    background: var(--vu-color-bg-elevated);
}

.vu-codetabs-tab {
    padding: 0.5rem 0.875rem;
    border: none;
    background: transparent;
    color: var(--vu-color-fg-muted);
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 0.375rem 0.375rem 0 0;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
}
.vu-codetabs-tab:hover { color: var(--vu-color-fg); }
.vu-codetabs-tab-active {
    color: var(--vu-color-fg);
    border-bottom-color: var(--vu-color-primary-500);
    background: var(--vu-color-bg);
}

.vu-codetabs-copy {
    margin-left: auto;
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--vu-color-border);
    border-radius: 0.375rem;
    background: transparent;
    font-size: 0.75rem;
    color: var(--vu-color-fg-muted);
    cursor: pointer;
    margin-bottom: 0.5rem;
    margin-right: 0.5rem;
}
.vu-codetabs-copy:hover { color: var(--vu-color-fg); }

.vu-codetabs-pre {
    padding: 1.25rem;
    margin: 0;
    overflow-x: auto;
    font-size: 0.8125rem;
    line-height: 1.6;
    background: var(--vu-color-bg);
    color: var(--vu-color-fg);
}
.vu-codetabs-pre code { font-family: ui-monospace, monospace; }
</style>
