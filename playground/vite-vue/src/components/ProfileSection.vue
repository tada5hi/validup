<!--
  Copyright (c) 2026.
  Author Peter Placzek (tada5hi)
  For the full copyright and license information,
  view the LICENSE file that was distributed with this source code.
-->
<script setup lang="ts">
import { toRef } from 'vue';
import { z } from 'zod';
import { Container } from 'validup';
import { createValidator } from '@validup/zod';
import { useValidup } from '@validup/vue';
import Field from './Field.vue';
import type { Profile } from './section-types';

// The section owns its container AND its composable. `name: 'profile'`
// registers it with the nearest ancestor useValidup() via inject/provide —
// which is exactly why this lives in its own component: inject() never sees
// provides from the same component, so leaf sections must be real children
// of the aggregator.
const props = defineProps<{ state: Profile }>();

const container = new Container<Profile>();
container.mount('firstName', createValidator(z.string().min(1, 'Required')));
container.mount('lastName', createValidator(z.string().min(1, 'Required')));

const form = useValidup<Profile>(container, toRef(props, 'state'), { name: 'profile' });
</script>

<template>
    <section class="panel">
        <h2>Profile <span class="tag">child "profile"</span></h2>
        <p class="lede">
            A leaf component with its own <code>useValidup()</code>. Registers
            itself with the parent aggregator under <code>name: "profile"</code>.
        </p>
        <Field
            label="First name"
            :field="form.fields.firstName"
        />
        <Field
            label="Last name"
            :field="form.fields.lastName"
        />
    </section>
</template>
