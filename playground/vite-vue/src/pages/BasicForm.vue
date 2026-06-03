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
import CrossCuttingErrors from '../components/CrossCuttingErrors.vue';

type Register = {
    name: string;
    email: string;
    password: string;
};

const container = new Container<Register>();
container.mount('name', createValidator(z.string().min(2, 'Must be at least 2 characters')));
container.mount('email', createValidator(z.string().email('Must be a valid email')));
container.mount(
    'password',
    createValidator(
        z.string()
            .min(8, 'Must be at least 8 characters')
            .regex(/[A-Z]/, 'Needs an uppercase letter')
            .regex(/\d/, 'Needs a digit'),
    ),
);

const state = reactive<Register>({
    name: '', 
    email: '', 
    password: '', 
});

const v = useValidup<Register>(container, state, { lazy: true });

const lastResult = ref<string | undefined>();

async function submit() {
    const result = await v.$validate();
    if (result.success) {
        lastResult.value = `Submitted: ${JSON.stringify(result.data)}`;
    } else {
        lastResult.value = undefined;
    }
}
</script>

<template>
    <div class="page">
        <section class="panel">
            <h2>Register</h2>
            <p class="lede">
                Lazy: validation only runs after the first $model write,
                $touch(), or $validate(). Each field surfaces its own
                $errors gated on $dirty.
            </p>

            <CrossCuttingErrors :issues="v.$crossCuttingErrors.value" />

            <Field
                label="Name"
                :field="v.fields.name"
                hint="At least 2 characters."
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
                autocomplete="new-password"
                hint="≥ 8 chars, an uppercase letter, and a digit."
            />

            <div class="actions">
                <button
                    :disabled="v.$pending.value"
                    @click="submit"
                >
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
