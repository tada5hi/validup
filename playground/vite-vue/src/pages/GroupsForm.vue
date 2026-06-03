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

type User = {
    name: string;
    email: string;
    password: string;
};

// `password` only participates when group === 'create' — the same container
// covers the "edit profile" flow without forcing a password re-entry.
const container = new Container<User>();
container.mount('name', createValidator(z.string().min(2, 'Must be at least 2 characters')));
container.mount('email', createValidator(z.string().email('Must be a valid email')));
container.mount(
    'password',
    { group: ['create'] },
    createValidator(z.string().min(8, 'Must be at least 8 characters')),
);

const state = reactive<User>({
    name: '', 
    email: '', 
    password: '', 
});
const group = ref<string | undefined>('create');

const v = useValidup<User>(container, state, { group });

const lastResult = ref<string | undefined>();

async function submit() {
    const result = await v.$validate();
    lastResult.value = result.success ?
        `Submitted (group=${group.value}): ${JSON.stringify(result.data)}` :
        `Failed (group=${group.value})`;
}
</script>

<template>
    <div class="page">
        <section class="panel">
            <h2>Groups</h2>
            <p class="lede">
                Switch between <code>create</code> and <code>update</code>.
                Notice <code>password</code> stops being validated when the
                group changes — the watch on <code>groupRef</code> re-runs
                the container against the active group.
            </p>

            <div class="field">
                <label>Active group</label>
                <select v-model="group">
                    <option value="create">
                        create
                    </option>
                    <option value="update">
                        update
                    </option>
                </select>
            </div>

            <Field
                label="Name"
                :field="v.fields.name"
                autocomplete="name"
            />
            <Field
                label="Email"
                :field="v.fields.email"
                type="email"
                autocomplete="email"
            />
            <Field
                label="Password"
                :field="v.fields.password"
                type="password"
                :hint="group === 'create' ? 'Required on create.' : 'Not validated in update mode.'"
            />

            <div class="actions">
                <button @click="submit">
                    Submit
                </button>
                <button
                    class="secondary"
                    @click="v.$reset()"
                >
                    Reset
                </button>
            </div>

            <p
                v-if="lastResult"
                class="status"
            >
                {{ lastResult }}
            </p>
        </section>

        <ResultPanel
            :composable="v"
            :state="state"
        />
    </div>
</template>
