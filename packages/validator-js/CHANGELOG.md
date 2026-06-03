# Changelog

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
