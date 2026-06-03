<!--
  Copyright (c) 2026.
  Author Peter Placzek (tada5hi)
  For the full copyright and license information,
  view the LICENSE file that was distributed with this source code.
-->
<script setup lang="ts">
import type { IssueItem } from 'validup';

defineProps<{ issues: IssueItem[] }>();
</script>

<template>
    <div
        v-if="issues.length"
        class="cross-cutting"
    >
        <strong>Cannot submit:</strong>
        <ul>
            <li
                v-for="(issue, i) in issues"
                :key="i"
            >
                {{ issue.message }}
            </li>
        </ul>
    </div>
</template>
