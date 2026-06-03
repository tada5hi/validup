<!--
  Copyright (c) 2026.
  Author Peter Placzek (tada5hi)
  For the full copyright and license information,
  view the LICENSE file that was distributed with this source code.
-->
<script setup lang="ts">
import { reactive, ref } from 'vue';
import { z } from 'zod';
import { Container, IssueCode, defineIssueItem } from 'validup';
import { createValidator } from '@validup/zod';
import { useValidup } from '@validup/vue';
import Field from '../components/Field.vue';
import ResultPanel from '../components/ResultPanel.vue';
import CrossCuttingErrors from '../components/CrossCuttingErrors.vue';

type Form = { email: string; coupon: string };

const container = new Container<Form>();
container.mount('email', createValidator(z.string().email('Must be a valid email')));
container.mount('coupon', createValidator(z.string().min(3, 'Coupon must be at least 3 characters')));

const state = reactive<Form>({ email: '', coupon: '' });

const v = useValidup<Form>(container, state);

// Simulated server. Triggers different responses depending on the email,
// to demo the three flavours of external issues: per-field, group-level, and
// path-less cross-cutting.
async function fakeSubmit(form: Form): Promise<{ ok: true } | { ok: false; reason: 'taken' | 'rate-limit' | 'invalid-coupon' }> {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 250);
    });
    if (form.email === 'taken@example.com') {
        return { ok: false, reason: 'taken' };
    }
    if (form.email === 'rl@example.com') {
        return { ok: false, reason: 'rate-limit' };
    }
    if (form.coupon === 'BAD') {
        return { ok: false, reason: 'invalid-coupon' };
    }
    return { ok: true };
}

const lastResult = ref<string | undefined>();

async function submit() {
    const result = await v.$validate();
    if (!result.success) {
        lastResult.value = 'Client-side validation failed.';
        return;
    }
    const response = await fakeSubmit(state);
    if (response.ok) {
        lastResult.value = 'Submitted successfully.';
        return;
    }
    if (response.reason === 'taken') {
        v.setExternalIssues([
            defineIssueItem({
                code: 'email_taken',
                path: ['email'],
                message: 'This email is already registered',
            }),
        ]);
    } else if (response.reason === 'invalid-coupon') {
        v.setExternalIssues([
            defineIssueItem({
                code: 'coupon_invalid',
                path: ['coupon'],
                message: 'This coupon code is not recognised',
            }),
        ]);
    } else {
        v.setExternalIssues([
            defineIssueItem({
                code: IssueCode.VALUE_INVALID,
                path: [],
                message: 'Rate limit reached — please retry in a few minutes',
            }),
        ]);
    }
    lastResult.value = `Server rejected: ${response.reason}`;
}
</script>

<template>
    <div class="page">
        <section class="panel">
            <h2>Server-side issues</h2>
            <p class="lede">
                On submit failure, the server response is folded back into
                the composable via <code>setExternalIssues</code>. External
                entries surface alongside validator-produced issues but carry
                <code>meta.external = true</code>; per-field entries auto-clear
                when their <code>$model</code> is written.
            </p>

            <CrossCuttingErrors :issues="v.$crossCuttingErrors.value" />

            <Field
                label="Email"
                :field="v.fields.email"
                hint="Try `taken@example.com` or `rl@example.com`."
                type="email"
                autocomplete="email"
            />
            <Field
                label="Coupon"
                :field="v.fields.coupon"
                hint="Try `BAD` to trigger a coupon-level server error."
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
