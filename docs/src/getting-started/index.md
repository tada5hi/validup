# Introduction

**validup** is a composable, path-based validation library for TypeScript. It picks a deliberate point between schema DSLs (which bake in every rule) and hand-rolled validators (which tangle parsing, validation, and transformation):

> Mount any validator function onto any path of any input, compose containers, and let the runtime handle path expansion, group filtering, and error aggregation.

You bring the validators (or wrap an existing library through an integration package); validup orchestrates them.

## Three nouns, one verb

| Noun | Role |
|------|------|
| `Container` | A bag of mounts. Mount a validator on a path, mount another container at a sub-path, run the whole graph. |
| `Validator` | A function `(ctx) => value | Promise<value>`. Throws on failure; the runtime converts the throw into an `Issue`. |
| `Issue`     | A discriminated record (`item` or `group`) with `path`, `message`, `code`, optional `expected`/`received`. |

The verb is `container.run(data)` (with `runSync`, `runParallel`, `safeRun`, `safeRunSync` siblings). On failure it throws a `ValidupError` carrying the collected `Issue[]`.

## When to use validup

- You need to mount **per-path** validation rules without committing to one schema library.
- You want to **compose** small, testable validators rather than write one giant schema.
- You already use a validator (zod, express-validator, valibot, arktype) and want a shared **path/group/issue** model on top of it.
- You want a **typed user context** flowing through nested mounts (`Container<T, C>`).
- You want a single model that drives both server-side parsing and a Vue 3 reactive form.

## Next steps

- [Installation](/getting-started/installation) — install the core and any integration packages.
- [Quick Start](/getting-started/quick-start) — compose a Container, run it, handle errors.
- [Guide → Container](/guide/container) — the full mount semantics.
- [Integrations](/integrations/) — pick a bridge to zod, express-validator, Routup, or Vue.
