# Changelog

## [0.2.5](https://github.com/tada5hi/validup/compare/zod-v0.2.4...zod-v0.2.5) (2026-05-08)


### Features

* add VitePress docs site and relicense to Apache-2.0 ([6b8e601](https://github.com/tada5hi/validup/commit/6b8e6017cae573e1290c971b6e699b97461fd0eb))
* add zod & validator adapter + cleanup code base ([97311e0](https://github.com/tada5hi/validup/commit/97311e0217ae9b8e920506f26a0feedf057ad6d9))
* better and simpler type/interface naming ([3859f36](https://github.com/tada5hi/validup/commit/3859f3693e4b8fa64c47cb193ee2879b94a69dfb))
* change attribute error path type to string ([4df739b](https://github.com/tada5hi/validup/commit/4df739bd8d750cf9dce6384238305787a1a434f9))
* compile-time output typing (improvements plan item 11) ([#362](https://github.com/tada5hi/validup/issues/362)) ([fd6b610](https://github.com/tada5hi/validup/commit/fd6b61095fecfd9ec243d5dc7a462d29402a0efa))
* ship improvements plan items 4-10, 12-13 + ebec + Standard Schema ([#359](https://github.com/tada5hi/validup/issues/359)) ([d2f0c04](https://github.com/tada5hi/validup/commit/d2f0c042fe557ba192eb6d34ac6067f78c3bed67))
* simplify mounting and executing validators ([b68a92f](https://github.com/tada5hi/validup/commit/b68a92fec598cd43c646908a13a3fd0e44c8310e))
* simplify mounting child validators ([dcbc689](https://github.com/tada5hi/validup/commit/dcbc6898cd00450e490d80a499cd12993abe646c))


### Bug Fixes

* set path for zod errors ([7fe88f4](https://github.com/tada5hi/validup/commit/7fe88f49c51141a5a33463bd6d7ae0f373b2102e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.2.2 to ^0.3.0

## [0.2.4](https://github.com/tada5hi/validup/compare/adapter-zod-v0.2.3...adapter-zod-v0.2.4) (2026-02-17)


### Features

* container safe-parse method ([#327](https://github.com/tada5hi/validup/issues/327)) ([c4f0a13](https://github.com/tada5hi/validup/commit/c4f0a13bec376242fe2c702a4e090267b93bbe41))


### Bug Fixes

* use ZodRawIssue instead of ZodCustomIssue ([8822210](https://github.com/tada5hi/validup/commit/8822210257448092bce48c2e39f31e6260ef3c1d))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.2.1 to ^0.2.2

## [0.2.3](https://github.com/tada5hi/validup/compare/adapter-zod-v0.2.2...adapter-zod-v0.2.3) (2026-02-16)


### Bug Fixes

* typing for building zod issues ([7f1b12a](https://github.com/tada5hi/validup/commit/7f1b12a10cc00eadcefc0dba79d54fe9072bc3a5))

## [0.2.2](https://github.com/tada5hi/validup/compare/adapter-zod-v0.2.1...adapter-zod-v0.2.2) (2026-02-16)


### Features

* transform validup error to zod issues ([ba77647](https://github.com/tada5hi/validup/commit/ba776470bd689c42d2a436feabc058a05a00516f))

## [0.2.1](https://github.com/tada5hi/validup/compare/adapter-zod-v0.2.0...adapter-zod-v0.2.1) (2026-02-10)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.2.0 to ^0.2.1

## [0.2.0](https://github.com/tada5hi/validup/compare/adapter-zod-v0.1.12...adapter-zod-v0.2.0) (2026-02-10)


### ⚠ BREAKING CHANGES

* API Changed

### Features

* issue mechanism & path refactoring ([#311](https://github.com/tada5hi/validup/issues/311)) ([7b26a1f](https://github.com/tada5hi/validup/commit/7b26a1f3465e47d680fbef2f29aba3b3cffe6c81))


### Bug Fixes

* group issues if child is container or more than one item ([85cc68a](https://github.com/tada5hi/validup/commit/85cc68ae382d9362b3180b1d94845fad4764984d))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.1.10 to ^0.2.0

## [0.1.12](https://github.com/tada5hi/validup/compare/adapter-zod-v0.1.11...adapter-zod-v0.1.12) (2025-12-08)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.1.9 to ^0.1.10

## [0.1.11](https://github.com/tada5hi/validup/compare/adapter-zod-v0.1.10...adapter-zod-v0.1.11) (2025-07-16)


### Bug Fixes

* error issue path access ([ea7e9a0](https://github.com/tada5hi/validup/commit/ea7e9a06b639defce4a1a5cac9131acfcbe18233))

## [0.1.10](https://github.com/tada5hi/validup/compare/adapter-zod-v0.1.9...adapter-zod-v0.1.10) (2025-07-16)


### Bug Fixes

* **deps:** bump zod to v4.0.0 ([01fe0be](https://github.com/tada5hi/validup/commit/01fe0be9d9686ca71c3809857e93db65e8a3a22a))

## [0.1.9](https://github.com/tada5hi/validup/compare/adapter-zod-v0.1.8...adapter-zod-v0.1.9) (2025-02-10)


### Bug Fixes

* use child error paths if parent mount path is empty ([8db0d3b](https://github.com/tada5hi/validup/commit/8db0d3b92fdf2587dd961236531eb0b6e20cea36))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.1.8 to ^0.1.9

## [0.1.8](https://github.com/tada5hi/validup/compare/adapter-zod-v0.1.7...adapter-zod-v0.1.8) (2024-11-06)


### Features

* add zod create fn support ([f19c0f0](https://github.com/tada5hi/validup/commit/f19c0f0da09f637c7921346dcf492d3a952b7822))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.1.7 to ^0.1.8

## [0.1.7](https://github.com/tada5hi/validup/compare/adapter-zod-v0.1.6...adapter-zod-v0.1.7) (2024-09-16)


### Bug Fixes

* pathing (path + pathAbsolute) for adapters ([ddb46fc](https://github.com/tada5hi/validup/commit/ddb46fcb931d42579744650bc46a4f968b175a46))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.1.6 to ^0.1.7

## [0.1.6](https://github.com/tada5hi/validup/compare/adapter-zod-v0.1.5...adapter-zod-v0.1.6) (2024-09-02)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.1.5 to ^0.1.6

## [0.1.5](https://github.com/tada5hi/validup/compare/adapter-zod-v0.1.4...adapter-zod-v0.1.5) (2024-08-17)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.1.4 to ^0.1.5

## [0.1.4](https://github.com/tada5hi/validup/compare/adapter-zod-v0.1.3...adapter-zod-v0.1.4) (2024-08-06)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.1.3 to ^0.1.4

## [0.1.3](https://github.com/tada5hi/validup/compare/adapter-zod-v0.1.2...adapter-zod-v0.1.3) (2024-07-28)


### Miscellaneous Chores

* **adapter-zod:** Synchronize main versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.1.2 to ^0.1.3

## [0.1.2](https://github.com/tada5hi/validup/compare/adapter-zod-v0.1.1...adapter-zod-v0.1.2) (2024-07-25)


### Miscellaneous Chores

* **adapter-zod:** Synchronize main versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.1.1 to ^0.1.2

## [0.1.1](https://github.com/tada5hi/validup/compare/adapter-zod-v0.1.0...adapter-zod-v0.1.1) (2024-07-24)


### Features

* introduce container oneOf and pathsToInclude option ([a4e9a10](https://github.com/tada5hi/validup/commit/a4e9a1045924a7946cd628d282099ec0b788b76f))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.1.0 to ^0.1.1

## 0.1.0 (2024-07-22)


### Bug Fixes

* append path from parent container ([c9c07f1](https://github.com/tada5hi/validup/commit/c9c07f1f003a68799e0ac874f7dd3f47e72af039))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * validup bumped from ^0.0.0 to ^0.1.0
