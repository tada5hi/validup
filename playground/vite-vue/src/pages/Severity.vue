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

// The container has TWO mounts on `bio` — one optional (will downgrade to
// "warning") and one required (will keep the field at "error"). When you
// type a too-short value into `bio`, both fire; severity stays at "error"
// because the required mount is non-optional.
//
// `phone` only has the optional mount, so a short value renders as a
// warning, not an error.

type Profile = {
    email: string;
    bio: string;
    phone: string;
};

const container = new Container<Profile>();
container.mount('email', createValidator(z.string().email('Must be a valid email')));

container.mount(
    'bio',
    { optional: true },
    createValidator(z.string().min(20, 'A longer bio looks more credible')),
);

const requireBio = ref(false);
container.mount(
    'bio',
    { optional: (value) => !requireBio.value && (typeof value !== 'string' || value.length === 0) },
    createValidator(z.string().min(1, 'Bio is required')),
);

container.mount(
    'phone',
    { optional: true },
    createValidator(z.string().regex(/^\+?[0-9 ()-]{6,}$/, 'Looks like an invalid phone number')),
);

const state = reactive<Profile>({
    email: '', 
    bio: '', 
    phone: '', 
});
const v = useValidup<Profile>(container, state);
</script>

<template>
    <div class="page">
        <section class="panel">
            <h2>Severity</h2>
            <p class="lede">
                <code>getSeverity(field)</code> downgrades errors to
                "warning" when <em>every</em> issue on a field came from an
                optional mount. The <code>Field</code> component reads this
                to pick between red (error) and amber (warning).
            </p>

            <Field
                label="Email"
                :field="v.fields.email"
                type="email"
                autocomplete="email"
            />
            <Field
                label="Bio"
                :field="v.fields.bio"
                :hint="requireBio
                    ? 'Required + ≥20 chars — required mount keeps it red.'
                    : 'Optional; only validated if you type something. Short values render amber.'"
            />
            <Field
                label="Phone"
                :field="v.fields.phone"
                hint="Optional — short / malformed values render amber."
            />

            <div class="field">
                <label>
                    <input
                        v-model="requireBio"
                        type="checkbox"
                        style="width: auto; margin-right: 0.4rem;"
                    >
                    Require bio (toggles a non-optional mount)
                </label>
            </div>
        </section>

        <ResultPanel
            :composable="v"
            :state="state"
        />
    </div>
</template>
