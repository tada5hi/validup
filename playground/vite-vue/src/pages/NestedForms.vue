<!--
  Copyright (c) 2026.
  Author Peter Placzek (tada5hi)
  For the full copyright and license information,
  view the LICENSE file that was distributed with this source code.
-->
<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Container } from 'validup';
import { useValidup } from '@validup/vue';
import ProfileSection from '../components/ProfileSection.vue';
import AddressSection from '../components/AddressSection.vue';
import ResultPanel from '../components/ResultPanel.vue';
import type { Address, Profile } from '../components/section-types';

// The parent owns the page-level state but defers per-section validation to
// two child components. Each section creates its own useValidup() with an
// `options.name` and registers with this composable via inject/provide
// (see helpers/collector in @validup/vue) — inject() only resolves provides
// from ANCESTOR components, so the sections must be real children, not
// composables created in this same <script setup>.
//
// The child registry is shallowReactive, so the $getResultsForChild lookups
// below re-evaluate when a section registers/unregisters AND track the
// section's own reactive flags ($invalid / $dirty) — the aggregator preview
// updates live.

const profile = reactive<Profile>({ firstName: '', lastName: '' });
const address = reactive<Address>({ street: '', city: '' });

// The parent composable has no fields of its own — it's purely an
// aggregator. A stub container keeps its run cycle a no-op while still
// wiring it into the provide/inject tree so the sections can attach.
// `stopPropagation: true` marks it as the aggregation root: it still
// provide()s its registry for the sections, but never registers upward.
type ParentState = Record<string, never>;
const parentContainer = new Container<ParentState>();
const parentState = reactive<ParentState>({});
const parent = useValidup<ParentState>(parentContainer, parentState, { stopPropagation: true });

const profileFromParent = computed(() => parent.$getResultsForChild<Profile>('profile'));
const addressFromParent = computed(() => parent.$getResultsForChild<Address>('address'));

const submitMessage = ref<string | undefined>();

async function submit() {
    // Submit walks the registry — the parent never imports the sections'
    // containers or composables. Guard the lookups loudly: a missing entry
    // means broken wiring (section not mounted / name mismatch), which must
    // not be conflated with "validation failed".
    const profileSection = profileFromParent.value;
    const addressSection = addressFromParent.value;
    if (!profileSection || !addressSection) {
        submitMessage.value = 'A section is not registered — wiring problem, not a validation failure.';
        return;
    }
    const [p, a] = await Promise.all([profileSection.$validate(), addressSection.$validate()]);
    submitMessage.value = p.success && a.success ?
        'Both sections valid — would submit now.' :
        'One or more sections invalid — fix and try again.';
}

function resetAll() {
    profileFromParent.value?.$reset();
    addressFromParent.value?.$reset();
}
</script>

<template>
    <div class="page">
        <ProfileSection :state="profile" />
        <AddressSection :state="address" />

        <section
            class="panel"
            style="grid-column: 1 / -1;"
        >
            <h2>Parent aggregator <span class="tag">root</span></h2>
            <p class="lede">
                The parent reaches each section by name via
                <code>$getResultsForChild</code>. This lets a wizard /
                page-level submit walk every section without leaking each
                section's container into the parent.
            </p>
            <div class="actions">
                <button @click="submit">
                    Submit (validates both)
                </button>
                <button
                    class="secondary"
                    @click="resetAll"
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
                    registered: !!profileFromParent,
                    invalid: profileFromParent?.$invalid.value ?? null,
                    dirty: profileFromParent?.$dirty.value ?? null,
                },
                address: {
                    registered: !!addressFromParent,
                    invalid: addressFromParent?.$invalid.value ?? null,
                    dirty: addressFromParent?.$dirty.value ?? null,
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
