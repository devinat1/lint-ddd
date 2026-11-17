import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  checklistStep,
  disableName,
  enableName,
  fullSelection,
  groupNames,
  groups,
  isRuleActive,
  selectionFromFlags,
  selectionFromTree,
  treeFromSelection,
} from '../catalog.ts';
import { conventionRules } from '../convention_rules.ts';
import { defineConfig } from '../eslint.config.mjs';
import { codeRules, frontendRules, strictLintConfiguration } from '../eslint.rules.ts';
import { hexagonalRules } from '../hexagonal_rules.ts';
import { nasaRules } from '../nasa_rules.ts';
import { presentationRules } from '../presentation_rules.ts';
import { validationRules } from '../validation_rules.ts';

test('catalog lists the authored rules', () => {
  const rulesFor = (name) => groups.find((group) => group.name === name)?.rules;
  const prefixed = (rules) => Object.keys(rules).map((name) => `policy/${name}`);
  assert.deepEqual(groupNames, [
    'codely',
    'boundaries',
    'strict-types',
    'code-style',
    'nasa',
    'policy-conventions',
    'validation',
    'presentation',
  ]);
  assert.deepEqual(rulesFor('codely'), []);
  assert.deepEqual(rulesFor('code-style'), Object.keys(codeRules));
  const entry = strictLintConfiguration[0];
  assert.deepEqual(rulesFor('strict-types'), Object.keys(entry.rules));
  assert.deepEqual(rulesFor('nasa'), ['no-labels', ...prefixed(nasaRules)]);
  assert.deepEqual(
    new Set(rulesFor('policy-conventions')),
    new Set([
      ...prefixed(conventionRules),
      'policy/comment-and-log',
      'policy/readonly-model',
      'no-param-reassign',
      'policy/no-enum-boolean',
    ]),
  );
  assert.deepEqual(
    new Set(rulesFor('validation')),
    new Set([...prefixed(validationRules), 'policy/named-messages', '@typescript-eslint/no-magic-numbers']),
  );
  assert.deepEqual(
    rulesFor('presentation'),
    Object.keys(presentationRules).map((name) => `policy/${name}`),
  );
  assert.deepEqual(
    new Set(rulesFor('boundaries')),
    new Set([
      'boundaries/dependencies',
      'boundaries/no-unknown-files',
      'boundaries/no-unknown-dependencies',
      'boundaries/no-ignored-dependencies',
      ...prefixed(hexagonalRules).filter((ruleId) => ruleId !== 'policy/readonly-model'),
    ]),
  );
});

test('off beats group membership and on', () => {
  const selection = {
    groups: ['policy-conventions'],
    on: ['policy/validated-input'],
    off: ['policy/boolean-prefix'],
  };
  assert.equal(isRuleActive({ selection, ruleId: 'policy/boolean-prefix' }), false);
  assert.equal(isRuleActive({ selection, ruleId: 'policy/named-parameters' }), true);
  assert.equal(isRuleActive({ selection, ruleId: 'policy/validated-input' }), true);
  assert.equal(isRuleActive({ selection, ruleId: 'policy/static-tailwind' }), false);
});

test('flags accept a full selection and reject conflicts', () => {
  assert.deepEqual(selectionFromFlags({ isFull: true, only: [], on: [], off: [] }), fullSelection());
  assert.throws(
    () => selectionFromFlags({ isFull: true, only: ['codely'], on: [], off: [] }),
    /--full cannot be combined/,
  );
  assert.throws(() => selectionFromFlags({ isFull: false, only: ['missing'], on: [], off: [] }), /Unknown groups/);
  assert.throws(
    () =>
      selectionFromFlags({
        isFull: false,
        only: [],
        on: ['policy/boolean-prefix'],
        off: ['policy/boolean-prefix'],
      }),
    /both on and off/,
  );
});

test('enable and disable keep unrelated exceptions', () => {
  const initial = selectionFromFlags({
    isFull: false,
    only: ['policy-conventions'],
    on: ['policy/validated-input'],
    off: ['policy/boolean-prefix'],
  });
  const disabled = disableName({ selection: initial, name: 'policy-conventions' });
  assert.deepEqual(disabled, {
    groups: [],
    on: ['policy/validated-input'],
    off: ['policy/boolean-prefix'],
  });
  const enabled = enableName({ selection: disabled, name: 'policy/boolean-prefix' });
  assert.deepEqual(enabled.on, ['policy/boolean-prefix', 'policy/validated-input']);
  assert.deepEqual(enabled.off, []);
});

const closedTree = {
  cursor: { group: 0, rule: null },
  expanded: null,
  rulesOn: [[], [false, false]],
  emptyOn: [],
};

test('checklist moves onto rules and toggles a rule or a whole group', () => {
  const down = checklistStep({ name: 'down', state: closedTree });
  assert.equal(down.shouldDraw, true);
  const state2 = down.state;
  assert.deepEqual(state2.cursor, { group: 1, rule: null });
  const wrapped = checklistStep({ name: 'up', state: closedTree });
  const state3 = wrapped.state;
  assert.deepEqual(state3.cursor, { group: 1, rule: null });
  const opened = checklistStep({ name: 'right', state: down.state });
  const state4 = opened.state;
  assert.deepEqual(state4.expanded, 1);
  const onRule = checklistStep({ name: 'down', state: opened.state });
  const state5 = onRule.state;
  assert.deepEqual(state5.cursor, { group: 1, rule: 0 });
  const selected = checklistStep({ name: 'space', state: onRule.state });
  const state6 = selected.state;
  const rulesOn2 = state6.rulesOn;
  assert.deepEqual(rulesOn2[1], [true, false]);
  const cleared = checklistStep({ name: 'space', state: selected.state });
  const state7 = cleared.state;
  const rulesOn3 = state7.rulesOn;
  assert.deepEqual(rulesOn3[1], [false, false]);
  const allOn = checklistStep({
    name: 'space',
    state: { ...selected.state, cursor: { group: 1, rule: null } },
  });
  const state8 = allOn.state;
  const rulesOn4 = state8.rulesOn;
  assert.deepEqual(rulesOn4[1], [true, true]);
  const allOff = checklistStep({ name: 'space', state: allOn.state });
  const state9 = allOff.state;
  const rulesOn5 = state9.rulesOn;
  assert.deepEqual(rulesOn5[1], [false, false]);
  const emptyOn = checklistStep({ name: 'space', state: closedTree });
  const state10 = emptyOn.state;
  assert.deepEqual(state10.emptyOn, [0]);
  const emptyOff = checklistStep({ name: 'space', state: emptyOn.state });
  const state11 = emptyOff.state;
  assert.deepEqual(state11.emptyOn, []);
  const confirmed = checklistStep({ name: 'return', state: selected.state });
  assert.equal(confirmed.isDone, true);
  const state12 = confirmed.state;
  const state13 = selected.state;
  assert.deepEqual(state12.rulesOn, state13.rulesOn);
  const ignored = checklistStep({ name: 'left', state: closedTree });
  assert.equal(ignored.shouldDraw, false);
  assert.equal(ignored.state, closedTree);
});

test('checklist keeps one group open and collapses back to that group', () => {
  const opened = checklistStep({
    name: 'right',
    state: { ...closedTree, cursor: { group: 1, rule: null } },
  });
  assert.equal(opened.isDone, false);
  const state14 = opened.state;
  assert.deepEqual(state14.expanded, 1);
  const stillOpen = checklistStep({ name: 'right', state: opened.state });
  assert.equal(stillOpen.shouldDraw, false);
  assert.equal(stillOpen.state, opened.state);
  const onRule = { ...opened.state, cursor: { group: 1, rule: 0 }, rulesOn: [[], [true, false]] };
  const collapsed = checklistStep({ name: 'left', state: onRule });
  const state15 = collapsed.state;
  assert.equal(state15.expanded, null);
  const state16 = collapsed.state;
  assert.deepEqual(state16.cursor, { group: 1, rule: null });
  const state17 = collapsed.state;
  assert.deepEqual(state17.rulesOn, onRule.rulesOn);
  const empty = checklistStep({ name: 'right', state: closedTree });
  assert.equal(empty.shouldDraw, false);
  const other = checklistStep({
    name: 'right',
    state: {
      cursor: { group: 0, rule: null },
      expanded: 1,
      rulesOn: [[false], [true, false]],
      emptyOn: [],
    },
  });
  const state18 = other.state;
  assert.equal(state18.expanded, 0);
  const state19 = other.state;
  const rulesOn6 = state19.rulesOn;
  assert.deepEqual(rulesOn6[1], [true, false]);
});

test('tree selection saves a partial group as the group plus the rules left off', () => {
  const codeStyle = groups.findIndex((group) => group.name === 'code-style');
  const codely = groups.findIndex((group) => group.name === 'codely');
  const rulesOn = groups.map((group, index) => {
    const boundaries = groups.findIndex((group) => group.name === 'boundaries');
    if (index === boundaries) {
      const rules4 = group.rules;

      return rules4.map(() => true);
    }
    if (index === codeStyle) {
      const rules5 = group.rules;

      return rules5.map((rule) => rule === 'complexity');
    }

    const rules6 = group.rules;

    return rules6.map(() => false);
  });
  const selection = selectionFromTree({
    state: { cursor: { group: codeStyle, rule: null }, expanded: codeStyle, rulesOn, emptyOn: [codely] },
    catalog: groups,
  });
  const entry2 = groups[codeStyle];
  const rules7 = entry2.rules;
  assert.deepEqual(selection, {
    groups: ['codely', 'boundaries', 'code-style'],
    on: [],
    off: rules7.filter((rule) => rule !== 'complexity'),
  });
  const none = selectionFromTree({
    state: {
      cursor: { group: 0, rule: null },
      expanded: null,
      rulesOn: groups.map((group) => {
        const rules8 = group.rules;

        return rules8.map(() => false);
      }),
      emptyOn: [],
    },
    catalog: groups,
  });
  assert.deepEqual(none, { groups: [], on: [], off: [] });
});

function uncheckedSelection({ codeStyle, validation, removedRule }) {
  const codeGroup = groups[codeStyle];
  const codeRules = codeGroup.rules;
  const validationGroup = groups[validation];
  const validationRules = validationGroup.rules;

  return {
    groups: ['codely', 'code-style', 'validation'],
    on: [],
    off: [
      ...codeRules.filter((rule) => rule === 'complexity' || rule === removedRule),
      ...validationRules.filter((rule) => rule !== 'policy/validated-input'),
    ],
  };
}

test('tree opens from the installed selection and saves an unchecked rule as off', () => {
  const codeStyle = groups.findIndex((group) => group.name === 'code-style');
  const validation = groups.findIndex((group) => group.name === 'validation');
  const codely = groups.findIndex((group) => group.name === 'codely');
  const boundaries = groups.find((group) => group.name === 'boundaries');
  const installed = selectionFromFlags({
    isFull: false,
    only: ['codely', 'code-style', 'boundaries'],
    on: ['policy/validated-input'],
    off: ['complexity', ...boundaries.rules],
  });
  const state = treeFromSelection({ selection: installed, catalog: groups });
  assert.deepEqual(state.cursor, { group: 0, rule: null });
  assert.equal(state.expanded, null);
  assert.deepEqual(state.emptyOn, [codely]);
  const rulesOn7 = state.rulesOn;
  const entry3 = groups[codeStyle];
  const rules9 = entry3.rules;
  assert.deepEqual(
    rulesOn7[codeStyle],
    rules9.map((rule) => rule !== 'complexity'),
  );
  const rulesOn8 = state.rulesOn;
  const entry4 = groups[validation];
  const rules10 = entry4.rules;
  assert.deepEqual(
    rulesOn8[validation],
    rules10.map((rule) => rule === 'policy/validated-input'),
  );
  const rulesOn9 = state.rulesOn;
  const entry5 = rulesOn9[groups.findIndex((group) => group.name === 'boundaries')];
  assert.equal(
    entry5.some((isOn) => isOn),
    false,
  );
  const opened = checklistStep({
    name: 'right',
    state: { ...state, cursor: { group: codeStyle, rule: null } },
  });
  const onComplexity = checklistStep({ name: 'down', state: opened.state });
  const onNext = checklistStep({ name: 'down', state: onComplexity.state });
  const removed = checklistStep({ name: 'space', state: onNext.state });
  const entry6 = groups[codeStyle];
  const rules11 = entry6.rules;
  const removedRule = rules11[1];
  const state20 = removed.state;
  const rulesOn10 = state20.rulesOn;
  const entry7 = rulesOn10[codeStyle];
  assert.equal(entry7[1], false);
  assert.deepEqual(
    selectionFromTree({ state: removed.state, catalog: groups }),
    uncheckedSelection({ codeStyle, validation, removedRule }),
  );
});

test('tree selection drops a boundaries-only install when every rule is off', () => {
  const boundaries = groups.find((group) => group.name === 'boundaries');
  const cleared = selectionFromTree({
    state: treeFromSelection({
      selection: selectionFromFlags({
        isFull: false,
        only: ['boundaries'],
        on: [],
        off: boundaries.rules,
      }),
      catalog: groups,
    }),
    catalog: groups,
  });
  assert.deepEqual(cleared, { groups: [], on: [], off: [] });
});

test('defineConfig enables a lone rule, a group rule, and turns an exception off', () => {
  const ruleValue = (configs, ruleId) =>
    configs
      .flatMap((config) => {
        const rules2 = config.rules;

        const rules3 = config.rules;

        return rules2?.[ruleId] === undefined ? [] : [rules3[ruleId]];
      })
      .at(-1);
  const rootPath = fileURLToPath(new URL('../..', import.meta.url));
  const partial = defineConfig(rootPath, {
    groups: ['boundaries', 'presentation'],
    on: ['policy/boolean-prefix'],
    off: ['policy/static-tailwind'],
  });
  assert.equal(ruleValue(partial, 'boundaries/dependencies')[0], 'error');
  assert.equal(ruleValue(partial, 'policy/boolean-prefix'), 'error');
  assert.equal(ruleValue(partial, 'policy/named-parameters'), undefined);
  assert.equal(ruleValue(partial, 'policy/static-tailwind'), 'off');
  assert.equal(ruleValue(partial, 'policy/used-react-props'), 'error');
  const typed = partial.find((config) => {
    const languageOptions2 = config.languageOptions;
    const parserOptions2 = languageOptions2?.parserOptions;

    return parserOptions2?.project !== undefined;
  });
  const languageOptions3 = typed?.languageOptions;
  const parserOptions3 = languageOptions3.parserOptions;
  assert.deepEqual(parserOptions3.project, ['./tsconfig.eslint.json']);
  const languageOptions4 = typed?.languageOptions;
  assert.notEqual(languageOptions4.parser, undefined);
  assert.equal(ruleValue(partial, 'constructor-super'), undefined);
  const jsxBlock = partial.find((config) => {
    const files2 = config.files;

    return Array.isArray(files2) && files2.includes('**/*.{tsx,jsx}');
  });
  const rules14 = jsxBlock?.rules;
  const norestrictedsyntax = frontendRules['no-restricted-syntax'];
  const norestrictedsyntax2 = codeRules['no-restricted-syntax'];
  assert.deepEqual(rules14['no-restricted-syntax'], ['error', ...norestrictedsyntax.slice(norestrictedsyntax2.length)]);
  const full = defineConfig(rootPath, fullSelection());
  assert.equal(ruleValue(full, 'policy/boolean-prefix'), 'error');
  assert.equal(ruleValue(full, 'check-file/folder-naming-convention')[0], 'error');
  assert.equal(ruleValue(full, 'prettier/prettier')[0], 'error');
});
