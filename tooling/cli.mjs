import { existsSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { stdin, stdout } from 'node:process';
import { emitKeypressEvents } from 'node:readline';
import { fileURLToPath } from 'node:url';

import {
  changeNames,
  checklistStep,
  groups,
  selectionFromFlags,
  selectionFromTree,
  treeFromSelection,
} from './catalog.ts';
import {
  eslintConfigSource,
  installWorkflow,
  isOurEslintConfig,
  readSelection,
  usesOurConfig,
  writeSelection,
} from './manifest.mjs';

const readJson = (filePath) => {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown failure.';
    throw new Error(`Could not read ${filePath}. ${message.endsWith('.') ? message : `${message}.`}`);
  }
};

const ourPackage = readJson(fileURLToPath(new URL('../package.json', import.meta.url)));
if (typeof ourPackage.version !== 'string') {
  throw new Error('lint-ddd package version is missing.');
}

function parseArgv(argv) {
  const [command, ...tokens] = argv;
  if (command === undefined) {
    throw new Error('Usage: lint-ddd init, enable, disable, ci, or dry-run.');
  }
  const parsed = tokens.reduce(
    (state, token, index, all) => {
      if (state.shouldSkip) {
        return { ...state, shouldSkip: false };
      }
      if (token === '--full') {
        return { ...state, isFull: true };
      }
      if (token === '--only' || token === '--on' || token === '--off') {
        const splitList = (value) =>
          value
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item !== '');
        const value = all[index + 1];
        if (value === undefined || value.startsWith('--')) {
          throw new Error(`${token} needs a comma-separated list.`);
        }
        const key = token.slice('--'.length);

        return { ...state, [key]: [...state[key], ...splitList(value)], shouldSkip: true };
      }
      if (token.startsWith('--')) {
        throw new Error(`Unknown flag ${token}.`);
      }

      return { ...state, positionals: [...state.positionals, token] };
    },
    { isFull: false, only: [], on: [], off: [], positionals: [], shouldSkip: false },
  );

  return { command, ...parsed };
}

function hasSelectionFlags(parsed) {
  const only3 = parsed.only;
  const on3 = parsed.on;
  const off3 = parsed.off;

  return parsed.isFull || only3.length !== 0 || on3.length !== 0 || off3.length !== 0;
}

function updateSelection({ names, isEnable }) {
  if (names.length === 0) {
    throw new Error('Name at least one group or rule.');
  }
  const rootPath = process.cwd();
  writeSelection(rootPath, changeNames({ selection: readSelection(rootPath), names, isEnable }));
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fitLine({ line, width }) {
  return line.length > width ? line.slice(0, width) : line;
}

function pointsAt({ state, group, rule }) {
  const cursor2 = state.cursor;
  const cursor3 = state.cursor;

  return cursor2.group === group && cursor3.rule === rule;
}

function groupMark({ state, index }) {
  const rulesOn2 = state.rulesOn;
  const rules = rulesOn2[index] ?? [];
  if (rules.length === 0) {
    const emptyOn2 = state.emptyOn;

    return emptyOn2.includes(index) ? 'x' : ' ';
  }
  if (rules.every((isOn) => isOn)) {
    return 'x';
  }
  if (rules.some((isOn) => isOn)) {
    return '-';
  }

  return ' ';
}

function childLine({ state, group, rule, ruleIndex, ruleCount, width }) {
  const branch = ruleIndex === ruleCount - 1 ? '└─' : '├─';
  const prefix = pointsAt({ state, group, rule: ruleIndex }) ? '    > ' : '      ';
  const rulesOn3 = state.rulesOn;
  const entry = rulesOn3[group];
  const mark = entry?.[ruleIndex] === true ? 'x' : ' ';

  return fitLine({ line: `${prefix}${branch} [${mark}] ${rule}`, width });
}

function groupBlock({ state, group, index, nameWidth, width }) {
  const pointer = pointsAt({ state, group: index, rule: null }) ? '>' : ' ';
  const mark = groupMark({ state, index });
  const isOpen = state.expanded === index;
  const rules2 = group.rules;
  const glyph = rules2.length === 0 ? '  ' : ` ${isOpen ? '▾' : '▸'}`;
  const name2 = group.name;
  const line = fitLine({
    line: `${pointer} [${mark}] ${name2.padEnd(nameWidth)}${glyph}  ${group.detail}`,
    width,
  });
  const rules3 = group.rules;
  const children = isOpen
    ? rules3.map((rule, ruleIndex) =>
        childLine({ state, group: index, rule, ruleIndex, ruleCount: rules3.length, width }),
      )
    : [];

  return [line, ...children];
}

function treeLines({ prompt, state }) {
  const screenRows = stdout.rows > 0 ? stdout.rows : 24;
  const screenColumns = stdout.columns > 0 ? stdout.columns : 80;
  const width = Math.max(20, screenColumns - 1);
  const drawn = groups.reduce(
    (acc, group, index) => {
      const nameWidth = Math.max(
        ...groups.map((entry) => {
          const name3 = entry.name;

          return name3.length;
        }),
      );
      const block = groupBlock({ state, group, index, nameWidth, width });
      const local = block.findIndex((_, row) => pointsAt({ state, group: index, rule: row === 0 ? null : row - 1 }));
      const rows2 = acc.rows;

      return {
        rows: [...acc.rows, ...block],
        cursorRow: local === -1 ? acc.cursorRow : rows2.length + local,
      };
    },
    { rows: [], cursorRow: 0 },
  );
  const { rows, cursorRow } = drawn;
  const room = Math.max(1, screenRows - 3);
  const size = Math.min(rows.length, room);
  const preferred = cursorRow - Math.floor((size - 1) / 2);
  const start = Math.min(Math.max(0, preferred), Math.max(0, rows.length - size));

  return [
    fitLine({ line: prompt, width }),
    ...rows.slice(start, start + size),
    'arrows move, left/right expand, space selects, enter confirms',
  ];
}

function paint({ prompt, session }) {
  stdout.write(`\x1b[H\x1b[J${treeLines({ prompt, state: session.state }).join('\n')}`);
}

function finish({ session, line }) {
  if (session.onKeypress !== undefined) {
    stdin.off('keypress', session.onKeypress);
    session.onKeypress = undefined;
  }
  if (session.isRaw) {
    stdin.setRawMode(false);
    session.isRaw = false;
  }
  stdin.pause();
  writeSync(stdout.fd, '\x1b[?25h\x1b[?1049l');
  if (line !== undefined) {
    writeSync(stdout.fd, `${line}\n`);
  }
}

function keyName(key) {
  if (key === undefined) {
    return '';
  }
  if (key.ctrl === true && key.name === 'c') {
    return 'cancel';
  }
  if (key.name === 'space' || key.sequence === ' ') {
    return 'space';
  }
  if (key.name === 'return') {
    return 'return';
  }
  if (key.name === 'up' || key.name === 'down' || key.name === 'left' || key.name === 'right') {
    return key.name;
  }

  return '';
}

function handleKey({ key, session, prompt, resolve, reject }) {
  try {
    const name = keyName(key);
    if (name === 'return' && Date.now() - session.openedAt < 200) {
      return;
    }
    if (name === 'cancel') {
      finish({ session });
      process.exitCode = 130;

      return;
    }
    const next = checklistStep({ name, state: session.state });
    session.state = next.state;
    if (!next.isDone) {
      if (next.shouldDraw) {
        paint({ prompt, session });
      }

      return;
    }
    const groups2 = selectionFromTree({ state: session.state, catalog: groups }).groups;
    const summary = groups2.join(', ');
    finish({ session, line: `${prompt} ${summary === '' ? '(none)' : summary}` });
    resolve(session.state);
  } catch (error) {
    finish({ session });
    reject(error);
  }
}

function ask({ prompt, state }) {
  return new Promise((resolve, reject) => {
    const session = { state, onKeypress: undefined, isRaw: false, openedAt: Date.now() };
    session.onKeypress = (_char, key) => {
      handleKey({ key, session, prompt, resolve, reject });
    };
    try {
      emitKeypressEvents(stdin);
      stdin.setRawMode(true);
      session.isRaw = true;
      stdin.resume();
      stdout.write('\x1b[?1049h\x1b[?25l');
      paint({ prompt, session });
      stdin.on('keypress', session.onKeypress);
    } catch (error) {
      finish({ session });
      reject(error);
    }
  });
}

async function promptSelection({ selection }) {
  return selectionFromTree({
    state: await ask({ prompt: 'Groups.', state: treeFromSelection({ selection, catalog: groups }) }),
    catalog: groups,
  });
}

async function chooseSelection({ parsed, current }) {
  const only2 = parsed.only;
  const on2 = parsed.on;
  const off2 = parsed.off;
  const hasFlags = parsed.isFull || only2.length !== 0 || on2.length !== 0 || off2.length !== 0;
  if (hasFlags) {
    return selectionFromFlags({ isFull: parsed.isFull, only: parsed.only, on: parsed.on, off: parsed.off });
  }
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error('Pass --full or --only when there is no terminal.');
  }

  return promptSelection({ selection: current });
}

function rangeOf(name) {
  const dependencies2 = ourPackage.dependencies;
  const peerDependencies2 = ourPackage.peerDependencies;
  const devDependencies2 = ourPackage.devDependencies;
  const range = dependencies2?.[name] ?? peerDependencies2?.[name] ?? devDependencies2?.[name];
  if (typeof range !== 'string') {
    throw new Error(`Missing dependency range for ${name}.`);
  }

  return range;
}

function withDevDependencies(packageManifest) {
  const dependencyNames = [
    'eslint',
    'typescript',
    'eslint-config-codely',
    'eslint-plugin-boundaries',
    'eslint-plugin-check-file',
    'eslint-plugin-jsdoc',
    'eslint-import-resolver-typescript',
    '@typescript-eslint/utils',
  ];
  const devDependencies = isRecord(packageManifest.devDependencies) ? packageManifest.devDependencies : {};
  const current = devDependencies['lint-ddd'];
  const keepsLocal = typeof current === 'string' && (current.startsWith('file:') || current.startsWith('link:'));
  const added = Object.fromEntries(dependencyNames.map((name) => [name, rangeOf(name)]));

  return {
    ...packageManifest,
    devDependencies: {
      ...devDependencies,
      ...added,
      'lint-ddd': keepsLocal ? current : `^${ourPackage.version}`,
    },
  };
}

async function init(parsed) {
  const rootPath = process.cwd();
  const packagePath = join(rootPath, 'package.json');
  if (!existsSync(packagePath)) {
    throw new Error('package.json is missing.');
  }
  const packageManifest = readJson(packagePath);
  if (!isRecord(packageManifest)) {
    throw new Error('package.json must be an object.');
  }
  const eslintPath = join(rootPath, 'eslint.config.mjs');
  const eslintSource = existsSync(eslintPath) ? readFileSync(eslintPath, 'utf8') : undefined;
  if (eslintSource !== undefined && !usesOurConfig(eslintSource)) {
    throw new Error('eslint.config.mjs already exists.');
  }
  const configPath = join(rootPath, 'lint-ddd.config.json');
  const current = existsSync(configPath) ? readSelection(rootPath) : { groups: [], on: [], off: [] };
  const selection = await chooseSelection({ parsed, current });
  const nextPackage = withDevDependencies(packageManifest);
  writeSelection(rootPath, selection);
  if (eslintSource === undefined || isOurEslintConfig(eslintSource)) {
    writeFileSync(eslintPath, eslintConfigSource);
  }
  writeFileSync(packagePath, `${JSON.stringify(nextPackage, null, 2)}\n`);
  if (!existsSync(join(rootPath, 'tsconfig.eslint.json'))) {
    console.error('warning: tsconfig.eslint.json is missing. The strict-types group needs that file.');
  }
}

function installCi(parsed) {
  const positionals2 = parsed.positionals;
  if (positionals2.length !== 0 || hasSelectionFlags(parsed)) {
    throw new Error('ci does not take arguments.');
  }
  installWorkflow(process.cwd());
}

async function dryRun(parsed) {
  const positionals3 = parsed.positionals;
  if (positionals3.length !== 0) {
    throw new Error('dry-run takes --full, --only, --on, or --off, not names.');
  }
  if (!hasSelectionFlags(parsed)) {
    throw new Error('dry-run needs --full, --only, --on, or --off.');
  }
  const selection = selectionFromFlags({
    isFull: parsed.isFull,
    only: parsed.only,
    on: parsed.on,
    off: parsed.off,
  });
  const { ESLint } = await import('eslint');
  const { defineConfig } = await import('./eslint.config.mjs');
  const rootPath = process.cwd();
  // ponytail: skips eslint.config.mjs. A hand-added ignore there is not part of this run.
  const engine = new ESLint({
    cwd: rootPath,
    overrideConfigFile: true,
    overrideConfig: defineConfig(rootPath, selection),
  });
  const results = await engine.lintFiles(['.']);
  const formatter = await engine.loadFormatter('stylish');
  const text = await formatter.format(results);
  if (text !== '') {
    const stdout2 = process.stdout;
    stdout2.write(text);
  }

  return results.some((result) => result.errorCount > 0);
}

function setExitCode(code) {
  process.exitCode = code;
}

async function main() {
  const argv2 = process.argv;
  const parsed = parseArgv(argv2.slice(2));
  if (parsed.command === 'init') {
    const positionals4 = parsed.positionals;
    if (positionals4.length !== 0) {
      throw new Error('init does not take positional arguments.');
    }
    await init(parsed);

    return;
  }
  if (parsed.command === 'ci') {
    installCi(parsed);

    return;
  }
  if (parsed.command === 'dry-run') {
    if (await dryRun(parsed)) {
      setExitCode(1);
    }

    return;
  }
  if (parsed.command !== 'enable' && parsed.command !== 'disable') {
    throw new Error(`Unknown command ${parsed.command}.`);
  }
  const only4 = parsed.only;
  const on4 = parsed.on;
  const off4 = parsed.off;
  if (parsed.isFull || only4.length !== 0 || on4.length !== 0 || off4.length !== 0) {
    throw new Error('enable and disable take group or rule names, not flags.');
  }
  updateSelection({ names: parsed.positionals, isEnable: parsed.command === 'enable' });
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown failure.';
  console.error(message.endsWith('.') ? message : `${message}.`);
  process.exitCode = 1;
}
