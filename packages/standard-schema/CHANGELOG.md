# Changelog

## [0.2.1](https://github.com/tada5hi/validup/compare/standard-schema-v0.2.0...standard-schema-v0.2.1) (2026-06-03)


### Dependencies

* The following workspace dependencies were updated
  * peerDependencies
    * validup bumped from ^0.4.0 to ^0.4.1

## [0.2.0](https://github.com/tada5hi/validup/compare/standard-schema-v0.1.1...standard-schema-v0.2.0) (2026-05-29)


### ⚠ BREAKING CHANGES

* every import of the symbols above must be updated. The names of the cache module files (`packages/validup/src/cache/`) are unchanged. PR #389 only just merged so the blast radius is expected to be small; pre-1.0 makes this acceptable churn.
* graduate validup ecosystem to 1.0 ([#380](https://github.com/tada5hi/validup/issues/380))

### Features

* graduate validup ecosystem to 1.0 ([#380](https://github.com/tada5hi/validup/issues/380)) ([bb15344](https://github.com/tada5hi/validup/commit/bb153443aebdaa4d260a28947d003e8cdd5de1fe))


### Bug Fixes

* oneOf grouping, mount validation, fallback issues, zod 3 drop, stability docs ([#375](https://github.com/tada5hi/validup/issues/375)) ([b4751a0](https://github.com/tada5hi/validup/commit/b4751a08840abd05f64cd7a7b439939cb5c7497a))


### Code Refactoring

* rename ValidationCache → ResultCache ([189e204](https://github.com/tada5hi/validup/commit/189e20438f6a0637ed0c971c2790500de55ccf4d))


### Dependencies

* The following workspace dependencies were updated
  * peerDependencies
    * validup bumped from ^0.3.0 to ^0.4.0

## [0.1.1](https://github.com/tada5hi/validup/compare/standard-schema-v0.1.0...standard-schema-v0.1.1) (2026-05-22)


### Features

* add VitePress docs site and relicense to Apache-2.0 ([6b8e601](https://github.com/tada5hi/validup/commit/6b8e6017cae573e1290c971b6e699b97461fd0eb))
* compile-time output typing (improvements plan item 11) ([#362](https://github.com/tada5hi/validup/issues/362)) ([fd6b610](https://github.com/tada5hi/validup/commit/fd6b61095fecfd9ec243d5dc7a462d29402a0efa))
* ship improvements plan items 4-10, 12-13 + ebec + Standard Schema ([#359](https://github.com/tada5hi/validup/issues/359)) ([d2f0c04](https://github.com/tada5hi/validup/commit/d2f0c042fe557ba192eb6d34ac6067f78c3bed67))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.2.2 to ^0.3.0
