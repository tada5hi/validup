<!--
  Copyright (c) 2026.
  Author Peter Placzek (tada5hi)
  For the full copyright and license information,
  view the LICENSE file that was distributed with this source code.
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { ObjectLiteral } from 'validup';
import type { Composable } from '@validup/vue';

const props = defineProps<{
    composable: Composable<ObjectLiteral>;
    state: Record<string, unknown>;
}>();

const snapshot = computed(() => ({
    invalid: props.composable.$invalid.value,
    dirty: props.composable.$dirty.value,
    pending: props.composable.$pending.value,
    errorCount: props.composable.$errors.value.length,
    crossCuttingCount: props.composable.$crossCuttingErrors.value.length,
    groupCount: props.composable.$groupErrors.value.length,
}));
</script>

<template>
    <section class="panel">
        <h2>Reactive state</h2>
        <p class="lede">
            Form-level flags reported by the composable, plus the live
            <code>state</code> being validated.
        </p>
        <pre>{{ JSON.stringify(snapshot, null, 2) }}</pre>
        <h2 style="margin-top: 1.2rem;">
            state
        </h2>
        <pre>{{ JSON.stringify(state, null, 2) }}</pre>
        <h2 style="margin-top: 1.2rem;">
            $issues (raw)
        </h2>
        <pre>{{ JSON.stringify(composable.$issues.value, null, 2) }}</pre>
    </section>
</template>
