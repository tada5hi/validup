<!--
  Copyright (c) 2026.
  Author Peter Placzek (tada5hi)
  For the full copyright and license information,
  view the LICENSE file that was distributed with this source code.
-->
<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { computed } from 'vue';

const route = useRoute();
const title = computed(() => (route.meta?.title as string | undefined) ?? 'validup playground');
</script>

<template>
    <div class="app">
        <header>
            <h1>validup · {{ title }}</h1>
            <nav>
                <RouterLink to="/">
                    Overview
                </RouterLink>
                <RouterLink to="/basic">
                    Basic
                </RouterLink>
                <RouterLink to="/groups">
                    Groups
                </RouterLink>
                <RouterLink to="/nested">
                    Nested
                </RouterLink>
                <RouterLink to="/async">
                    Async
                </RouterLink>
                <RouterLink to="/server-errors">
                    Server errors
                </RouterLink>
                <RouterLink to="/severity">
                    Severity
                </RouterLink>
            </nav>
        </header>
        <RouterView />
    </div>
</template>
