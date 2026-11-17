import { ESLint } from 'eslint';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { after, test } from 'node:test';

const env2 = process.env;
env2.TSESTREE_SINGLE_RUN = 'false';
const paths = {
  domain: 'src/domain/lint_policy_fixture.ts',
  ports: 'src/ports/lint_policy_fixture.ts',
  application: 'src/application/lint_policy_fixture.ts',
  primary: 'src/adapters/primary/web/lint_policy_fixture.ts',
  secondary: 'src/adapters/secondary/random/lint_policy_fixture.ts',
  otherSecondary: 'src/adapters/secondary/fixed/lint_policy_fixture.ts',
  composition: 'src/composition/lint_policy_fixture.ts',
  presentation: 'src/presentation/lint_policy_fixture.tsx',
  unknown: 'src/unclassified/lint_policy_fixture.ts',
  domainTest: 'src/domain/fixture.test.ts',
  domainSpec: 'src/domain/fixture.spec.ts',
  domainTsxTest: 'src/domain/view.test.tsx',
  domainJsTest: 'src/domain/fixture.test.js',
};
await Promise.all(
  Object.values(paths).map(async (path) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, 'export type Fixture = number;\n', { flag: 'wx' });
  }),
);
after(async () => {
  await Promise.all(Object.values(paths).map((path) => rm(path)));
});
const check = async ({ filePath, code, shouldFail, rule = 'boundaries/dependencies' }) => {
  const eslint = new ESLint();
  const [result] = await eslint.lintText(code, { filePath });
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
  const messages2 = result.messages;
  assert.equal(
    messages2.some((message) => message.ruleId === null),
    false,
    JSON.stringify(result.messages),
  );
  const messages3 = result.messages;
  assert.equal(
    messages3.some((message) => message.ruleId === rule),
    shouldFail,
    `${filePath}: ${code}`,
  );
  if (rule === 'boundaries/dependencies') {
    const messages4 = result.messages;
    assert.equal(
      messages4.some((message) => message.ruleId === 'boundaries/no-unknown-files'),
      false,
      JSON.stringify(result.messages),
    );
    const messages5 = result.messages;
    assert.equal(
      messages5.some((message) => message.ruleId === 'boundaries/no-unknown-dependencies'),
      false,
      JSON.stringify(result.messages),
    );
  }
};

test('domain cannot import application, ports, adapters or composition', async () => {
  await Promise.all(
    [
      '../application/lint_policy_fixture.ts',
      '../ports/lint_policy_fixture.ts',
      '../adapters/secondary/random/lint_policy_fixture.ts',
      '../composition/lint_policy_fixture.ts',
    ].map((target) => check({ filePath: paths.domain, code: `import '${target}';`, shouldFail: true })),
  );
  await check({ filePath: paths.domain, code: 'export const value = 1;', shouldFail: false });
});

test('ports may use domain but not application', async () => {
  await check({ filePath: paths.ports, code: "import '../domain/lint_policy_fixture.ts';", shouldFail: false });
  await check({ filePath: paths.ports, code: "import '../application/lint_policy_fixture.ts';", shouldFail: true });
});

test('application may use a port but not a concrete adapter', async () => {
  await check({ filePath: paths.application, code: "import '../ports/lint_policy_fixture.ts';", shouldFail: false });
  await check({ filePath: paths.application, code: "import '../domain/lint_policy_fixture.ts';", shouldFail: false });
  await check({
    filePath: paths.application,
    code: "import '../adapters/secondary/random/lint_policy_fixture.ts';",
    shouldFail: true,
  });
});

test('composition may connect application, ports and both adapter roles', async () => {
  await check({
    filePath: paths.composition,
    code: [
      '../application/lint_policy_fixture.ts',
      '../ports/lint_policy_fixture.ts',
      '../adapters/secondary/random/lint_policy_fixture.ts',
      '../adapters/primary/web/lint_policy_fixture.ts',
    ]
      .map((target) => `import '${target}';`)
      .join('\n'),
    shouldFail: false,
  });
});

test('primary adapters may call application but not secondary adapters', async () => {
  await check({
    filePath: paths.primary,
    code: "import '../../../application/lint_policy_fixture.ts';",
    shouldFail: false,
  });
  await check({
    filePath: paths.primary,
    code: "import '../../secondary/random/lint_policy_fixture.ts';",
    shouldFail: true,
  });
});

test('secondary adapters use ports, never application or independent adapters', async () => {
  await check({
    filePath: paths.secondary,
    code: "import '../../../ports/lint_policy_fixture.ts';",
    shouldFail: false,
  });
  await check({
    filePath: paths.secondary,
    code: "import '../../../application/lint_policy_fixture.ts';",
    shouldFail: true,
  });
  await check({
    filePath: paths.secondary,
    code: "import '../../primary/web/lint_policy_fixture.ts';",
    shouldFail: true,
  });
  await check({ filePath: paths.secondary, code: "import '../fixed/lint_policy_fixture.ts';", shouldFail: true });
});

test('presentation imports composition, not concrete adapters', async () => {
  await check({
    filePath: paths.presentation,
    code: "import '../composition/lint_policy_fixture.ts';",
    shouldFail: false,
  });
  await check({
    filePath: paths.presentation,
    code: "import '../adapters/secondary/random/lint_policy_fixture.ts';",
    shouldFail: true,
  });
});

test('type imports, reexports, dynamic imports and require cannot bypass boundaries', async () => {
  const target = '../adapters/secondary/random/lint_policy_fixture.ts';
  await Promise.all(
    [
      `import type { Fixture } from '${target}';`,
      `export type { Fixture } from '${target}';`,
      `export * from '${target}';`,
      `const dependency = import('${target}');`,
      `type Dependency = import('${target}').Fixture;`,
      `const dependency = require('${target}');`,
      `import dependency = require('${target}');`,
    ].map((code) => check({ filePath: paths.application, code, shouldFail: true })),
  );
});

test('core cannot import Node or framework libraries', async () => {
  await check({ filePath: paths.domain, code: "import 'node:fs';", shouldFail: true });
  await check({ filePath: paths.application, code: "import 'node:http';", shouldFail: true });
  await check({ filePath: paths.ports, code: "import 'typescript';", shouldFail: true });
  await check({ filePath: paths.secondary, code: "import 'node:crypto';", shouldFail: false });
});

test('unclassified source files are rejected', async () => {
  await check({
    filePath: paths.unknown,
    code: 'export const value = 1;',
    shouldFail: true,
    rule: 'boundaries/no-unknown-files',
  });
});

test('shared conventions are active in TypeScript', async () => {
  await Promise.all(
    [
      ['let value = 1;', 'no-restricted-syntax'],
      ['export const won = true;', 'policy/boolean-prefix'],
      ['export const join = (left: string, right: string): string => left + right;', 'policy/named-parameters'],
      ['declare const values: number[]; if (values.length) {}', 'policy/array-emptiness'],
      ['const values: number[] = []; values.push(1);', 'policy/immutable-arrays'],
      ['export const change = (value: { count: number }): void => { value.count = 1; };', 'policy/parameter-mutation'],
      ['export const value: any = 1;', '@typescript-eslint/no-explicit-any'],
      [
        'declare const value: unknown; export const name = value as string;',
        '@typescript-eslint/no-unsafe-type-assertion',
      ],
      ["JSON.parse('{}');", 'policy/validated-input'],
      ["throw new Error('Failure.');", 'policy/named-messages'],
    ].map(([code, rule]) => check({ filePath: paths.application, code, rule, shouldFail: true })),
  );
  await check({
    filePath: paths.application,
    code: 'export const hasWon = true;',
    rule: 'policy/boolean-prefix',
    shouldFail: false,
  });
});

test('product tests must be TypeScript .test.ts files', async () => {
  await check({
    filePath: paths.domainJsTest,
    code: 'export const value = 1;\n',
    rule: 'policy/typescript-tests',
    shouldFail: true,
  });
  await check({
    filePath: paths.domainSpec,
    code: 'export const value = 1;\n',
    rule: 'policy/typescript-tests',
    shouldFail: true,
  });
  await check({
    filePath: paths.domainTsxTest,
    code: 'export const value = 1;\n',
    rule: 'policy/typescript-tests',
    shouldFail: true,
  });
  await check({
    filePath: paths.domainTest,
    code: 'export const value = 1;\n',
    rule: 'policy/typescript-tests',
    shouldFail: false,
  });
  await check({
    filePath: 'tooling/tests/architecture.test.mjs',
    code: 'export const value = 1;\n',
    rule: 'policy/typescript-tests',
    shouldFail: false,
  });
});

test('errors are classified by class or code, not message text', async () => {
  await check({
    filePath: paths.application,
    code: "declare const error: Error; export const matched = error.message === 'nope';\n",
    rule: 'no-restricted-syntax',
    shouldFail: true,
  });
  await check({
    filePath: paths.application,
    code: 'declare const error: Error; const messages: string[] = []; export const matched = messages.includes(error.message);\n',
    rule: 'no-restricted-syntax',
    shouldFail: true,
  });
});

test('product code cannot import a colocated test, and same-adapter files can import each other', async () => {
  await check({
    filePath: paths.domain,
    code: 'import "./fixture.test.ts";\n',
    shouldFail: true,
  });
  await check({
    filePath: paths.secondary,
    code: 'import "./lint_policy_fixture.ts";\n',
    shouldFail: false,
  });
});

test('ambient effects stay in the layer that owns them', async () => {
  await check({
    filePath: paths.domain,
    code: 'export const now = Date.now();\n',
    rule: 'policy/ambient-effects',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: 'export const total = Math.abs(-1);\n',
    rule: 'policy/ambient-effects',
    shouldFail: false,
  });
  await check({
    filePath: paths.domain,
    code: 'export const roll = Math.random();\n',
    rule: 'policy/ambient-effects',
    shouldFail: true,
  });
  await check({
    filePath: paths.secondary,
    code: 'export const now = Date.now();\n',
    rule: 'policy/ambient-effects',
    shouldFail: false,
  });
  await check({
    filePath: paths.application,
    code: "export const load = (): Promise<Response> => fetch('/orders');\n",
    rule: 'policy/ambient-effects',
    shouldFail: true,
  });
  await check({
    filePath: paths.application,
    code: 'declare const orders: { load: () => Promise<string> }; export const load = (): Promise<string> => orders.load();\n',
    rule: 'policy/ambient-effects',
    shouldFail: false,
  });
  await check({
    filePath: paths.presentation,
    code: "export const token = localStorage.getItem('token');\n",
    rule: 'policy/ambient-effects',
    shouldFail: true,
  });
  await check({
    filePath: paths.presentation,
    code: 'export const read = ({ token }: { token: string }): string => token;\n',
    rule: 'policy/ambient-effects',
    shouldFail: false,
  });
});

test('process, loading, and browser globals stay at the edge', async () => {
  await check({
    filePath: paths.primary,
    code: 'export const port = process.env.PORT;\n',
    rule: 'policy/ambient-effects',
    shouldFail: true,
  });
  await check({
    filePath: paths.composition,
    code: 'export const port = process.env.PORT;\n',
    rule: 'policy/ambient-effects',
    shouldFail: false,
  });
  await check({
    filePath: paths.domain,
    code: "export const loaded = import('./lint_policy_fixture.ts');\n",
    rule: 'policy/ambient-effects',
    shouldFail: true,
  });
  await check({
    filePath: paths.primary,
    code: "export const loaded = import('./lint_policy_fixture.ts');\n",
    rule: 'policy/ambient-effects',
    shouldFail: false,
  });
  await check({
    filePath: paths.domain,
    code: "import './lint_policy_fixture.ts';\n",
    rule: 'policy/ambient-effects',
    shouldFail: true,
  });
  await check({
    filePath: paths.composition,
    code: "import './lint_policy_fixture.ts';\n",
    rule: 'policy/ambient-effects',
    shouldFail: false,
  });
  await check({
    filePath: paths.domain,
    code: "export const label = new Intl.NumberFormat('en').format(1);\n",
    rule: 'policy/ambient-effects',
    shouldFail: true,
  });
  await check({
    filePath: paths.presentation,
    code: "export const label = new Intl.NumberFormat('en').format(1);\n",
    rule: 'policy/ambient-effects',
    shouldFail: false,
  });
});

test('browser globals and type positions stay at the edge', async () => {
  await check({
    filePath: paths.domain,
    code: 'export const ran = crypto.randomUUID();\n',
    rule: 'policy/ambient-effects',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: 'export const place = ({ location }: { location: string }): string => location;\n',
    rule: 'policy/ambient-effects',
    shouldFail: false,
  });
  await check({
    filePath: paths.domain,
    code: "export const value = globalThis.fetch('/orders');\n",
    rule: 'policy/ambient-effects',
    shouldFail: true,
  });
  await check({
    filePath: paths.presentation,
    code: "export const isBrowser = typeof window !== 'undefined';\n",
    rule: 'policy/ambient-effects',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: 'export type Instant = Date;\n',
    rule: 'policy/ambient-effects',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: "export const run = new Function('return 1');\n",
    rule: 'policy/ambient-effects',
    shouldFail: true,
  });
});

test('the domain stays synchronous', async () => {
  await check({
    filePath: paths.domain,
    code: 'export const load = async (): Promise<number> => 1;\n',
    rule: 'policy/sync-domain',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: 'export type Saved = Promise<void>;\n',
    rule: 'policy/sync-domain',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: 'export function* values(): Generator<number> { yield 1; }\n',
    rule: 'policy/sync-domain',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: 'export const age = ({ now }: { now: number }): number => now;\n',
    rule: 'policy/sync-domain',
    shouldFail: false,
  });
  await check({
    filePath: paths.ports,
    code: 'export type Repository = { save: () => Promise<void> };\n',
    rule: 'policy/sync-domain',
    shouldFail: false,
  });
});

test('ports hold contracts rather than behavior', async () => {
  await check({
    filePath: paths.ports,
    code: 'export const parse = (value: string): string => value;\n',
    rule: 'policy/port-contracts',
    shouldFail: true,
  });
  await check({
    filePath: paths.ports,
    code: "export enum Status { Open = 'open' }\n",
    rule: 'policy/port-contracts',
    shouldFail: true,
  });
  await check({
    filePath: paths.ports,
    code: 'declare const refine: (check: (value: string) => boolean) => string;\nexport const schema = refine((value) => value.length > 0);\nexport type Repository = { save: (value: string) => void };\n',
    rule: 'policy/port-contracts',
    shouldFail: false,
  });
});

test('an application file exports one use case', async () => {
  await check({
    filePath: paths.application,
    code: 'export const place = ({ id }: { id: string }): string => id;\nexport const cancel = ({ id }: { id: string }): string => id;\n',
    rule: 'policy/use-case',
    shouldFail: true,
  });
  await check({
    filePath: paths.application,
    code: 'export const place = (id: string): string => id;\n',
    rule: 'policy/use-case',
    shouldFail: true,
  });
  await check({
    filePath: paths.application,
    code: 'const normalize = (value: string): string => value.trim();\nexport const place = ({ id }: { id: string }): string => normalize(id);\n',
    rule: 'policy/use-case',
    shouldFail: false,
  });
  await check({
    filePath: paths.application,
    code: 'export type PlaceOrder = { id: string };\n',
    rule: 'policy/use-case',
    shouldFail: false,
  });
});

test('the core names its own exports', async () => {
  await check({
    filePath: paths.domain,
    code: "export * from './lint_policy_fixture.ts';\n",
    rule: 'policy/direct-exports',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: 'export default 1;\n',
    rule: 'policy/direct-exports',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: 'const value = 1;\nexport { value };\n',
    rule: 'policy/direct-exports',
    shouldFail: false,
  });
});

test('the core throws domain error classes', async () => {
  await check({
    filePath: paths.domain,
    code: 'export class Order {}\n',
    rule: 'policy/core-errors',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: "export const fail = new Error('Failure.');\n",
    rule: 'policy/core-errors',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: "export enum Status { Open = 'open' }\n",
    rule: 'policy/core-errors',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: 'export namespace Orders { export type Id = string }\n',
    rule: 'policy/core-errors',
    shouldFail: true,
  });
  await check({
    filePath: paths.ports,
    code: 'export class OrderError extends Error {}\n',
    rule: 'policy/core-errors',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: 'export class OrderRejected extends Error {}\nexport const reject = (): OrderRejected => new OrderRejected();\n',
    rule: 'policy/core-errors',
    shouldFail: false,
  });
});

test('domain and port models are readonly', async () => {
  await check({
    filePath: paths.domain,
    code: 'export type Order = { id: string };\n',
    rule: 'policy/readonly-model',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: 'export type Order = { readonly id: string; readonly ids: string[] };\n',
    rule: 'policy/readonly-model',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: "export const pair: [string, number] = ['a', 1];\n",
    rule: 'policy/readonly-model',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: 'export type Flags<Key extends string> = { [KeyName in Key]: string };\n',
    rule: 'policy/readonly-model',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: 'export class OrderRejected extends Error { code: string; constructor(code: string) { super(); this.code = code; } }\n',
    rule: 'policy/readonly-model',
    shouldFail: true,
  });
  await check({
    filePath: paths.domain,
    code: "export type Order = { readonly id: string; readonly ids: readonly string[] };\nexport const pair: readonly [string, number] = ['a', 1];\nexport type Flags<Key extends string> = { readonly [KeyName in Key]: string };\nexport class OrderRejected extends Error { readonly code: string; constructor(code: string) { super(); this.code = code; } }\n",
    rule: 'policy/readonly-model',
    shouldFail: false,
  });
});

test('frontend rules reject inline styling and margin spacing', async () => {
  await check({
    filePath: paths.presentation,
    code: "export const view = <div style={{ color: 'red' }} />;",
    rule: 'no-restricted-syntax',
    shouldFail: true,
  });
  await check({
    filePath: paths.presentation,
    code: "export const view = <div className='mt-2' />;",
    rule: 'policy/static-tailwind',
    shouldFail: true,
  });
  await check({
    filePath: paths.presentation,
    code: "export const view = <div className='gap-2 p-4' />;",
    rule: 'policy/static-tailwind',
    shouldFail: false,
  });
});

test('google and nasa checks reject the added forms', async () => {
  await check({
    filePath: paths.application,
    code: 'export const value = (): number => { start: { break start; } return 1; };\n',
    rule: 'no-labels',
    shouldFail: true,
  });
  await check({
    filePath: paths.application,
    code: 'const walk = (value: number): number => (value === 0 ? value : walk(value - 1));\nexport const depth = walk(1);\n',
    rule: 'policy/no-recursion',
    shouldFail: true,
  });
  await check({
    filePath: paths.application,
    code: 'export const read = (): number => { while (true) { return 1; } };\n',
    rule: 'policy/bounded-loop',
    shouldFail: true,
  });
  await check({
    filePath: paths.application,
    code: 'const box = { inner: { value: 1 } };\nexport const value = box.inner.value;\n',
    rule: 'policy/single-dereference',
    shouldFail: true,
  });
  await check({
    filePath: paths.application,
    code: 'const box = { inner: { value: 1 } };\nconst inner = box.inner;\nexport const value = inner.value;\n',
    rule: 'policy/single-dereference',
    shouldFail: false,
  });
});
