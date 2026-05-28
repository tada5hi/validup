# Installation

Install the core package:

```bash
npm install validup --save
```

Optionally pick one or more integrations:

```bash
npm install @validup/standard-schema --save           # Standard Schema (zod 3.24+, valibot, arktype, …)
npm install @validup/zod --save                       # zod-specific (richer issue mapping)
npm install @validup/validator-js validator --save    # validator.js string validators
npm install @validup/vue --save                       # Vue 3 forms
```

## Requirements

| Requirement | Version |
|-------------|---------|
| Node.js     | `>=22.0.0` |
| Module format | ESM only — `"type": "module"` (or a bundler that resolves `"exports"`) |
| TypeScript  | 5.x recommended |

All packages publish ESM-only (`dist/index.mjs` + `dist/index.d.mts`). There is no CJS build. If your runtime is CJS, use a bundler that re-emits ESM, or `await import('validup')`.

## Peer dependencies

| Package                       | Peer deps                                       |
|-------------------------------|-------------------------------------------------|
| `validup`                     | —                                               |
| `@validup/standard-schema`    | `validup ^1.0.0`                                |
| `@validup/zod`                | `validup ^1.0.0`, `zod ^4.0.0`                  |
| `@validup/validator-js`       | `validup ^1.0.0`, `validator ^13.0.0`           |
| `@validup/vue`                | `validup ^1.0.0`, `vue ^3.3`                    |

## Verifying the install

```typescript
import { Container } from 'validup';

console.log(typeof Container); // 'function'
```

If the import resolves and TypeScript picks up the types from `dist/index.d.mts`, you're set. Continue to [Quick Start](/getting-started/quick-start).
