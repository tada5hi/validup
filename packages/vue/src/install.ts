/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { App, InjectionKey, Plugin } from 'vue';
import type { ContainerRunOptions } from 'validup';

/**
 * Options surfaced app-wide by the `createValidup` plugin. Read inside
 * `useValidup` via `inject(VALIDUP_INSTALL_KEY)` and used as the
 * fallback when the composable doesn't supply its own value.
 *
 * Both properties mirror their `ContainerRunOptions` siblings —
 * `optionalValue` is the fallback for `MountOptions.optionalValue`,
 * `optionalAs` for `MountOptions.optionalAs`. Setting them on install
 * is how an app declares its own "form-friendly" idiom (e.g.
 * `{ optionalValue: ['undefined', 'empty_string'], optionalAs: null }`
 * to treat untouched inputs as missing AND emit `null` to the backend).
 */
export type InstallOptions = {
    optionalValue?: ContainerRunOptions['optionalValue'];
    optionalAs?: unknown;
};

/**
 * Injection key for the install-level options. Exposed so an
 * advanced consumer (e.g. a test harness) can `provide(...)` a
 * scoped override; normal apps use `app.use(createValidup(opts))`.
 */
export const VALIDUP_INSTALL_KEY: InjectionKey<InstallOptions> = Symbol('validup.install');

/**
 * Vue 3 plugin factory. Surfaces app-wide defaults that every
 * `useValidup` call inside the app picks up unless it overrides at
 * the composable level.
 *
 * @example
 * import { createValidup } from '@validup/vue';
 *
 * const app = createApp(...);
 * app.use(createValidup({
 *     optionalValue: ['undefined', 'empty_string'],
 *     optionalAs: null,
 * }));
 *
 * Precedence (highest → lowest):
 * `MountOptions` → `ContainerRunOptions` → `ContainerOptions` →
 * `ComposableOptions` → install options → core default.
 */
export function createValidup(options: InstallOptions = {}): Plugin {
    return {
        install(app: App) {
            app.provide(VALIDUP_INSTALL_KEY, options);
        },
    };
}
