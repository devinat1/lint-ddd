import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { eslintConfigSource, workflowSource } from '../manifest.mjs';

const execFileAsync = promisify(execFile);
const bin = fileURLToPath(new URL('../../bin/lint_ddd.mjs', import.meta.url));
const roots = [];

const createRoot = async (packageJson = { name: 'sample', version: '0.0.0' }) => {
  const root = await mkdtemp(join(tmpdir(), 'lint-ddd-'));
  roots.push(root);
  await writeFile(join(root, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);

  return root;
};

after(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

const run = async ({ cwd, args }) => {
  try {
    const result = await execFileAsync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });

    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const code = typeof error.code === 'number' ? error.code : 1;
    const stdout = typeof error.stdout === 'string' ? error.stdout : '';
    const stderr = typeof error.stderr === 'string' ? error.stderr : '';

    return { code, stdout, stderr };
  }
};

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

test('init writes a partial selection, dependencies, and no install', async () => {
  const root = await createRoot({
    name: 'sample',
    version: '0.0.0',
    devDependencies: { 'lint-ddd': 'file:../lint-ddd', left: '1.0.0' },
  });
  const result = await run({
    cwd: root,
    args: ['init', '--only', 'policy-conventions', '--on', 'policy/validated-input', '--off', 'policy/boolean-prefix'],
  });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stderr, /tsconfig\.eslint\.json is missing/);
  assert.deepEqual(await readJson(join(root, 'lint-ddd.config.json')), {
    groups: ['policy-conventions'],
    on: ['policy/validated-input'],
    off: ['policy/boolean-prefix'],
  });
  assert.equal(await readFile(join(root, 'eslint.config.mjs'), 'utf8'), eslintConfigSource);
  const packageJson = await readJson(join(root, 'package.json'));
  const devDependencies2 = packageJson.devDependencies;
  assert.equal(devDependencies2['lint-ddd'], 'file:../lint-ddd');
  const devDependencies3 = packageJson.devDependencies;
  assert.equal(devDependencies3.left, '1.0.0');
  const devDependencies4 = packageJson.devDependencies;
  assert.equal(typeof devDependencies4.eslint, 'string');
  const devDependencies5 = packageJson.devDependencies;
  assert.equal(typeof devDependencies5.typescript, 'string');
  await assert.rejects(access(join(root, 'node_modules')));
});

test('init keeps TypeScript 7 on the native compiler', async () => {
  const root = await createRoot({
    name: 'sample',
    version: '0.0.0',
    devDependencies: { typescript: '^7.0.2' },
  });
  const result = await run({ cwd: root, args: ['init', '--full'] });
  assert.equal(result.code, 0, result.stderr);
  const packageJson = await readJson(join(root, 'package.json'));
  const devDependencies7 = packageJson.devDependencies;
  assert.equal(devDependencies7.typescript, 'npm:@typescript/typescript6@^6.0.2');
  assert.equal(devDependencies7['@typescript/native'], 'npm:typescript@^7.0.2');
  const aliased = await createRoot({
    name: 'sample',
    version: '0.0.0',
    devDependencies: { typescript: 'npm:@typescript/typescript6@^6.0.2' },
  });
  const aliasResult = await run({ cwd: aliased, args: ['init', '--full'] });
  assert.equal(aliasResult.code, 0, aliasResult.stderr);
  const aliasPackage = await readJson(join(aliased, 'package.json'));
  const devDependencies8 = aliasPackage.devDependencies;
  assert.equal(devDependencies8.typescript, 'npm:@typescript/typescript6@^6.0.2');
  assert.equal(devDependencies8['@typescript/native'], undefined);
});

test('init --full and enable accept the nasa group and the added rules', async () => {
  const root = await createRoot();
  const full = await run({ cwd: root, args: ['init', '--full'] });
  assert.equal(full.code, 0, full.stderr);
  const selection = await readJson(join(root, 'lint-ddd.config.json'));
  const groups2 = selection.groups;
  assert.ok(groups2.includes('nasa'));
  assert.deepEqual(selection.on, []);
  assert.deepEqual(selection.off, []);
  assert.equal((await run({ cwd: root, args: ['enable', 'policy/single-dereference'] })).code, 0);
  assert.equal((await run({ cwd: root, args: ['enable', 'jsdoc/require-jsdoc'] })).code, 0);
  assert.equal((await run({ cwd: root, args: ['enable', 'policy/no-enum-boolean'] })).code, 0);
  const enabled = await readJson(join(root, 'lint-ddd.config.json'));
  assert.deepEqual(enabled.on, ['jsdoc/require-jsdoc', 'policy/single-dereference', 'policy/no-enum-boolean']);
  const packageJson = await readJson(join(root, 'package.json'));
  const devDependencies6 = packageJson.devDependencies;
  assert.equal(typeof devDependencies6['eslint-plugin-jsdoc'], 'string');
  const devDependencies7 = packageJson.devDependencies;
  assert.equal(typeof devDependencies7['eslint-plugin-check-file'], 'string');
  const unknown = await run({ cwd: root, args: ['enable', 'policy/not-a-rule'] });
  assert.equal(unknown.code, 1);
  assert.match(unknown.stderr, /Unknown group or rule/);
});

test('enable and disable update the manifest without dropping exceptions', async () => {
  const root = await createRoot();
  assert.equal(
    (await run({ cwd: root, args: ['init', '--only', 'policy-conventions', '--off', 'policy/boolean-prefix'] })).code,
    0,
  );
  assert.equal((await run({ cwd: root, args: ['enable', 'presentation'] })).code, 0);
  assert.equal((await run({ cwd: root, args: ['disable', 'policy-conventions'] })).code, 0);
  assert.equal((await run({ cwd: root, args: ['enable', 'policy/boolean-prefix'] })).code, 0);
  assert.equal((await run({ cwd: root, args: ['disable', 'policy/named-parameters'] })).code, 0);
  assert.deepEqual(await readJson(join(root, 'lint-ddd.config.json')), {
    groups: ['presentation'],
    on: ['policy/boolean-prefix'],
    off: ['policy/named-parameters'],
  });
});

test('init replaces an existing selection and still refuses a foreign config', async () => {
  const root = await createRoot();
  const first = await run({ cwd: root, args: ['init', '--only', 'codely'] });
  assert.equal(first.code, 0, first.stderr);
  const installed = await readJson(join(root, 'package.json'));
  const devDependencies8 = installed.devDependencies;
  delete devDependencies8.eslint;
  await writeFile(join(root, 'package.json'), `${JSON.stringify(installed, null, 2)}\n`);
  const unchanged = await readFile(join(root, 'lint-ddd.config.json'), 'utf8');
  const blocked = await run({ cwd: root, args: ['init'] });
  assert.equal(blocked.code, 1);
  assert.match(blocked.stderr, /no terminal/);
  assert.equal(await readFile(join(root, 'lint-ddd.config.json'), 'utf8'), unchanged);
  const second = await run({ cwd: root, args: ['init', '--only', 'boundaries'] });
  assert.equal(second.code, 0, second.stderr);
  assert.deepEqual(await readJson(join(root, 'lint-ddd.config.json')), {
    groups: ['boundaries'],
    on: [],
    off: [],
  });
  assert.equal(await readFile(join(root, 'eslint.config.mjs'), 'utf8'), eslintConfigSource);
  const devDependencies9 = (await readJson(join(root, 'package.json'))).devDependencies;
  assert.equal(typeof devDependencies9.eslint, 'string');
});

test('init refuses a foreign config and keeps an owned one', async () => {
  const foreign = await createRoot();
  await writeFile(join(foreign, 'eslint.config.mjs'), 'export default [];\n');
  const packageBefore = await readFile(join(foreign, 'package.json'), 'utf8');
  const refused = await run({ cwd: foreign, args: ['init', '--only', 'codely'] });
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /eslint\.config\.mjs already exists/);
  await assert.rejects(access(join(foreign, 'lint-ddd.config.json')));
  assert.equal(await readFile(join(foreign, 'package.json'), 'utf8'), packageBefore);

  const owned = await createRoot();
  assert.equal((await run({ cwd: owned, args: ['init', '--only', 'codely'] })).code, 0);
  await writeFile(join(owned, 'eslint.config.mjs'), 'export default [];\n');
  const ownedConfig = await readFile(join(owned, 'lint-ddd.config.json'), 'utf8');
  const ownedPackage = await readFile(join(owned, 'package.json'), 'utf8');
  const ownedRefusal = await run({ cwd: owned, args: ['init', '--only', 'boundaries'] });
  assert.equal(ownedRefusal.code, 1);
  assert.match(ownedRefusal.stderr, /eslint\.config\.mjs already exists/);
  assert.equal(await readFile(join(owned, 'lint-ddd.config.json'), 'utf8'), ownedConfig);
  assert.equal(await readFile(join(owned, 'package.json'), 'utf8'), ownedPackage);

  const local = await createRoot();
  assert.equal((await run({ cwd: local, args: ['init', '--only', 'codely'] })).code, 0);
  const localConfig = `import { defineConfig } from "lint-ddd";

export default [{ ignores: ["lint-failures/**"] }, ...defineConfig()];
`;
  await writeFile(join(local, 'eslint.config.mjs'), localConfig);
  const kept = await run({ cwd: local, args: ['init', '--only', 'boundaries'] });
  assert.equal(kept.code, 0, kept.stderr);
  assert.equal(await readFile(join(local, 'eslint.config.mjs'), 'utf8'), localConfig);
  assert.deepEqual(await readJson(join(local, 'lint-ddd.config.json')), {
    groups: ['boundaries'],
    on: [],
    off: [],
  });

  const silent = await createRoot();
  const noFlags = await run({ cwd: silent, args: ['init'] });
  assert.equal(noFlags.code, 1);
  assert.match(noFlags.stderr, /no terminal/);
  await assert.rejects(access(join(silent, 'lint-ddd.config.json')));

  const empty = await mkdtemp(join(tmpdir(), 'lint-ddd-'));
  roots.push(empty);
  const missing = await run({ cwd: empty, args: ['init', '--full'] });
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /package\.json is missing/);

  const conflict = await createRoot();
  const combined = await run({ cwd: conflict, args: ['init', '--full', '--only', 'codely'] });
  assert.equal(combined.code, 1);
  await assert.rejects(access(join(conflict, 'lint-ddd.config.json')));
});

test('init ignores the line feed left by a carriage-return submit', async () => {
  const root = await createRoot();
  await writeFile(join(root, 'eslint.config.mjs'), eslintConfigSource);
  await writeFile(join(root, 'lint-ddd.config.json'), '{"groups":["codely"],"on":[],"off":[]}\n');
  const [output, errors] = await new Promise((resolve, reject) => {
    const probe = spawn(
      'python3',
      [
        '-c',
        [
          'import os, pty, select, sys, time, subprocess',
          'root, node, bin = sys.argv[1:]',
          'master, slave = pty.openpty()',
          "proc = subprocess.Popen(['/bin/zsh', '-f'], stdin=slave, stdout=slave, stderr=slave, cwd=root, start_new_session=True)",
          'os.close(slave)',
          'time.sleep(0.3)',
          "os.write(master, f\"'{node}' '{bin}' init\\r\\n\".encode())",
          "data = b''",
          'deadline = time.time() + 2',
          "while time.time() < deadline and proc.poll() is None and b'space selects' not in data:",
          '    ready, _, _ = select.select([master], [], [], 0.1)',
          "    data += os.read(master, 8192) if ready else b''",
          "if proc.poll() is not None or b'[?1049l' in data:",
          '    sys.stdout.buffer.write(data)',
          '    raise SystemExit(0)',
          'time.sleep(0.25)',
          "os.write(master, b'\\r')",
          "sys.stdout.buffer.write(b'STILL_OPEN\\n')",
          'deadline = time.time() + 2',
          "while time.time() < deadline and proc.poll() is None and b'Groups. codely' not in data:",
          '    ready, _, _ = select.select([master], [], [], 0.1)',
          "    data += os.read(master, 8192) if ready else b''",
          'proc.kill() if proc.poll() is None else None',
          'sys.stdout.buffer.write(data)',
        ].join('\n'),
        root,
        process.execPath,
        bin,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const stdout = [];
    const stderr = [];
    const stdout2 = probe.stdout;
    stdout2.on('data', (chunk) => stdout.push(chunk));
    const stderr2 = probe.stderr;
    stderr2.on('data', (chunk) => stderr.push(chunk));
    probe.on('error', reject);
    probe.on('close', () => resolve([Buffer.concat(stdout).toString('utf8'), Buffer.concat(stderr).toString('utf8')]));
  });
  assert.equal(errors, '');
  assert.match(output, /STILL_OPEN/);
  assert.match(output, /space selects/);
  assert.match(output, /Groups\. codely/);
  assert.deepEqual(await readJson(join(root, 'lint-ddd.config.json')), { groups: ['codely'], on: [], off: [] });
});

test('published files run inside node_modules', async () => {
  const build = fileURLToPath(new URL('../build.mjs', import.meta.url));
  await execFileAsync(process.execPath, [build]);
  const packageRoot = fileURLToPath(new URL('../../node_modules/.lint-ddd-publish/', import.meta.url));
  roots.push(packageRoot);
  await rm(packageRoot, { recursive: true, force: true });
  await mkdir(packageRoot, { recursive: true });
  await cp(fileURLToPath(new URL('../../dist', import.meta.url)), join(packageRoot, 'dist'), { recursive: true });
  await cp(fileURLToPath(new URL('../../package.json', import.meta.url)), join(packageRoot, 'package.json'));
  const project = await createRoot();
  const result = await execFileAsync(
    process.execPath,
    [join(packageRoot, 'dist', 'bin', 'lint_ddd.mjs'), 'init', '--only', 'boundaries'],
    { cwd: project, encoding: 'utf8' },
  );
  assert.match(result.stderr, /tsconfig\.eslint\.json is missing/);
  assert.deepEqual(JSON.parse(await readFile(join(project, 'lint-ddd.config.json'), 'utf8')).groups, ['boundaries']);

  const configUrl = pathToFileURL(join(packageRoot, 'dist', 'tooling', 'eslint.config.mjs')).href;
  await execFileAsync(process.execPath, [
    '--input-type=module',
    '--eval',
    `const loaded = await import(${JSON.stringify(configUrl)}); if (typeof loaded.defineConfig !== "function") process.exit(1);`,
  ]);
});

test('ci writes the workflow and refuses a foreign one', async () => {
  const root = await createRoot();
  const packageBefore = await readFile(join(root, 'package.json'), 'utf8');
  assert.equal((await run({ cwd: root, args: ['ci'] })).code, 0);
  assert.equal(await readFile(join(root, '.github', 'workflows', 'lint.yml'), 'utf8'), workflowSource);
  assert.equal((await run({ cwd: root, args: ['ci'] })).code, 0);
  assert.equal(await readFile(join(root, '.github', 'workflows', 'lint.yml'), 'utf8'), workflowSource);
  assert.equal(await readFile(join(root, 'package.json'), 'utf8'), packageBefore);
  await assert.rejects(access(join(root, 'lint-ddd.config.json')));

  const foreign = await createRoot();
  const foreignWorkflow = 'name: other\n';
  await mkdir(join(foreign, '.github', 'workflows'), { recursive: true });
  await writeFile(join(foreign, '.github', 'workflows', 'lint.yml'), foreignWorkflow);
  const refused = await run({ cwd: foreign, args: ['ci'] });
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /lint\.yml already exists/);
  assert.equal(await readFile(join(foreign, '.github', 'workflows', 'lint.yml'), 'utf8'), foreignWorkflow);

  const flagged = await run({ cwd: root, args: ['ci', '--full'] });
  assert.equal(flagged.code, 1);
  assert.match(flagged.stderr, /does not take arguments/);
});

test('dry-run lints a trial selection without writing it', async () => {
  const root = await createRoot();
  const saved = '{"groups":["codely"],"on":[],"off":[]}\n';
  await writeFile(join(root, 'lint-ddd.config.json'), saved);
  await writeFile(join(root, 'sample.js'), 'let value = 1;\n');
  const failed = await run({ cwd: root, args: ['dry-run', '--on', 'no-restricted-syntax'] });
  assert.equal(failed.code, 1, failed.stderr);
  assert.match(failed.stdout, /no-restricted-syntax/);
  assert.equal(await readFile(join(root, 'lint-ddd.config.json'), 'utf8'), saved);
  await assert.rejects(access(join(root, '.github', 'workflows', 'lint.yml')));
  await assert.rejects(access(join(root, 'eslint.config.mjs')));

  const missing = await run({ cwd: root, args: ['dry-run'] });
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /needs --full, --only, --on, or --off/);
  const named = await run({ cwd: root, args: ['dry-run', 'boundaries'] });
  assert.equal(named.code, 1);
  assert.match(named.stderr, /not names/);
  assert.equal(await readFile(join(root, 'lint-ddd.config.json'), 'utf8'), saved);
});

test('enable requires an existing manifest', async () => {
  const root = await createRoot();
  const result = await run({ cwd: root, args: ['enable', 'boundaries'] });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /missing/);
});
