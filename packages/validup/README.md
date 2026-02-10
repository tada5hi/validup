# Validup 🛡️

[![main](https://github.com/tada5hi/validup/actions/workflows/main.yml/badge.svg)](https://github.com/tada5hi/validup/actions/workflows/main.yml)
[![CodeQL](https://github.com/tada5hi/validup/actions/workflows/codeql.yml/badge.svg)](https://github.com/tada5hi/validup/actions/workflows/codeql.yml)
[![Known Vulnerabilities](https://snyk.io/test/github/tada5hi/validup/badge.svg)](https://snyk.io/test/github/tada5hi/validup)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)

This is a library to create domain specific validators.

> 🚧 **Work in Progress**
>
> Validup is currently under active development and is not yet ready for production.

**Table of Contents**

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Concepts](#concepts)
    - [Errors](#errors)
    - [Mounting](#mounting)
    - [Nesting](#nesting)
    - [Groups](#groups)
- [API](#api)
- [License](#license)

## Features

- ✨ Simple API
- 🌐 Works in any (Node.Js, browser & workers) environment
- ❌ Dedicated errors for different scenarios
- 🚀 Nesting of Validators and Containers
- 🎭 Easy integrate third-party validators/sanitizers (zod, validator.js, ...)

## Installation

```bash
npm install validup --save
```

## Usage

A validator is an (async) function to validate (and modify) any piece of information.
Each validator receives a [context](#validatorcontext) containing the actual value, key (aka path), ...

```typescript
import {
    Validator, 
    ValidatorContext,
    ValidupValidatorError
} from 'validup';

const isString: Validator = (ctx: ValidatorContext) => {
    if (typeof ctx.value !== 'string') {
        throw new ValidupValidatorError({
            message: `The validator for ${ctx.path} expected a string as input.`,
            expected: 'string',
            path: ctx.path
        })
    }
    
    return ctx.value;
}
```

This validator can than be mounted on a specific path to a container. A mount path can either be 
a regular string or a glob pattern.

```typescript
import { Container } from 'validup';

const container = new Container();
container.mount('foo', isString);

const output = await container.run({
    foo: 'bar',
    bar: 'baz'
});

console.log(output);
// { foo: 'bar' }
```

> [!NOTE]
> The container run method throws an error if an error occurred during the execution of a validator.

## Concepts

### Errors

During the execution of a [validator](#validator), a ValidupError can be thrown.
An error can contain multiple issues.

When the execution of a Container fails, the container will always throw a ValidupError.
Unknown errors will be converted.

### Mounting

> 🚧 **Work in Progress**
> ...

### Nesting

> 🚧 **Work in Progress**
>

### Groups
When mounting a validator or container, it is possible to restrict the execution to explicit execution groups.

```ts
import { Container } from 'validup';

const container = new Container();
container.mount('id', { group: ['update', 'delete'] }, isString);
container.mount('name', { group: ['craete', 'update', 'delete']}, isString);

const output = await container.run(
    {
        id: 'xxx',
        name: 'foo'
    }, 
    {
        group: 'create'
    }
 );

console.log(output);
// { name: 'foo' }
```

In this example the output will only contain the value of the key name.
The reason for this is, that the id key is not registered for the create group.

> [!NOTE]
> To always execute a mounted container/validator do not specify
> any group or use the `*` group.


## API

### Validator
```ts
type Validator = (ctx: ValidatorContext) => Promise<unknown> | unknown;
```

### ValidatorContext
```ts
type ValidatorContext = {
    /**
     * The expanded mount path in the current container.
     */
    key: string,

    /**
     * The global mount path of the parent container.
     */
    path: PropertyKey[],

    /**
     * The actual value, which should be validated.
     */
    value: unknown,

    /**
     * The input data of the current container.
     */
    data: Record<string, any>,

    /**
     * The group name for which the validator is executed.
     */
    group?: string
};
```

## License

Made with 💚

Published under [MIT License](./LICENSE).
