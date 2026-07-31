# Changelog

## [1.0.0](https://github.com/tada5hi/validup/compare/validator-js-v0.2.3...validator-js-v1.0.0) (2026-07-31)


### Bug Fixes

* **deps:** bump pathtrace to ^2.2.3 to stop losing array values in output ([#442](https://github.com/tada5hi/validup/issues/442)) ([756571f](https://github.com/tada5hi/validup/commit/756571fafe32241e99393b17e2ffcd6bc9473686))
* **deps:** declare pathtrace directly in zod and validator-js ([42b3de1](https://github.com/tada5hi/validup/commit/42b3de164e17c1d44239387f52e077d0bd03328d))


### Dependencies

* The following workspace dependencies were updated
  * peerDependencies
    * validup bumped from ^0.5.1 to ^1.0.0

## [0.2.3](https://github.com/tada5hi/validup/compare/validator-js-v0.2.2...validator-js-v0.2.3) (2026-06-04)


### Dependencies

* The following workspace dependencies were updated
  * peerDependencies
    * validup bumped from ^0.5.0 to ^0.5.1

## [0.2.2](https://github.com/tada5hi/validup/compare/validator-js-v0.2.1...validator-js-v0.2.2) (2026-06-03)


### Dependencies

* The following workspace dependencies were updated
  * peerDependencies
    * validup bumped from ^0.4.1 to ^0.5.0

## [0.2.1](https://github.com/tada5hi/validup/compare/validator-js-v0.2.0...validator-js-v0.2.1) (2026-06-03)


### Dependencies

* The following workspace dependencies were updated
  * peerDependencies
    * validup bumped from ^0.4.0 to ^0.4.1

## [0.2.0](https://github.com/tada5hi/validup/compare/validator-js-v0.1.0...validator-js-v0.2.0) (2026-05-29)


### ⚠ BREAKING CHANGES

* every read/write of `issue.params`, every `defineIssueItem` / `defineIssueGroup` / `createValidupError` call that names the structured payload field, every adapter option labelled `params`, and every declaration-merging block on `IssueParamsByCode` must be updated to use `data`.

### Code Refactoring

* rename Issue.params → Issue.data ([0097c1a](https://github.com/tada5hi/validup/commit/0097c1aba5f142840e2b846e066564d3bcc55433))


### Dependencies

* The following workspace dependencies were updated
  * peerDependencies
    * validup bumped from ^0.3.0 to ^0.4.0
