import eslint from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import unicornPlugin from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        ignores: [
            '.cache/**',
            '.git/**',
            'dist/**',
            'docs/**',
            'misc/**',
            'node_modules/**',
            'temp/**'
        ],
        plugins: {
            import: importPlugin,
            unicorn: unicornPlugin,
        },
        rules: {
            // TypeScript rules
            '@typescript-eslint/explicit-function-return-type': ['error', {
                allowExpressions: true
            }],
            '@typescript-eslint/no-base-to-string': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-inferrable-types': ['error', {
                ignoreParameters: true
            }],
            '@typescript-eslint/no-misused-promises': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-enum-comparison': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            // TODO: Remove this once we have a better way to handle unbound methods
            '@typescript-eslint/no-unbound-method': 'off',
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }],
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/only-throw-error': 'off',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/restrict-template-expressions': 'off',
            '@typescript-eslint/return-await': ['error', 'always'],
            '@typescript-eslint/typedef': ['error', {
                parameter: true,
                propertyDeclaration: true
            }],

            // Import rules
            'import/extensions': ['error', 'ignorePackages'],
            'import/no-extraneous-dependencies': 'error',
            'import/no-unresolved': 'off',
            'import/no-useless-path-segments': 'error',
            'import/order': ['error', {
                alphabetize: {
                    caseInsensitive: true,
                    order: 'asc'
                },
                groups: [
                    ['builtin', 'external', 'object', 'type'],
                    ['internal', 'parent', 'sibling', 'index']
                ],
                'newlines-between': 'always'
            }],

            // Core ESLint rules
            'no-return-await': 'off',
            'no-unused-vars': 'off',
            'prefer-const': 'off',
            'quotes': ['error', 'single', {
                allowTemplateLiterals: true
            }],
            'sort-imports': ['error', {
                allowSeparatedGroups: true,
                ignoreCase: true,
                ignoreDeclarationSort: true,
                ignoreMemberSort: false,
                memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single']
            }],

            // Unicorn rules
            'unicorn/prefer-node-protocol': 'error'
        },
        languageOptions: {
            parserOptions: {
                project: './tsconfig.json'
            }
        }
    },
    {
        files: ['**/*.test.ts', 'tests/**/*.ts'],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.test.json'
            }
        },
        rules: {
            '@typescript-eslint/unbound-method': 'off',
            'quotes': 'off'
        }
    }
); 