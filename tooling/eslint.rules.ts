export const prettierOptions = { printWidth: 120, singleQuote: true, useTabs: false, tabWidth: 2 };

const snakeStem = '+([a-z])*([a-z0-9])*(_+([a-z0-9]))';
const filenamePattern = `@(${snakeStem}|\\[${snakeStem}\\]|\\[...${snakeStem}\\]|\\[\\[...${snakeStem}\\]\\])`;

export const codeRules = {
  complexity: ['error', 15],
  'max-depth': ['error', 4],
  'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
  'import/no-cycle': 'error',
  'no-restricted-syntax': [
    'error',
    {
      selector: "VariableDeclaration[kind='let']",
      message: 'Use const and immutable transformations instead of let.',
    },
    { selector: "VariableDeclaration[kind='var']", message: 'Use const instead of var.' },
    {
      selector: 'ForStatement, ForInStatement, ForOfStatement',
      message: 'Use array or stream methods instead of loop statements.',
    },
    { selector: 'TSNonNullExpression', message: 'Narrow nullable values instead of asserting non-null.' },
    {
      selector: "ImportExpression[source.type!='Literal']",
      message: 'Use a literal import specifier so dependency boundaries can be checked.',
    },
    {
      selector: "CallExpression[callee.name='require'][arguments.0.type!='Literal']",
      message: 'Use a literal require specifier so dependency boundaries can be checked.',
    },
    { selector: 'CatchClause[param=null]', message: 'Inspect caught failures before using a fallback response.' },
    {
      selector: 'CallExpression[callee.property.name=/^(then|catch)$/]',
      message: 'Use async/await and try/catch instead of promise chains.',
    },
    {
      selector:
        "BinaryExpression[operator=/^[!=]==$/][left.property.name='message']:matches([left.object.name=/^(err|cause)$|error$/i], [left.object.property.name=/^(err|cause)$|error$/i]):matches([right.type='Identifier'][right.name!='undefined'], [right.type='MemberExpression'], [right.value=/./])",
      message: 'Classify errors with an error class or code, not by comparing message text.',
    },
    {
      selector:
        "CallExpression[callee.property.name='includes'][arguments.0.property.name='message']:matches([arguments.0.object.name=/^(err|cause)$|error$/i], [arguments.0.object.property.name=/^(err|cause)$|error$/i])",
      message: 'Classify errors with an error class or code, not by looking up message text.',
    },
    { selector: 'TSEnumDeclaration[const=true]', message: 'Use a string union instead of a const enum.' },
    { selector: 'PrivateIdentifier', message: 'Do not use private identifiers.' },
    { selector: 'TSImportType', message: 'Import a module instead of using an import type query.' },
    {
      selector: ':not(MethodDefinition, Property[method=true]) > FunctionExpression[generator=false]',
      message: 'Use an arrow function instead of a function expression.',
    },
    {
      selector: 'MethodDefinition[static=true] ThisExpression',
      message: 'Do not use this in a static method.',
    },
    { selector: "CallExpression[callee.name='parseFloat']", message: 'Use Number instead of parseFloat.' },
    {
      selector:
        "CallExpression[callee.name='parseInt']:not([arguments.1.value=2]):not([arguments.1.value=8]):not([arguments.1.value=16])",
      message: 'Call parseInt with a radix of 2, 8, or 16.',
    },
    {
      selector: "TSParameterProperty[accessibility='public'][readonly=true]",
      message: 'Do not use a public readonly parameter property.',
    },
    {
      selector: 'TSTypeAliasDeclaration > TSUnionType:has(> TSNullKeyword, > TSUndefinedKeyword)',
      message: 'Do not include null or undefined in the top-level union of a type alias.',
    },
  ],
  'one-var': ['error', 'never'],
  'no-object-constructor': 'error',
  'no-new-wrappers': 'error',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-octal': 'error',
  'new-parens': 'error',
  'default-case': 'error',
  'default-case-last': 'error',
  'no-implicit-coercion': ['error', { boolean: false, number: true, string: true }],
  'import/no-default-export': 'error',
  'check-file/filename-naming-convention': [
    'error',
    { '**/*.{ts,tsx,js,jsx,mjs,cjs}': filenamePattern },
    { ignoreMiddleExtensions: true },
  ],
  'jsdoc/require-jsdoc': [
    'error',
    {
      publicOnly: true,
      require: {
        ArrowFunctionExpression: true,
        ClassDeclaration: true,
        FunctionDeclaration: true,
        FunctionExpression: true,
      },
      contexts: ['ExportNamedDeclaration > TSInterfaceDeclaration'],
    },
  ],
  'jsdoc/no-types': 'error',
};

export const strictLintConfiguration = [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'array' }],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-base-to-string': 'error',
      '@typescript-eslint/no-deprecated': 'error',
      '@typescript-eslint/no-duplicate-type-constituents': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-misused-spread': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'error',
      '@typescript-eslint/no-unnecessary-type-conversion': 'error',
      '@typescript-eslint/no-unnecessary-type-parameters': 'error',
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/strict-boolean-expressions': ['error', { allowString: false, allowNumber: false }],
      '@typescript-eslint/unbound-method': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/restrict-plus-operands': [
        'error',
        {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
        },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowAny: false, allowNullish: false }],
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'no-public', overrides: { parameterProperties: 'off' } },
      ],
      '@typescript-eslint/no-extraneous-class': ['error', { allowConstructorOnly: true, allowWithDecorator: true }],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
          custom: { regex: '^[A-Za-z0-9_]+$', match: true },
        },
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        { selector: 'variable', format: ['camelCase'], leadingUnderscore: 'forbid', trailingUnderscore: 'forbid' },
        {
          selector: 'variable',
          modifiers: ['unused'],
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'variable',
          modifiers: ['const', 'global'],
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        { selector: 'function', format: ['camelCase'], leadingUnderscore: 'forbid', trailingUnderscore: 'forbid' },
        { selector: 'method', format: ['camelCase'], leadingUnderscore: 'forbid', trailingUnderscore: 'forbid' },
        { selector: 'objectLiteralMethod', format: null },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'forbid', trailingUnderscore: 'forbid' },
        {
          selector: 'parameter',
          modifiers: ['unused'],
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'classProperty',
          format: ['camelCase'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'classProperty',
          modifiers: ['static', 'readonly'],
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'objectLiteralProperty',
          format: null,
          filter: { regex: '^[A-Za-z_$][A-Za-z0-9_$]*$', match: false },
        },
        {
          selector: 'objectLiteralProperty',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        { selector: 'typeLike', format: ['PascalCase'], leadingUnderscore: 'forbid', trailingUnderscore: 'forbid' },
        {
          selector: 'typeParameter',
          format: ['PascalCase'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'enumMember',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': true, 'ts-nocheck': true, 'ts-check': false },
      ],
      'prettier/prettier': ['error', prettierOptions],
    },
  },
];
const inner = codeRules['no-restricted-syntax'];
export const frontendRules = {
  ...codeRules,
  'no-restricted-syntax': [
    'error',
    ...inner.slice(1),
    {
      selector: 'JSXOpeningElement[name.name=/^(p|h[1-6]|section|article|header|footer|main|nav|aside)$/]',
      message: 'Use div or span for layout and prose.',
    },
    { selector: "JSXAttribute[name.name='style']", message: 'Use Tailwind classes instead of inline styles.' },
    {
      selector: "JSXExpressionContainer > LogicalExpression[operator='&&']",
      message: 'Use a ternary for JSX conditionals.',
    },
    {
      selector: "JSXAttribute[name.name='className'][value.value=/(?:^|\\s)-?m(?:[trblxyse])?-/]",
      message: 'Use parent gap or padding instead of child margins.',
    },
    {
      selector:
        "JSXAttribute[name.name='className'][value.value=/(?:^|\\s)-?(?:gap(?:-[xy])?|[mp](?:[trblxyse])?)-(?:[13579]|[0-9]*[13579])(?:\\s|$)/]",
      message: 'Use even-numbered spacing increments.',
    },
  ],
};
