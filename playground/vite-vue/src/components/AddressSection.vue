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
import type { Address } from './section-types';

// Sibling leaf section — same shape as ProfileSection, registered under its
// own `options.name` so the parent can address each section individually.
const props = defineProps<{ state: Address }>();

const container = new Container<Address>();
container.mount('street', createValidator(z.string().min(1, 'Required')));
container.mount('city', createValidator(z.string().min(1, 'Required')));

const form = useValidup<Address>(container, toRef(props, 'state'), { name: 'address' });
</script>

<template>
    <section class="panel">
        <h2>Address <span class="tag">child "address"</span></h2>
        <p class="lede">
            A sibling leaf component. Both sections expose themselves under
            their <code>options.name</code>.
        </p>
        <Field
            label="Street"
            :field="form.fields.street"
        />
        <Field
            label="City"
            :field="form.fields.city"
        />
    </section>
</template>
