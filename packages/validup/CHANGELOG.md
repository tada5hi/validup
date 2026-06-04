# Changelog

## [0.5.1](https://github.com/tada5hi/validup/compare/validup-v0.5.0...validup-v0.5.1) (2026-06-04)


### Features

* **validup:** atomic optionalValue vocabulary + FALSY default ([ef8463c](https://github.com/tada5hi/validup/commit/ef8463caf219cbc2c7da45dde6725c806df8f2cc))


### Bug Fixes

* **validup:** revert default optionalValue to UNDEFINED ([#400](https://github.com/tada5hi/validup/issues/400)) ([1ee670b](https://github.com/tada5hi/validup/commit/1ee670b5fadc4bb8d2b41779f2df7bffb3feaf9d))

## [0.5.0](https://github.com/tada5hi/validup/compare/validup-v0.4.1...validup-v0.5.0) (2026-06-03)


### ⚠ BREAKING CHANGES

* every read/write of `issue.params`, every `defineIssueItem` / `defineIssueGroup` / `createValidupError` call that names the structured payload field, every adapter option labelled `params`, and every declaration-merging block on `IssueParamsByCode` must be updated to use `data`.
* every import of the symbols above must be updated. The names of the cache module files (`packages/validup/src/cache/`) are unchanged. PR #389 only just merged so the blast radius is expected to be small; pre-1.0 makes this acceptable churn.
* **vue:** optional-aware getSeverity using meta.optional ([#383](https://github.com/tada5hi/validup/issues/383))
* graduate validup ecosystem to 1.0 ([#380](https://github.com/tada5hi/validup/issues/380))
* @validup/routup is no longer published. Replace RoutupContainerAdapter with a direct Container.run / safeRun call against useRequestBody / useRequestQuery / useRequestCookies / useRequestParams from routup + @routup/basic.
* API Changed

### Features

* add initialize helper fn for container ([aafd12a](https://github.com/tada5hi/validup/commit/aafd12ada463776a353d9876237836e75f4988aa))
* add optional, optionalValue & optionalInlcude option for container mount ([5b40d2a](https://github.com/tada5hi/validup/commit/5b40d2a1dfb42bf25a37ac9814f1992e37f7d1e4))
* add path-property helpers ([7643b3b](https://github.com/tada5hi/validup/commit/7643b3be6d14e23890296bccc5052f0bc9308f05))
* add types for object path property ([#18](https://github.com/tada5hi/validup/issues/18)) ([308dd6f](https://github.com/tada5hi/validup/commit/308dd6f2a68e4d8f182ea56a122b5d2dd28aea03))
* add VitePress docs site and relicense to Apache-2.0 ([6b8e601](https://github.com/tada5hi/validup/commit/6b8e6017cae573e1290c971b6e699b97461fd0eb))
* add zod & validator adapter + cleanup code base ([97311e0](https://github.com/tada5hi/validup/commit/97311e0217ae9b8e920506f26a0feedf057ad6d9))
* additional helper for error message building ([928bc8b](https://github.com/tada5hi/validup/commit/928bc8bfcb6aa9c207512905d1857136fbf15219))
* adjusted input for nested validation error ([91582f7](https://github.com/tada5hi/validup/commit/91582f79b18f9bf8f11191f26fbe38467e923c84))
* always run container items with non defined group ([f03cc9f](https://github.com/tada5hi/validup/commit/f03cc9fba3c4ef411dd1b8ceb1acd8631872e5d1))
* better and simpler type/interface naming ([3859f36](https://github.com/tada5hi/validup/commit/3859f3693e4b8fa64c47cb193ee2879b94a69dfb))
* change attribute error path type to string ([4df739b](https://github.com/tada5hi/validup/commit/4df739bd8d750cf9dce6384238305787a1a434f9))
* change mount signature & initial README.md ([dbea40e](https://github.com/tada5hi/validup/commit/dbea40e17238ad12b7ffabeadb7c9f01065cfece))
* compile-time output typing (improvements plan item 11) ([#362](https://github.com/tada5hi/validup/issues/362)) ([fd6b610](https://github.com/tada5hi/validup/commit/fd6b61095fecfd9ec243d5dc7a462d29402a0efa))
* container safe-parse method ([#327](https://github.com/tada5hi/validup/issues/327)) ([c4f0a13](https://github.com/tada5hi/validup/commit/c4f0a13bec376242fe2c702a4e090267b93bbe41))
* drop @validup/routup integration package ([f0c1901](https://github.com/tada5hi/validup/commit/f0c1901538b4d22422c2b37aadec877bc6a95d98))
* enhance differentation between validator & container ([7eb9ed8](https://github.com/tada5hi/validup/commit/7eb9ed860c6349bc7dca661d9a5f75b10d567148))
* graduate validup ecosystem to 1.0 ([#380](https://github.com/tada5hi/validup/issues/380)) ([bb15344](https://github.com/tada5hi/validup/commit/bb153443aebdaa4d260a28947d003e8cdd5de1fe))
* initial routup adapter implementation ([#31](https://github.com/tada5hi/validup/issues/31)) ([be6137f](https://github.com/tada5hi/validup/commit/be6137fa0ee200c872d0536b94ecf9b4c8583c25))
* initialize project from source ([5affc1b](https://github.com/tada5hi/validup/commit/5affc1bcdb1053fabd2909ac1f04fcdd49bfd9ab))
* introduce container oneOf and pathsToInclude option ([a4e9a10](https://github.com/tada5hi/validup/commit/a4e9a1045924a7946cd628d282099ec0b788b76f))
* introduce pathsToExclude option ([bd69ec7](https://github.com/tada5hi/validup/commit/bd69ec7e3b71e001a75a27f492316e64c4bf122c))
* issue mechanism & path refactoring ([#311](https://github.com/tada5hi/validup/issues/311)) ([7b26a1f](https://github.com/tada5hi/validup/commit/7b26a1f3465e47d680fbef2f29aba3b3cffe6c81))
* make issue item code prop required ([e893b95](https://github.com/tada5hi/validup/commit/e893b95b8ddc25486338dac652c9bd7c584fb218))
* more flexible container implementation ([66c12c6](https://github.com/tada5hi/validup/commit/66c12c62cd4663602d8e074110044a6c28faba35))
* optimized relations lookup + added test suite ([d11f77b](https://github.com/tada5hi/validup/commit/d11f77b27c1aade1ab0f610f7c1f94b94aa19b3c))
* pass group to underlying validator on container execution ([6e44105](https://github.com/tada5hi/validup/commit/6e44105ce5e0c32e926f12e3516ee8fc4683864e))
* permit mounting container without path ([420933b](https://github.com/tada5hi/validup/commit/420933b87f14e18fb23c5008bd82ea835bb78afd))
* replace internal path helpers with pathtrace ([9e82be1](https://github.com/tada5hi/validup/commit/9e82be14bde589f3915c57fd6ddee9d2a357f71e))
* shape helper for error & issues ([1eea1c0](https://github.com/tada5hi/validup/commit/1eea1c05d8d766433e569e51e1049a4f4e324437))
* ship improvements plan items 4-10, 12-13 + ebec + Standard Schema ([#359](https://github.com/tada5hi/validup/issues/359)) ([d2f0c04](https://github.com/tada5hi/validup/commit/d2f0c042fe557ba192eb6d34ac6067f78c3bed67))
* simplify mounting and executing validators ([b68a92f](https://github.com/tada5hi/validup/commit/b68a92fec598cd43c646908a13a3fd0e44c8310e))
* simplify mounting child validators ([dcbc689](https://github.com/tada5hi/validup/commit/dcbc6898cd00450e490d80a499cd12993abe646c))
* strict-mode typings — Partial&lt;T&gt; input + clean fields accessor ([#393](https://github.com/tada5hi/validup/issues/393)) ([9590445](https://github.com/tada5hi/validup/commit/9590445e1958fe296af8538e8851ea78154c72ce))
* stringify path helper ([345cb52](https://github.com/tada5hi/validup/commit/345cb52053f9cfb55695c363fb024c51f50df9ed))
* **validup:** tag issues from optional mounts with meta.optional ([#382](https://github.com/tada5hi/validup/issues/382)) ([cf3ad60](https://github.com/tada5hi/validup/commit/cf3ad600823c60aa65afb596e264165b9f711bc9))
* **vue:** optional-aware getSeverity using meta.optional ([#383](https://github.com/tada5hi/validup/issues/383)) ([372fd87](https://github.com/tada5hi/validup/commit/372fd8775241b1947667fcc6ab08d1b0201d0ee7))


### Bug Fixes

* adjusted function signatures ([bcb2eff](https://github.com/tada5hi/validup/commit/bcb2effd55714829d8f6f3a848dc9d2e7fede3e0))
* append path from parent container ([c9c07f1](https://github.com/tada5hi/validup/commit/c9c07f1f003a68799e0ac874f7dd3f47e72af039))
* appending child container values ([4eb7c8d](https://github.com/tada5hi/validup/commit/4eb7c8d13820d280186c26cabe902a287f0d2932))
* **deps:** bump pathtrace from 1.0.0 to 1.1.0 ([#123](https://github.com/tada5hi/validup/issues/123)) ([f1ad75a](https://github.com/tada5hi/validup/commit/f1ad75a7d54bc88dce7d311110bd233470b983f7))
* **deps:** bump pathtrace to v1.0.0 ([b5a4438](https://github.com/tada5hi/validup/commit/b5a4438a5505cbfbac4f964c06f4ebbdc06f2e67))
* **deps:** bump pathtrace to v2.1.2 ([bf81b78](https://github.com/tada5hi/validup/commit/bf81b7890dfdc04e157db3c08533557c7714b02b))
* **deps:** bump the minorandpatch group across 1 directory with 7 updates ([#371](https://github.com/tada5hi/validup/issues/371)) ([d54cfd5](https://github.com/tada5hi/validup/commit/d54cfd56453543c5abadfadd6ef430fd3be66979))
* **deps:** bump the minorandpatch group across 1 directory with 8 updates ([#335](https://github.com/tada5hi/validup/issues/335)) ([8246912](https://github.com/tada5hi/validup/commit/8246912300fd35eb367072e0613424429668e894))
* group issues if child is container or more than one item ([85cc68a](https://github.com/tada5hi/validup/commit/85cc68ae382d9362b3180b1d94845fad4764984d))
* nested pathsToInclude/Exclude forwarding and core/adapter bugs ([f95d2aa](https://github.com/tada5hi/validup/commit/f95d2aa732450f5022b32a7765867e5e1d6f146c))
* oneOf grouping, mount validation, fallback issues, zod 3 drop, stability docs ([#375](https://github.com/tada5hi/validup/issues/375)) ([b4751a0](https://github.com/tada5hi/validup/commit/b4751a08840abd05f64cd7a7b439939cb5c7497a))
* optional value check ([bc2359a](https://github.com/tada5hi/validup/commit/bc2359af0e03ff84860a9a392c0e41e27f580cc8))
* use child error paths if parent mount path is empty ([8db0d3b](https://github.com/tada5hi/validup/commit/8db0d3b92fdf2587dd961236531eb0b6e20cea36))
* use ZodRawIssue instead of ZodCustomIssue ([8822210](https://github.com/tada5hi/validup/commit/8822210257448092bce48c2e39f31e6260ef3c1d))
* workflow for executing group(s) ([52b65ed](https://github.com/tada5hi/validup/commit/52b65ed5fe0139ea56f37f72e771930a0d9344b3))


### Code Refactoring

* rename Issue.params → Issue.data ([0097c1a](https://github.com/tada5hi/validup/commit/0097c1aba5f142840e2b846e066564d3bcc55433))
* rename ValidationCache → ResultCache ([189e204](https://github.com/tada5hi/validup/commit/189e20438f6a0637ed0c971c2790500de55ccf4d))

## [0.4.1](https://github.com/tada5hi/validup/compare/validup-v0.4.0...validup-v0.4.1) (2026-06-03)


### Features

* strict-mode typings — Partial&lt;T&gt; input + clean fields accessor ([#393](https://github.com/tada5hi/validup/issues/393)) ([9590445](https://github.com/tada5hi/validup/commit/9590445e1958fe296af8538e8851ea78154c72ce))

## [0.4.0](https://github.com/tada5hi/validup/compare/validup-v0.3.0...validup-v0.4.0) (2026-05-29)


### ⚠ BREAKING CHANGES

* every read/write of `issue.params`, every `defineIssueItem` / `defineIssueGroup` / `createValidupError` call that names the structured payload field, every adapter option labelled `params`, and every declaration-merging block on `IssueParamsByCode` must be updated to use `data`.
* every import of the symbols above must be updated. The names of the cache module files (`packages/validup/src/cache/`) are unchanged. PR #389 only just merged so the blast radius is expected to be small; pre-1.0 makes this acceptable churn.
* **vue:** optional-aware getSeverity using meta.optional ([#383](https://github.com/tada5hi/validup/issues/383))
* graduate validup ecosystem to 1.0 ([#380](https://github.com/tada5hi/validup/issues/380))

### Features

* graduate validup ecosystem to 1.0 ([#380](https://github.com/tada5hi/validup/issues/380)) ([bb15344](https://github.com/tada5hi/validup/commit/bb153443aebdaa4d260a28947d003e8cdd5de1fe))
* **validup:** tag issues from optional mounts with meta.optional ([#382](https://github.com/tada5hi/validup/issues/382)) ([cf3ad60](https://github.com/tada5hi/validup/commit/cf3ad600823c60aa65afb596e264165b9f711bc9))
* **vue:** optional-aware getSeverity using meta.optional ([#383](https://github.com/tada5hi/validup/issues/383)) ([372fd87](https://github.com/tada5hi/validup/commit/372fd8775241b1947667fcc6ab08d1b0201d0ee7))


### Bug Fixes

* oneOf grouping, mount validation, fallback issues, zod 3 drop, stability docs ([#375](https://github.com/tada5hi/validup/issues/375)) ([b4751a0](https://github.com/tada5hi/validup/commit/b4751a08840abd05f64cd7a7b439939cb5c7497a))


### Code Refactoring

* rename Issue.params → Issue.data ([0097c1a](https://github.com/tada5hi/validup/commit/0097c1aba5f142840e2b846e066564d3bcc55433))
* rename ValidationCache → ResultCache ([189e204](https://github.com/tada5hi/validup/commit/189e20438f6a0637ed0c971c2790500de55ccf4d))

## [0.3.0](https://github.com/tada5hi/validup/compare/validup-v0.2.2...validup-v0.3.0) (2026-05-22)


### ⚠ BREAKING CHANGES

* @validup/routup is no longer published. Replace RoutupContainerAdapter with a direct Container.run / safeRun call against useRequestBody / useRequestQuery / useRequestCookies / useRequestParams from routup + @routup/basic.

### Features

* add VitePress docs site and relicense to Apache-2.0 ([6b8e601](https://github.com/tada5hi/validup/commit/6b8e6017cae573e1290c971b6e699b97461fd0eb))
* compile-time output typing (improvements plan item 11) ([#362](https://github.com/tada5hi/validup/issues/362)) ([fd6b610](https://github.com/tada5hi/validup/commit/fd6b61095fecfd9ec243d5dc7a462d29402a0efa))
* drop @validup/routup integration package ([f0c1901](https://github.com/tada5hi/validup/commit/f0c1901538b4d22422c2b37aadec877bc6a95d98))
* ship improvements plan items 4-10, 12-13 + ebec + Standard Schema ([#359](https://github.com/tada5hi/validup/issues/359)) ([d2f0c04](https://github.com/tada5hi/validup/commit/d2f0c042fe557ba192eb6d34ac6067f78c3bed67))


### Bug Fixes

* **deps:** bump the minorandpatch group across 1 directory with 7 updates ([#371](https://github.com/tada5hi/validup/issues/371)) ([d54cfd5](https://github.com/tada5hi/validup/commit/d54cfd56453543c5abadfadd6ef430fd3be66979))
* **deps:** bump the minorandpatch group across 1 directory with 8 updates ([#335](https://github.com/tada5hi/validup/issues/335)) ([8246912](https://github.com/tada5hi/validup/commit/8246912300fd35eb367072e0613424429668e894))
* nested pathsToInclude/Exclude forwarding and core/adapter bugs ([f95d2aa](https://github.com/tada5hi/validup/commit/f95d2aa732450f5022b32a7765867e5e1d6f146c))

## [0.2.2](https://github.com/tada5hi/validup/compare/validup-v0.2.1...validup-v0.2.2) (2026-02-17)


### Features

* container safe-parse method ([#327](https://github.com/tada5hi/validup/issues/327)) ([c4f0a13](https://github.com/tada5hi/validup/commit/c4f0a13bec376242fe2c702a4e090267b93bbe41))


### Bug Fixes

* use ZodRawIssue instead of ZodCustomIssue ([8822210](https://github.com/tada5hi/validup/commit/8822210257448092bce48c2e39f31e6260ef3c1d))

## [0.2.1](https://github.com/tada5hi/validup/compare/validup-v0.2.0...validup-v0.2.1) (2026-02-10)


### Features

* shape helper for error & issues ([1eea1c0](https://github.com/tada5hi/validup/commit/1eea1c05d8d766433e569e51e1049a4f4e324437))
* stringify path helper ([345cb52](https://github.com/tada5hi/validup/commit/345cb52053f9cfb55695c363fb024c51f50df9ed))

## [0.2.0](https://github.com/tada5hi/validup/compare/validup-v0.1.10...validup-v0.2.0) (2026-02-10)


### ⚠ BREAKING CHANGES

* API Changed

### Features

* enhance differentation between validator & container ([7eb9ed8](https://github.com/tada5hi/validup/commit/7eb9ed860c6349bc7dca661d9a5f75b10d567148))
* issue mechanism & path refactoring ([#311](https://github.com/tada5hi/validup/issues/311)) ([7b26a1f](https://github.com/tada5hi/validup/commit/7b26a1f3465e47d680fbef2f29aba3b3cffe6c81))
* make issue item code prop required ([e893b95](https://github.com/tada5hi/validup/commit/e893b95b8ddc25486338dac652c9bd7c584fb218))


### Bug Fixes

* **deps:** bump pathtrace to v2.1.2 ([bf81b78](https://github.com/tada5hi/validup/commit/bf81b7890dfdc04e157db3c08533557c7714b02b))
* group issues if child is container or more than one item ([85cc68a](https://github.com/tada5hi/validup/commit/85cc68ae382d9362b3180b1d94845fad4764984d))

## [0.1.10](https://github.com/tada5hi/validup/compare/validup-v0.1.9...validup-v0.1.10) (2025-12-08)


### Features

* more flexible container implementation ([66c12c6](https://github.com/tada5hi/validup/commit/66c12c62cd4663602d8e074110044a6c28faba35))

## [0.1.9](https://github.com/tada5hi/validup/compare/validup-v0.1.8...validup-v0.1.9) (2025-02-10)


### Bug Fixes

* use child error paths if parent mount path is empty ([8db0d3b](https://github.com/tada5hi/validup/commit/8db0d3b92fdf2587dd961236531eb0b6e20cea36))

## [0.1.8](https://github.com/tada5hi/validup/compare/validup-v0.1.7...validup-v0.1.8) (2024-11-06)


### Features

* additional helper for error message building ([928bc8b](https://github.com/tada5hi/validup/commit/928bc8bfcb6aa9c207512905d1857136fbf15219))
* introduce pathsToExclude option ([bd69ec7](https://github.com/tada5hi/validup/commit/bd69ec7e3b71e001a75a27f492316e64c4bf122c))
* pass group to underlying validator on container execution ([6e44105](https://github.com/tada5hi/validup/commit/6e44105ce5e0c32e926f12e3516ee8fc4683864e))


### Bug Fixes

* **deps:** bump pathtrace from 1.0.0 to 1.1.0 ([#123](https://github.com/tada5hi/validup/issues/123)) ([f1ad75a](https://github.com/tada5hi/validup/commit/f1ad75a7d54bc88dce7d311110bd233470b983f7))
* optional value check ([bc2359a](https://github.com/tada5hi/validup/commit/bc2359af0e03ff84860a9a392c0e41e27f580cc8))

## [0.1.7](https://github.com/tada5hi/validup/compare/validup-v0.1.6...validup-v0.1.7) (2024-09-16)


### Features

* add optional, optionalValue & optionalInlcude option for container mount ([5b40d2a](https://github.com/tada5hi/validup/commit/5b40d2a1dfb42bf25a37ac9814f1992e37f7d1e4))

## [0.1.6](https://github.com/tada5hi/validup/compare/validup-v0.1.5...validup-v0.1.6) (2024-09-02)


### Features

* replace internal path helpers with pathtrace ([9e82be1](https://github.com/tada5hi/validup/commit/9e82be14bde589f3915c57fd6ddee9d2a357f71e))


### Bug Fixes

* **deps:** bump pathtrace to v1.0.0 ([b5a4438](https://github.com/tada5hi/validup/commit/b5a4438a5505cbfbac4f964c06f4ebbdc06f2e67))

## [0.1.5](https://github.com/tada5hi/validup/compare/validup-v0.1.4...validup-v0.1.5) (2024-08-17)


### Features

* add initialize helper fn for container ([aafd12a](https://github.com/tada5hi/validup/commit/aafd12ada463776a353d9876237836e75f4988aa))

## [0.1.4](https://github.com/tada5hi/validup/compare/validup-v0.1.3...validup-v0.1.4) (2024-08-06)


### Features

* adjusted input for nested validation error ([91582f7](https://github.com/tada5hi/validup/commit/91582f79b18f9bf8f11191f26fbe38467e923c84))

## [0.1.3](https://github.com/tada5hi/validup/compare/validup-v0.1.2...validup-v0.1.3) (2024-07-28)


### Features

* always run container items with non defined group ([f03cc9f](https://github.com/tada5hi/validup/commit/f03cc9fba3c4ef411dd1b8ceb1acd8631872e5d1))
* initial routup adapter implementation ([#31](https://github.com/tada5hi/validup/issues/31)) ([be6137f](https://github.com/tada5hi/validup/commit/be6137fa0ee200c872d0536b94ecf9b4c8583c25))

## [0.1.2](https://github.com/tada5hi/validup/compare/validup-v0.1.1...validup-v0.1.2) (2024-07-25)


### Features

* permit mounting container without path ([420933b](https://github.com/tada5hi/validup/commit/420933b87f14e18fb23c5008bd82ea835bb78afd))

## [0.1.1](https://github.com/tada5hi/validup/compare/validup-v0.1.0...validup-v0.1.1) (2024-07-24)


### Features

* introduce container oneOf and pathsToInclude option ([a4e9a10](https://github.com/tada5hi/validup/commit/a4e9a1045924a7946cd628d282099ec0b788b76f))

## 0.1.0 (2024-07-22)


### Features

* add path-property helpers ([7643b3b](https://github.com/tada5hi/validup/commit/7643b3be6d14e23890296bccc5052f0bc9308f05))
* add types for object path property ([#18](https://github.com/tada5hi/validup/issues/18)) ([308dd6f](https://github.com/tada5hi/validup/commit/308dd6f2a68e4d8f182ea56a122b5d2dd28aea03))
* add zod & validator adapter + cleanup code base ([97311e0](https://github.com/tada5hi/validup/commit/97311e0217ae9b8e920506f26a0feedf057ad6d9))
* better and simpler type/interface naming ([3859f36](https://github.com/tada5hi/validup/commit/3859f3693e4b8fa64c47cb193ee2879b94a69dfb))
* change attribute error path type to string ([4df739b](https://github.com/tada5hi/validup/commit/4df739bd8d750cf9dce6384238305787a1a434f9))
* change mount signature & initial README.md ([dbea40e](https://github.com/tada5hi/validup/commit/dbea40e17238ad12b7ffabeadb7c9f01065cfece))
* initialize project from source ([5affc1b](https://github.com/tada5hi/validup/commit/5affc1bcdb1053fabd2909ac1f04fcdd49bfd9ab))
* optimized relations lookup + added test suite ([d11f77b](https://github.com/tada5hi/validup/commit/d11f77b27c1aade1ab0f610f7c1f94b94aa19b3c))
* simplify mounting and executing validators ([b68a92f](https://github.com/tada5hi/validup/commit/b68a92fec598cd43c646908a13a3fd0e44c8310e))
* simplify mounting child validators ([dcbc689](https://github.com/tada5hi/validup/commit/dcbc6898cd00450e490d80a499cd12993abe646c))


### Bug Fixes

* adjusted function signatures ([bcb2eff](https://github.com/tada5hi/validup/commit/bcb2effd55714829d8f6f3a848dc9d2e7fede3e0))
* append path from parent container ([c9c07f1](https://github.com/tada5hi/validup/commit/c9c07f1f003a68799e0ac874f7dd3f47e72af039))
* appending child container values ([4eb7c8d](https://github.com/tada5hi/validup/commit/4eb7c8d13820d280186c26cabe902a287f0d2932))
* workflow for executing group(s) ([52b65ed](https://github.com/tada5hi/validup/commit/52b65ed5fe0139ea56f37f72e771930a0d9344b3))
