<!--
  Copyright (c) 2026.
  Author Peter Placzek (tada5hi)
  For the full copyright and license information,
  view the LICENSE file that was distributed with this source code.
-->
<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { z } from 'zod';
import { Container } from 'validup';
import { createValidator } from '@validup/zod';
import { useValidup } from '@validup/vue';
import Field from '../components/Field.vue';
import ResultPanel from '../components/ResultPanel.vue';

// Parent owns the high-level form state but defers per-section validation
// to two children. Each child registers itself via `options.name`; the parent
// aggregates them through inject/provide automatically (see helpers/collector
// in @validup/vue) and exposes them via `$getResultsForChild`.

type Profile = { firstName: string; lastName: string };
type Address = { street: string; city: string };

const profileContainer = new Container<Profile>();
profileContainer.mount('firstName', createValidator(z.string().min(1, 'Required')));
profileContainer.mount('lastName', createValidator(z.string().min(1, 'Required')));

const addressContainer = new Container<Address>();
addressContainer.mount('street', createValidator(z.string().min(1, 'Required')));
addressContainer.mount('city', createValidator(z.string().min(1, 'Required')));

const profile = reactive<Profile>({ firstName: '', lastName: '' });
const address = reactive<Address>({ street: '', city: '' });

// Parent composable has no fields of its own — it's purely an aggregator.
// Using a tiny stub container keeps the parent's run cycle a no-op while
// still wiring it into the provide/inject tree so children can attach.
type ParentState = Record<string, never>;
const parentContainer = new Container<ParentState>();
const parentState = reactive<ParentState>({});
const parent = useValidup<ParentState>(parentContainer, parentState, { name: 'root' });

const profileForm = useValidup<Profile>(profileContainer, profile, { name: 'profile' });
const addressForm = useValidup<Address>(addressContainer, address, { name: 'address' });

const profileFromParent = computed(() => parent.$getResultsForChild<Profile>('profile'));
const addressFromParent = computed(() => parent.$getResultsForChild<Address>('address'));

const submitMessage = ref<string | undefined>();

async function submit() {
    const [p, a] = await Promise.all([profileForm.$validate(), addressForm.$validate()]);
    submitMessage.value = p.success && a.success ?
        'Both sections valid — would submit now.' :
        'One or more sections invalid — fix and try again.';
}
</script>

<template>
    <div class="page">
        <section class="panel">
            <h2>Profile <span class="tag">child "profile"</span></h2>
            <p class="lede">
                A leaf composable. Registers itself with the nearest parent
                <code>useValidup()</code> via inject/provide.
            </p>
            <Field
                label="First name"
                :field="profileForm.fields.firstName"
            />
            <Field
                label="Last name"
                :field="profileForm.fields.lastName"
            />
        </section>

        <section class="panel">
            <h2>Address <span class="tag">child "address"</span></h2>
            <p class="lede">
                A sibling leaf composable. Both children expose themselves under
                their <code>options.name</code>.
            </p>
            <Field
                label="Street"
                :field="addressForm.fields.street"
            />
            <Field
                label="City"
                :field="addressForm.fields.city"
            />
        </section>

        <section
            class="panel"
            style="grid-column: 1 / -1;"
        >
            <h2>Parent aggregator <span class="tag">root</span></h2>
            <p class="lede">
                The parent reaches each child by name. This lets a wizard /
                page-level submit walk every section without leaking each
                section's container into the parent.
            </p>
            <div class="actions">
                <button @click="submit">
                    Submit (validates both)
                </button>
                <button
                    class="secondary"
                    @click="() => { profileForm.$reset(); addressForm.$reset(); }"
                >
                    Reset all
                </button>
            </div>
            <p
                v-if="submitMessage"
                class="status"
            >
                {{ submitMessage }}
            </p>
            <pre style="margin-top: 1rem;">{{ JSON.stringify({
                profile: {
                    invalid: profileFromParent?.$invalid.value,
                    dirty: profileFromParent?.$dirty.value,
                },
                address: {
                    invalid: addressFromParent?.$invalid.value,
                    dirty: addressFromParent?.$dirty.value,
                },
            }, null, 2) }}</pre>
        </section>

        <ResultPanel
            style="grid-column: 1 / -1;"
            :composable="parent"
            :state="{ profile, address }"
        />
    </div>
</template>
