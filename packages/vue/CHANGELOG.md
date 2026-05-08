# Changelog

## [0.2.0](https://github.com/tada5hi/validup/compare/vue-v0.1.0...vue-v0.2.0) (2026-05-08)


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
