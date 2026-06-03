<!--
  Copyright (c) 2026.
  Author Peter Placzek (tada5hi)
  For the full copyright and license information,
  view the LICENSE file that was distributed with this source code.
-->
<script setup lang="ts">
// $model is the vuelidate-shaped writable computed exposed by FieldState — writing
// through it is the documented binding pattern, but tripping vue/no-mutating-props.
/* eslint-disable vue/no-mutating-props */
import { computed } from 'vue';
import type { FieldState } from '@validup/vue';
import { getSeverity } from '@validup/vue';

const props = defineProps<{
    label: string;
    field: FieldState<string>;
    hint?: string;
    type?: string;
    autocomplete?: string;
}>();

const severity = computed(() => getSeverity(props.field));
const messages = computed(() => props.field.$errors.value.map((i) => i.message));
const showWarning = computed(() => severity.value === 'warning');
const showError = computed(() => severity.value === 'error');
</script>

<template>
    <div class="field">
        <label>{{ label }}</label>
        <input
            v-model="field.$model.value"
            :type="type ?? 'text'"
            :autocomplete="autocomplete"
            :class="{ invalid: showError, warning: showWarning }"
            @blur="field.$touch()"
        >
        <p
            v-if="hint"
            class="hint"
        >
            {{ hint }}
        </p>
        <ul
            v-if="showError && messages.length"
            class="errors"
        >
            <li
                v-for="m in messages"
                :key="m"
            >
                {{ m }}
            </li>
        </ul>
        <ul
            v-else-if="showWarning && messages.length"
            class="warnings"
        >
            <li
                v-for="m in messages"
                :key="m"
            >
                {{ m }}
            </li>
        </ul>
    </div>
</template>
