# Changelog

## [2.0.0](https://github.com/tada5hi/validup/compare/vue-v1.0.0...vue-v2.0.0) (2026-08-18)


### ⚠ BREAKING CHANGES

* validup no longer re-exports the issue model. Import Issue, IssueCode, defineIssueItem and the rest from '@ebec/core'; augment '@ebec/core' rather than 'validup' for IssueDataByCode.

### Features

* consume the issue model from blemish ([#465](https://github.com/tada5hi/validup/issues/465)) ([94d462f](https://github.com/tada5hi/validup/commit/94d462f1596c4aeb44b83324746a9436babd449d))


### Bug Fixes

* **deps:** bump the minorandpatch group across 1 directory with 7 updates ([#462](https://github.com/tada5hi/validup/issues/462)) ([daffcdc](https://github.com/tada5hi/validup/commit/daffcdcac566d2f630174c7d95d3bf02a7ae75f5))
* **vue:** preserve typed keys when the entity carries an index signature ([#468](https://github.com/tada5hi/validup/issues/468)) ([d6747c7](https://github.com/tada5hi/validup/commit/d6747c755bfbb4a052ce9c4345dd076f51768289))


### Code Refactoring

* source the issue model from @ebec/core ([#469](https://github.com/tada5hi/validup/issues/469)) ([977d4a1](https://github.com/tada5hi/validup/commit/977d4a17e75b2711c85bfc6b32fb42badbd8a423))


### Dependencies

* The following workspace dependencies were updated
  * peerDependencies
    * validup bumped from ^1.0.0 to ^2.0.0

## [1.0.0](https://github.com/tada5hi/validup/compare/vue-v0.3.3...vue-v1.0.0) (2026-07-31)


### Features

* **validup:** pathsStrict — fail loud on unmatched filter paths (+ vue widening fix) ([#424](https://github.com/tada5hi/validup/issues/424)) ([29d0cab](https://github.com/tada5hi/validup/commit/29d0cab8a13354f0e23121bad449a7577b42f224))


### Bug Fixes

* **deps:** bump the minorandpatch group across 1 directory with 10 updates ([#411](https://github.com/tada5hi/validup/issues/411)) ([490419d](https://github.com/tada5hi/validup/commit/490419da9240460cab6bc173e9d4c1fe9317ef4e))
* **deps:** bump the minorandpatch group across 1 directory with 15 updates ([#436](https://github.com/tada5hi/validup/issues/436)) ([dd38e66](https://github.com/tada5hi/validup/commit/dd38e66d0f7bc3e67a85086a5824350e6fa56fc4))
* **deps:** bump the minorandpatch group across 1 directory with 5 updates ([#416](https://github.com/tada5hi/validup/issues/416)) ([00c099a](https://github.com/tada5hi/validup/commit/00c099a3d59c81aad763c9618ed6be7db786ece2))
* **deps:** bump the minorandpatch group across 1 directory with 5 updates ([#422](https://github.com/tada5hi/validup/issues/422)) ([d22b3e6](https://github.com/tada5hi/validup/commit/d22b3e6b2798140ae34fa036ef0e49601c6695ea))
* **vue:** strip optional modifier from FieldsAccessor typed keys ([b65e2ce](https://github.com/tada5hi/validup/commit/b65e2ce893255a1c87e89c0858aabff23f28506b))


### Dependencies

* The following workspace dependencies were updated
  * peerDependencies
    * validup bumped from ^0.5.1 to ^1.0.0

## [0.3.3](https://github.com/tada5hi/validup/compare/vue-v0.3.2...vue-v0.3.3) (2026-06-04)


### Features

* **validup:** atomic optionalValue vocabulary + FALSY default ([ef8463c](https://github.com/tada5hi/validup/commit/ef8463caf219cbc2c7da45dde6725c806df8f2cc))
* **vue:** reactive child registry + nested-forms demo rewiring ([#403](https://github.com/tada5hi/validup/issues/403)) ([fbc7c6d](https://github.com/tada5hi/validup/commit/fbc7c6d5190bc970b0e105ba7ec8b7002850c71d))


### Bug Fixes

* **deps:** bump the minorandpatch group across 1 directory with 3 updates ([#402](https://github.com/tada5hi/validup/issues/402)) ([17af0d5](https://github.com/tada5hi/validup/commit/17af0d564c949e922cd195c45643840ff3ec93fc))
* **validup:** revert default optionalValue to UNDEFINED ([#400](https://github.com/tada5hi/validup/issues/400)) ([1ee670b](https://github.com/tada5hi/validup/commit/1ee670b5fadc4bb8d2b41779f2df7bffb3feaf9d))


### Dependencies

* The following workspace dependencies were updated
  * peerDependencies
    * validup bumped from ^0.5.0 to ^0.5.1

## [0.3.2](https://github.com/tada5hi/validup/compare/vue-v0.3.1...vue-v0.3.2) (2026-06-03)


### Dependencies

* The following workspace dependencies were updated
  * peerDependencies
    * validup bumped from ^0.4.1 to ^0.5.0

## [0.3.1](https://github.com/tada5hi/validup/compare/vue-v0.3.0...vue-v0.3.1) (2026-06-03)


### Features

* strict-mode typings — Partial&lt;T&gt; input + clean fields accessor ([#393](https://github.com/tada5hi/validup/issues/393)) ([9590445](https://github.com/tada5hi/validup/commit/9590445e1958fe296af8538e8851ea78154c72ce))


### Dependencies

* The following workspace dependencies were updated
  * peerDependencies
    * validup bumped from ^0.4.0 to ^0.4.1

## [0.3.0](https://github.com/tada5hi/validup/compare/vue-v0.2.0...vue-v0.3.0) (2026-05-29)


### ⚠ BREAKING CHANGES

* every read/write of `issue.params`, every `defineIssueItem` / `defineIssueGroup` / `createValidupError` call that names the structured payload field, every adapter option labelled `params`, and every declaration-merging block on `IssueParamsByCode` must be updated to use `data`.
* every import of the symbols above must be updated. The names of the cache module files (`packages/validup/src/cache/`) are unchanged. PR #389 only just merged so the blast radius is expected to be small; pre-1.0 makes this acceptable churn.
* **vue:** optional-aware getSeverity using meta.optional ([#383](https://github.com/tada5hi/validup/issues/383))
* **vue:** every public export from @validup/vue listed above has been renamed. Consumers must update imports — there is no aliased re-export.
* graduate validup ecosystem to 1.0 ([#380](https://github.com/tada5hi/validup/issues/380))

### Features

* graduate validup ecosystem to 1.0 ([#380](https://github.com/tada5hi/validup/issues/380)) ([bb15344](https://github.com/tada5hi/validup/commit/bb153443aebdaa4d260a28947d003e8cdd5de1fe))
* **vue:** optional-aware getSeverity using meta.optional ([#383](https://github.com/tada5hi/validup/issues/383)) ([372fd87](https://github.com/tada5hi/validup/commit/372fd8775241b1947667fcc6ab08d1b0201d0ee7))


### Bug Fixes

* oneOf grouping, mount validation, fallback issues, zod 3 drop, stability docs ([#375](https://github.com/tada5hi/validup/issues/375)) ([b4751a0](https://github.com/tada5hi/validup/commit/b4751a08840abd05f64cd7a7b439939cb5c7497a))


### Code Refactoring

* rename Issue.params → Issue.data ([0097c1a](https://github.com/tada5hi/validup/commit/0097c1aba5f142840e2b846e066564d3bcc55433))
* rename ValidationCache → ResultCache ([189e204](https://github.com/tada5hi/validup/commit/189e20438f6a0637ed0c971c2790500de55ccf4d))
* **vue:** drop Validup prefix and convert interfaces to types ([#381](https://github.com/tada5hi/validup/issues/381)) ([7cf243c](https://github.com/tada5hi/validup/commit/7cf243cee581654995329b7485279399e59fdf1d))


### Dependencies

* The following workspace dependencies were updated
  * peerDependencies
    * validup bumped from ^0.3.0 to ^0.4.0

## [0.2.0](https://github.com/tada5hi/validup/compare/vue-v0.1.0...vue-v0.2.0) (2026-05-22)


### ⚠ BREAKING CHANGES

* @validup/routup is no longer published. Replace RoutupContainerAdapter with a direct Container.run / safeRun call against useRequestBody / useRequestQuery / useRequestCookies / useRequestParams from routup + @routup/basic.

### Features

* add VitePress docs site and relicense to Apache-2.0 ([6b8e601](https://github.com/tada5hi/validup/commit/6b8e6017cae573e1290c971b6e699b97461fd0eb))
* drop @validup/routup integration package ([f0c1901](https://github.com/tada5hi/validup/commit/f0c1901538b4d22422c2b37aadec877bc6a95d98))
* ship improvements plan items 4-10, 12-13 + ebec + Standard Schema ([#359](https://github.com/tada5hi/validup/issues/359)) ([d2f0c04](https://github.com/tada5hi/validup/commit/d2f0c042fe557ba192eb6d34ac6067f78c3bed67))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.2.2 to ^0.3.0
