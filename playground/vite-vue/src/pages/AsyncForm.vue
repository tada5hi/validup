<!--
  Copyright (c) 2026.
  Author Peter Placzek (tada5hi)
  For the full copyright and license information,
  view the LICENSE file that was distributed with this source code.
-->
<script setup lang="ts">
import { reactive, ref } from 'vue';
import { z } from 'zod';
import { Container } from 'validup';
import { createValidator } from '@validup/zod';
import { useValidup } from '@validup/vue';
import Field from '../components/Field.vue';
import ResultPanel from '../components/ResultPanel.vue';

type Signup = {
    username: string;
    email: string;
};

const TAKEN = new Set(['admin', 'root', 'peter', 'tada5hi']);

// Fake server check. 350 ms latency, no jitter — enough to make the
// debounce + AbortSignal interplay observable.
async function isUsernameAvailable(name: string, signal?: AbortSignal): Promise<boolean> {
    await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 350);
        signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(signal.reason ?? new DOMException('aborted', 'AbortError'));
        });
    });
    return !TAKEN.has(name.toLowerCase());
}

const container = new Container<Signup>();
container.mount('email', createValidator(z.string().email('Must be a valid email')));
container.mount(
    'username',
    // `sideEffect: true` opts this validator out of the result cache — every
    // run re-hits `isUsernameAvailable` even if the value didn't change.
    createValidator(
        (ctx) => z.string()
            .min(3, 'Must be at least 3 characters')
            .refine(
                async (val: string) => isUsernameAvailable(val, ctx.signal),
                { message: 'Username is already taken' },
            ),
        { sideEffect: true },
    ),
);

const state = reactive<Signup>({ username: '', email: '' });

const v = useValidup<Signup>(container, state, { debounce: 250 });
const taken = ref([...TAKEN].sort());
</script>

<template>
    <div class="page">
        <section class="panel">
            <h2>Async validation</h2>
            <p class="lede">
                The <code>username</code> mount runs an async zod refine
                that pings a fake server. <code>debounce: 250</code> on
                the composable coalesces keystrokes; intermediate runs are
                aborted via <code>ctx.signal</code> the moment the next
                schedule wins.
            </p>
            <p class="status">
                Taken usernames: <strong>{{ taken.join(', ') }}</strong>
            </p>

            <Field
                label="Username"
                :field="v.fields.username"
                hint="Try `peter` to see the server-busy/taken flow."
                autocomplete="username"
            />
            <Field
                label="Email"
                :field="v.fields.email"
                type="email"
                autocomplete="email"
            />

            <p class="status">
                <span v-if="v.$pending.value">Validating…</span>
                <span v-else>Idle.</span>
            </p>
        </section>

        <ResultPanel
            :composable="v"
            :state="state"
        />
    </div>
</template>
