# @validup-playground/vite-vue

A private Vite + Vue 3 playground that exercises [`@validup/vue`](../../packages/vue) against the local workspace packages. Each route demonstrates a specific facet of the composable so you can poke at the runtime without checking out a separate repo.

The playground is **not published** to npm and is excluded from release-please.

## Routes

| Route             | Demonstrates                                                                  |
|-------------------|-------------------------------------------------------------------------------|
| `/` (Home)        | Index / cross-links to every demo                                             |
| `/basic`          | Per-field state, `$dirty` / `$touch`, `$validate()` on submit, `lazy: true`   |
| `/groups`         | One container, `create` vs `update` flows — `password` only runs in `create`  |
| `/nested`         | Parent / child components via inject/provide; reactive `$getResultsForChild('name')` aggregation + submit |
| `/async`          | Debounced async refine (zod) with `sideEffect: true` to bypass the cache      |
| `/server-errors`  | Folding server responses back via `setExternalIssues` (per-field + path-less) |
| `/severity`       | `getSeverity(field)` — optional mounts emit warnings; required keep red       |

## Running

From the **repo root**:

```bash
npm install
npm run dev --workspace=@validup-playground/vite-vue
```

The dev server opens on <http://localhost:5173>. The Vite config aliases `validup`, `@validup/vue`, and `@validup/zod` to the workspace sources, so edits in `packages/**` hot-reload here without a rebuild.

## Build / typecheck

```bash
npm run build --workspace=@validup-playground/vite-vue       # vue-tsc --noEmit && vite build
npm run typecheck --workspace=@validup-playground/vite-vue   # vue-tsc --noEmit
```

The playground is included in `nx run-many -t build`, so the root `npm run build` also produces `playground/vite-vue/dist`.

## Layout

```
playground/vite-vue/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── App.vue              # Layout shell + nav
    ├── main.ts              # createApp + router
    ├── router.ts            # Hash-history router (no server config required)
    ├── style.css
    ├── components/
    │   ├── Field.vue                # Reusable text-input field with error / warning rendering
    │   ├── CrossCuttingErrors.vue   # Render path-less issues at the top of a form
    │   ├── ResultPanel.vue          # Live state / flags / raw $issues for each demo
    │   ├── ProfileSection.vue       # Leaf section for /nested — own container + useValidup({ name: 'profile' })
    │   ├── AddressSection.vue       # Leaf section for /nested — own container + useValidup({ name: 'address' })
    │   └── section-types.ts         # Profile / Address state shapes shared by /nested + its sections
    └── pages/
        ├── Home.vue
        ├── BasicForm.vue
        ├── GroupsForm.vue
        ├── NestedForms.vue
        ├── AsyncForm.vue
        ├── ServerErrors.vue
        └── Severity.vue
```
