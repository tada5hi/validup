import config from '@tada5hi/eslint-config';

export default [
    ...await config(),
    { ignores: ['**/dist/**', '**/*.d.ts'] },
    {
        languageOptions: { globals: { NodeJS: true } },
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-use-before-define': 'off',
        },
    },
];
