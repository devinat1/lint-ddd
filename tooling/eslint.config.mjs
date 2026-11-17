import eslintConfigCodely from 'eslint-config-codely';
import boundaries from 'eslint-plugin-boundaries';
import checkFilePlugin from 'eslint-plugin-check-file';
import importPlugin from 'eslint-plugin-import-x';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import prettierPlugin from 'eslint-plugin-prettier';
import typescriptEslint from 'typescript-eslint';

import { isRuleActive, ruleIds } from './catalog.ts';
import { codeRules, frontendRules, prettierOptions, strictLintConfiguration } from './eslint.rules.ts';
import { readSelection } from './manifest.mjs';
import { policyPlugin } from './policy_plugin.ts';

const configuredRules = (selection, specs) => {
  const rules = Object.fromEntries(
    specs.flatMap(([ruleId, value]) => {
      const off2 = selection.off;
      if (off2.includes(ruleId)) {
        return [[ruleId, 'off']];
      }
      if (isRuleActive({ selection, ruleId })) {
        return [[ruleId, value]];
      }

      return [];
    }),
  );

  return Object.keys(rules).length === 0 ? undefined : rules;
};

const ruleIsUsed = (selection, ruleId) => {
  const off3 = selection.off;

  return isRuleActive({ selection, ruleId }) || off3.includes(ruleId);
};

/**
 *
 */
export const typeAwarePolicies = new Set([
  'policy/boolean-prefix',
  'policy/named-parameters',
  'policy/array-emptiness',
  'policy/immutable-arrays',
  'policy/parameter-mutation',
  'policy/optional-nullable',
  'policy/validated-input',
  'policy/used-react-props',
  'policy/checked-return',
  'policy/no-enum-boolean',
]);

/**
 *
 */
export const usesTypeChecker = (selection) =>
  ruleIds.some(
    (ruleId) =>
      isRuleActive({ selection, ruleId }) &&
      (ruleId.startsWith('@typescript-eslint/') || typeAwarePolicies.has(ruleId)),
  );

/**
 *
 */
export const typeCheckerLanguage = ({ rootPath, providesParser }) => ({
  parserOptions: {
    projectService: false,
    project: ['./tsconfig.eslint.json'],
    tsconfigRootDir: rootPath,
  },
  ...(providesParser ? {} : { parser: typescriptEslint.parser }),
});

/**
 *
 */
export const hostPlugins = (selection) => {
  const plugins = {};
  const groups2 = selection.groups;
  if (!groups2.includes('codely')) {
    if (ruleIsUsed(selection, 'import/no-cycle') || ruleIsUsed(selection, 'import/no-default-export')) {
      plugins.import = importPlugin;
    }
    if (ruleIsUsed(selection, 'prettier/prettier')) {
      plugins.prettier = prettierPlugin;
    }
    if (
      ruleIsUsed(selection, 'check-file/filename-naming-convention') ||
      ruleIsUsed(selection, 'check-file/folder-naming-convention')
    ) {
      plugins['check-file'] = checkFilePlugin;
    }
  }
  if (ruleIsUsed(selection, 'jsdoc/require-jsdoc') || ruleIsUsed(selection, 'jsdoc/no-types')) {
    plugins.jsdoc = jsdocPlugin;
  }

  return Object.keys(plugins).length === 0 ? undefined : plugins;
};

/**
 *
 */
export const typescriptBlock = (selection) => {
  const groups3 = selection.groups;
  if (groups3.includes('codely')) {
    return undefined;
  }

  return {
    files: ['**/*.{ts,tsx,mts,cts}'],
    plugins: { '@typescript-eslint': typescriptEslint.plugin },
    languageOptions: { parser: typescriptEslint.parser },
  };
};

/**
 *
 */
export const pushCodeStyle = ({ blocks, selection, rootPath }) => {
  const codeStyleRules = { ...(configuredRules(selection, Object.entries(codeRules)) ?? {}) };
  const groups6 = selection.groups;
  const groups7 = selection.groups;
  if (groups6.includes('codely') && groups7.includes('code-style')) {
    const folderNaming = ['error', { '**/*': '+([a-zA-Z0-9\\[\\]\\(\\)\\._])' }];
    codeStyleRules['check-file/folder-naming-convention'] = folderNaming;
  }
  if (Object.keys(codeStyleRules).length !== 0) {
    blocks.push({ rules: codeStyleRules });
  }
  if (ruleIsUsed(selection, 'import/no-cycle')) {
    blocks.push({
      settings: {
        'import-x/extensions': ['.ts', '.tsx', '.cts', '.mts', '.js', '.jsx', '.cjs', '.mjs'],
        'import-x/parsers': {
          '@typescript-eslint/parser': ['.ts', '.tsx', '.cts', '.mts'],
        },
        'import-x/resolver': { typescript: { project: `${rootPath}/tsconfig.eslint.json` } },
      },
    });
  }
};

/**
 *
 */
export const pushStrictTypes = ({ blocks, selection, rootPath, strictRules }) => {
  const hasActiveStrictRule = Object.keys(strictRules).some((ruleId) => isRuleActive({ selection, ruleId }));
  const selectedStrictRules = configuredRules(selection, Object.entries(strictRules));
  if (selectedStrictRules !== undefined) {
    const groups8 = selection.groups;
    blocks.push({
      files: ['**/*.{ts,tsx}'],
      ...(hasActiveStrictRule
        ? {
            languageOptions: typeCheckerLanguage({
              rootPath,
              providesParser: groups8.includes('codely'),
            }),
          }
        : {}),
      rules: selectedStrictRules,
    });
  }
  if (usesTypeChecker(selection) && !hasActiveStrictRule) {
    const groups9 = selection.groups;
    blocks.push({
      files: ['**/*.{ts,tsx}'],
      languageOptions: typeCheckerLanguage({ rootPath, providesParser: groups9.includes('codely') }),
    });
  }
};

const baseBlocks = ({ selection, rootPath }) => {
  const entry = strictLintConfiguration[0];
  const strictRules = entry.rules;
  const blocks = [];
  const groups5 = selection.groups;
  if (groups5.includes('codely')) {
    const full2 = eslintConfigCodely.full;
    blocks.push(...full2.filter((configuration) => configuration.ignores === undefined));
  }
  blocks.push({ ignores: ['node_modules/**', '.codegraph/**', 'dist/**'] });
  const plugins = hostPlugins(selection);
  if (plugins !== undefined) {
    blocks.push({ plugins });
  }
  const typescript = typescriptBlock(selection);
  if (typescript !== undefined) {
    blocks.push(typescript);
  }
  pushCodeStyle({ blocks, selection, rootPath });
  pushStrictTypes({ blocks, selection, rootPath, strictRules });

  return blocks;
};

/**
 *
 */
export const magicNumbers = [
  'error',
  {
    ignore: [-1, 0, 1],
    ignoreArrayIndexes: true,
    ignoreEnums: true,
    ignoreNumericLiteralTypes: true,
    ignoreTypeIndexes: true,
    ignoreReadonlyClassProperties: true,
    enforceConst: true,
    detectObjects: true,
  },
];

/**
 *
 */
export const jsxSyntax = (selection) => {
  const codeSyntax = codeRules['no-restricted-syntax'];
  const norestrictedsyntax = frontendRules['no-restricted-syntax'];
  const jsxSyntaxSelectors = norestrictedsyntax.slice(codeSyntax.length);
  const jsxOnlySyntax = ['error', ...jsxSyntaxSelectors];
  const groups4 = selection.groups;
  const off4 = selection.off;
  if (!groups4.includes('presentation') || off4.includes('no-restricted-syntax')) {
    return undefined;
  }
  if (isRuleActive({ selection, ruleId: 'no-restricted-syntax' })) {
    return frontendRules['no-restricted-syntax'];
  }

  return jsxOnlySyntax;
};

/**
 *
 */
export const layerPolicySpecs = [
  {
    files: ['src/{domain,ports,application,adapters,composition,presentation}/**/*.{ts,tsx}'],
    specs: [['policy/ambient-effects', 'error']],
  },
  { files: ['src/domain/**/*.ts'], specs: [['policy/sync-domain', 'error']] },
  { files: ['src/ports/**/*.ts'], specs: [['policy/port-contracts', 'error']] },
  { files: ['src/application/**/*.ts'], specs: [['policy/use-case', 'error']] },
  { files: ['src/{domain,ports,application}/**/*.ts'], specs: [['policy/direct-exports', 'error']] },
  { files: ['src/{domain,ports,application}/**/*.ts'], specs: [['policy/core-errors', 'error']] },
  { files: ['src/{domain,ports}/**/*.ts'], specs: [['policy/readonly-model', 'error']] },
];

/**
 *
 */
export const pushLayerPolicies = ({ blocks, selection }) => {
  layerPolicySpecs.forEach(({ files, specs }) => {
    const rules = configuredRules(selection, specs);
    if (rules !== undefined) {
      const productTests = ['**/*.{test,spec}.{ts,tsx}'];
      blocks.push({ files, ignores: productTests, rules });
    }
  });
};

/**
 *
 */
export const pushSourcePolicies = ({ blocks, selection }) => {
  const conventionRules = configuredRules(selection, [
    ['policy/boolean-prefix', 'error'],
    ['policy/named-parameters', 'error'],
    ['policy/array-emptiness', 'error'],
    ['policy/immutable-arrays', 'error'],
    ['policy/parameter-mutation', 'error'],
    ['no-param-reassign', ['error', { props: false }]],
  ]);
  if (conventionRules !== undefined) {
    const authoredTypescript = ['{src,tests,tooling}/**/*.{ts,tsx}'];
    blocks.push({ files: authoredTypescript, rules: conventionRules });
  }
  const validationRules = configuredRules(selection, [
    ['policy/named-messages', 'error'],
    ['policy/validated-input', 'error'],
    ['@typescript-eslint/no-magic-numbers', magicNumbers],
  ]);
  if (validationRules !== undefined) {
    blocks.push({ files: ['src/**/*.{ts,tsx}'], rules: validationRules });
  }
  const nullableRules = configuredRules(selection, [['policy/optional-nullable', 'error']]);
  if (nullableRules !== undefined) {
    blocks.push({ files: ['src/{domain,ports}/**/*.ts'], rules: nullableRules });
  }
  const testRules = configuredRules(selection, [['policy/typescript-tests', 'error']]);
  if (testRules !== undefined) {
    blocks.push({ files: ['{src,tests}/**/*.{ts,tsx,js,jsx,mjs,cjs}'], rules: testRules });
  }
};

const policyBlocks = (selection) => {
  const usesPolicy = ruleIds.some(
    (ruleId) =>
      ruleIsUsed(selection, ruleId) &&
      (ruleId.startsWith('policy/') ||
        ruleId === 'no-param-reassign' ||
        ruleId === '@typescript-eslint/no-magic-numbers'),
  );
  if (!usesPolicy) {
    return [];
  }
  const commentRules = configuredRules(selection, [['policy/comment-and-log', 'error']]);
  const blocks = [
    {
      plugins: { policy: policyPlugin },
      ...(commentRules === undefined ? {} : { rules: commentRules }),
    },
  ];
  pushSourcePolicies({ blocks, selection });
  const jsxRules = { ...(configuredRules(selection, [['policy/static-tailwind', 'error']]) ?? {}) };
  const syntax = jsxSyntax(selection);
  if (syntax !== undefined) {
    jsxRules['no-restricted-syntax'] = syntax;
  }
  if (Object.keys(jsxRules).length !== 0) {
    blocks.push({ files: ['**/*.{tsx,jsx}'], rules: jsxRules });
  }
  const reactPropRules = configuredRules(selection, [['policy/used-react-props', 'error']]);
  if (reactPropRules !== undefined) {
    blocks.push({ files: ['src/presentation/**/*.tsx'], rules: reactPropRules });
  }
  pushLayerPolicies({ blocks, selection });

  return blocks;
};

/**
 *
 */
export const boundaryElements = [
  { type: 'domain', pattern: 'src/domain', partialMatch: false },
  { type: 'ports', pattern: 'src/ports', partialMatch: false },
  { type: 'application', pattern: 'src/application', partialMatch: false },
  { type: 'primary', pattern: 'src/adapters/primary/*', partialMatch: false },
  { type: 'secondary', pattern: 'src/adapters/secondary/*', partialMatch: false },
  { type: 'composition', pattern: 'src/composition', partialMatch: false },
  { type: 'presentation', pattern: 'src/presentation', partialMatch: false },
  { type: 'test', pattern: 'tests', partialMatch: false },
  { type: 'tooling', pattern: 'tooling', partialMatch: false },
];

/**
 *
 */
export const boundaryDependencies = {
  domain: ['domain'],
  ports: ['domain', 'ports'],
  application: ['domain', 'ports', 'application'],
  primary: ['application', 'ports', 'domain', 'composition'],
  secondary: ['ports', 'domain'],
  composition: ['application', 'ports', 'domain', 'primary', 'secondary', 'composition'],
  presentation: ['presentation', 'composition', 'domain'],
  test: ['*'],
  tooling: ['*'],
};

/**
 *
 */
export const externalDependencies = {
  domain: ['zod'],
  ports: ['zod'],
  application: ['zod'],
  primary: ['zod', 'node:http'],
  secondary: ['zod', 'node:crypto'],
  composition: ['zod'],
  presentation: ['react', 'react-dom', 'react/jsx-runtime', 'next', 'next/link', 'next/navigation'],
};

/**
 *
 */
export const boundaryFiles = [
  { category: 'test', pattern: '**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}', exclusive: true },
  { category: 'test', pattern: 'tests/**', exclusive: true },
  { category: 'tooling', pattern: 'tooling/**', exclusive: true },
  { category: 'tooling', pattern: 'bin/lint_ddd.mjs', exclusive: true },
  { category: 'tooling', pattern: '*.config.mjs', exclusive: true },
];

/**
 *
 */
export const selectRole = (role) => [{ element: { type: role } }, { file: { categories: [role] } }];

/**
 *
 */
export const boundaryPolicies = () => [
  {
    dependency: { relationship: { to: 'internal' } },
    allow: { to: { module: { origin: 'local' } } },
  },
  ...Object.entries(boundaryDependencies).map(([role, allowed]) => ({
    from: { element: { type: role } },
    allow: { to: { element: { type: allowed } } },
  })),
  ...Object.entries(externalDependencies).map(([role, allowed]) => ({
    from: { element: { type: role } },
    allow: { to: { module: { origin: ['external', 'core'], source: allowed } } },
  })),
  {
    from: { module: { origin: 'local' } },
    disallow: { to: { file: { categories: ['test', 'tooling'] } } },
  },
  ...['test', 'tooling'].map((role) => ({
    from: selectRole(role),
    allow: { to: { module: { origin: ['local', 'external', 'core'] } } },
  })),
];

const boundaryBlocks = ({ selection, rootPath }) => {
  const rules = configuredRules(selection, [
    ['boundaries/no-unknown-files', 'error'],
    ['boundaries/no-unknown-dependencies', 'error'],
    ['boundaries/no-ignored-dependencies', 'error'],
    [
      'boundaries/dependencies',
      [
        'error',
        {
          default: 'disallow',
          checkAllOrigins: true,
          checkUnknownLocals: true,
          checkInternals: true,
          policies: boundaryPolicies(),
        },
      ],
    ],
  ]);
  if (rules === undefined) {
    return [];
  }

  return [
    {
      files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
      plugins: { boundaries },
      settings: {
        'boundaries/root-path': rootPath,
        'boundaries/ignore': ['dist/**', '/dist/**', '.codegraph/**', '/.codegraph/**'],
        'boundaries/elements': boundaryElements,
        'boundaries/files': boundaryFiles,
        'boundaries/dependency-nodes': ['import', 'export', 'require', 'dynamic-import'],
        'boundaries/additional-dependency-nodes': [
          { selector: 'TSImportType > Literal', kind: 'type', name: 'type-import' },
          { selector: 'TSExternalModuleReference > Literal', kind: 'value', name: 'import-equals' },
        ],
        'import/resolver': { typescript: { project: `${rootPath}/tsconfig.eslint.json` } },
      },
      rules,
    },
  ];
};

const styleOverrides = (selection) => {
  const blocks = [];
  if (isRuleActive({ selection, ruleId: 'prettier/prettier' })) {
    blocks.push({ files: ['**/*.{js,jsx,mjs,cjs}'], rules: { 'prettier/prettier': ['error', prettierOptions] } });
  }
  if (isRuleActive({ selection, ruleId: 'import/no-default-export' })) {
    blocks.push({
      files: ['eslint.config.{js,mjs,cjs,ts,mts,cts}', '**/eslint.config.{js,mjs,cjs,ts,mts,cts}'],
      rules: { 'import/no-default-export': 'off' },
    });
  }
  if (isRuleActive({ selection, ruleId: '@typescript-eslint/ban-ts-comment' })) {
    blocks.push({
      files: ['**/*.test.ts'],
      rules: {
        '@typescript-eslint/ban-ts-comment': [
          'error',
          {
            'ts-ignore': true,
            'ts-expect-error': 'allow-with-description',
            'ts-nocheck': true,
            'ts-check': false,
          },
        ],
      },
    });
  }

  return blocks;
};

const nasaBlocks = (selection) => {
  const astRules = configuredRules(selection, [
    ['no-labels', 'error'],
    ['policy/no-recursion', 'error'],
    ['policy/bounded-loop', 'error'],
    ['policy/smallest-scope', 'error'],
    ['policy/single-dereference', 'error'],
  ]);
  const checked = configuredRules(selection, [['policy/checked-return', 'error']]);
  const enumRules = configuredRules(selection, [['policy/no-enum-boolean', 'error']]);
  const blocks = [];
  if (astRules !== undefined) {
    blocks.push({ files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'], rules: astRules });
  }
  if (checked !== undefined) {
    blocks.push({ files: ['**/*.{ts,tsx}'], rules: checked });
  }
  if (enumRules !== undefined) {
    blocks.push({
      files: ['**/*.{ts,tsx}'],
      ignores: ['src/{domain,ports,application}/**'],
      rules: enumRules,
    });
  }

  return blocks;
};

/**
 *
 */
export const defineConfig = (rootPath = process.cwd(), selection = readSelection(rootPath)) => [
  ...baseBlocks({ selection, rootPath }),
  ...styleOverrides(selection),
  ...policyBlocks(selection),
  ...nasaBlocks(selection),
  ...boundaryBlocks({ selection, rootPath }),
];
