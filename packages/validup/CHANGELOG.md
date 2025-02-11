# Changelog

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
