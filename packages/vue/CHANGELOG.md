# Changelog

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
