export const groups: readonly { name: string; detail: string; rules: readonly string[] }[] = [
  { name: "codely", detail: "Prettier, sorted imports, unused imports, and baseline TypeScript checks.", rules: [] },
  {
    name: "boundaries",
    detail: "Which layers may import which other layers.",
    rules: [
      "boundaries/dependencies",
      "boundaries/no-unknown-files",
      "boundaries/no-unknown-dependencies",
      "boundaries/no-ignored-dependencies",
    ],
  },
  {
    name: "strict-types",
    detail: "Strict TypeScript checks and Prettier formatting.",
    rules: [
      "@typescript-eslint/no-explicit-any",
      "@typescript-eslint/array-type",
      "@typescript-eslint/await-thenable",
      "@typescript-eslint/consistent-type-exports",
      "@typescript-eslint/consistent-type-imports",
      "@typescript-eslint/no-base-to-string",
      "@typescript-eslint/no-deprecated",
      "@typescript-eslint/no-duplicate-type-constituents",
      "@typescript-eslint/no-misused-promises",
      "@typescript-eslint/no-misused-spread",
      "@typescript-eslint/no-redundant-type-constituents",
      "@typescript-eslint/no-unnecessary-type-conversion",
      "@typescript-eslint/no-unnecessary-type-parameters",
      "@typescript-eslint/no-unsafe-type-assertion",
      "@typescript-eslint/return-await",
      "@typescript-eslint/strict-boolean-expressions",
      "@typescript-eslint/unbound-method",
      "@typescript-eslint/no-unsafe-argument",
      "@typescript-eslint/no-unsafe-assignment",
      "@typescript-eslint/no-unsafe-call",
      "@typescript-eslint/no-unsafe-member-access",
      "@typescript-eslint/no-unsafe-return",
      "@typescript-eslint/no-unnecessary-type-assertion",
      "@typescript-eslint/only-throw-error",
      "@typescript-eslint/restrict-plus-operands",
      "@typescript-eslint/restrict-template-expressions",
      "prettier/prettier",
    ],
  },
  {
    name: "code-style",
    detail: "Complexity, nesting, function length, and cycles.",
    rules: ["complexity", "max-depth", "max-lines-per-function", "import/no-cycle", "no-restricted-syntax"],
  },
  {
    name: "policy-conventions",
    detail: "Names, parameters, immutability, and test files.",
    rules: [
      "policy/boolean-prefix",
      "policy/named-parameters",
      "policy/array-emptiness",
      "policy/immutable-arrays",
      "policy/parameter-mutation",
      "policy/optional-nullable",
      "policy/typescript-tests",
      "policy/comment-and-log",
      "no-param-reassign",
    ],
  },
  {
    name: "validation",
    detail: "Zod for JSON input, named messages, and magic numbers.",
    rules: ["policy/named-messages", "policy/validated-input", "@typescript-eslint/no-magic-numbers"],
  },
  {
    name: "presentation",
    detail: "JSX structure, Tailwind spacing, and React props.",
    rules: ["policy/static-tailwind", "policy/used-react-props"],
  },
];

export type Selection = {
  groups: string[];
  on: string[];
  off: string[];
};

export const groupNames = groups.map((group) => group.name);
export const ruleIds = groups.flatMap((group) => group.rules.map((ruleId) => ruleId));
const ruleGroups = new Map(
  groups.flatMap((group) => group.rules.map((ruleId): [string, string] => [ruleId, group.name])),
);

const listed = ({ names, allowed }: { names: readonly string[]; allowed: readonly string[] }): string[] =>
  allowed.filter((name) => names.includes(name));

const assertKnown = ({
  names,
  allowed,
  label,
}: {
  names: readonly string[];
  allowed: readonly string[];
  label: string;
}): void => {
  const unknownNames = names.filter((name) => !allowed.includes(name));
  if (unknownNames.length === 0) {
    return;
  }
  throw new Error(`Unknown ${label}: ${unknownNames.join(", ")}.`);
};

const assertNoOverlap = ({ on, off }: { on: readonly string[]; off: readonly string[] }): void => {
  const overlap = on.filter((ruleId) => off.includes(ruleId));
  if (overlap.length === 0) {
    return;
  }
  throw new Error(`Rules cannot be both on and off: ${overlap.join(", ")}.`);
};

export const orderSelection = (selection: Selection): Selection => ({
  groups: listed({ names: selection.groups, allowed: groupNames }),
  on: listed({ names: selection.on, allowed: ruleIds }),
  off: listed({ names: selection.off, allowed: ruleIds }),
});

export const fullSelection = (): Selection => ({ groups: [...groupNames], on: [], off: [] });

export const isRuleActive = ({ selection, ruleId }: { selection: Selection; ruleId: string }): boolean => {
  if (selection.off.includes(ruleId)) {
    return false;
  }
  if (selection.on.includes(ruleId)) {
    return true;
  }
  const groupName = ruleGroups.get(ruleId);

  return groupName !== undefined && selection.groups.includes(groupName);
};

export const selectionFromFlags = ({
  isFull,
  only,
  on,
  off,
}: {
  isFull: boolean;
  only: readonly string[];
  on: readonly string[];
  off: readonly string[];
}): Selection => {
  if (isFull && (only.length !== 0 || on.length !== 0 || off.length !== 0)) {
    throw new Error("--full cannot be combined with --only, --on, or --off.");
  }
  if (isFull) {
    return fullSelection();
  }
  assertKnown({ names: only, allowed: groupNames, label: "groups" });
  assertKnown({ names: on, allowed: ruleIds, label: "rules" });
  assertKnown({ names: off, allowed: ruleIds, label: "rules" });
  assertNoOverlap({ on, off });

  return orderSelection({ groups: [...only], on: [...on], off: [...off] });
};

const nameKind = (name: string): "group" | "rule" => {
  if (groupNames.includes(name)) {
    return "group";
  }
  if (ruleIds.includes(name)) {
    return "rule";
  }
  throw new Error(`Unknown group or rule: ${name}.`);
};

export const enableName = ({ selection, name }: { selection: Selection; name: string }): Selection => {
  if (nameKind(name) === "group") {
    return orderSelection({ ...selection, groups: [...selection.groups, name] });
  }

  return orderSelection({
    ...selection,
    on: [...selection.on, name],
    off: selection.off.filter((ruleId) => ruleId !== name),
  });
};

export const disableName = ({ selection, name }: { selection: Selection; name: string }): Selection => {
  if (nameKind(name) === "group") {
    return orderSelection({ ...selection, groups: selection.groups.filter((groupName) => groupName !== name) });
  }

  return orderSelection({
    ...selection,
    on: selection.on.filter((ruleId) => ruleId !== name),
    off: [...selection.off, name],
  });
};

export const changeNames = ({
  selection,
  names,
  isEnable,
}: {
  selection: Selection;
  names: readonly string[];
  isEnable: boolean;
}): Selection =>
  names.reduce(
    (current, name) =>
      isEnable ? enableName({ selection: current, name }) : disableName({ selection: current, name }),
    selection,
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringArray = ({ value, key }: { value: Record<string, unknown>; key: string }): string[] => {
  const field = value[key];
  if (!Array.isArray(field) || !field.every((item) => typeof item === "string")) {
    throw new Error(`lint-ddd.config.json ${key} must be an array of strings.`);
  }

  return field;
};

export const parseSelection = (value: unknown): Selection => {
  if (!isRecord(value)) {
    throw new Error("lint-ddd.config.json must be an object.");
  }

  return selectionFromFlags({
    isFull: false,
    only: stringArray({ value, key: "groups" }),
    on: stringArray({ value, key: "on" }),
    off: stringArray({ value, key: "off" }),
  });
};

export type TreeCursor = { readonly group: number; readonly rule: number | null };

export type TreeState = {
  readonly cursor: TreeCursor;
  readonly expanded: number | null;
  readonly rulesOn: readonly (readonly boolean[])[];
  readonly emptyOn: readonly number[];
};

export const treeFromSelection = ({
  selection,
  catalog,
}: {
  selection: Selection;
  catalog: readonly { name: string; rules: readonly string[] }[];
}): TreeState => ({
  cursor: { group: 0, rule: null },
  expanded: null,
  rulesOn: catalog.map((group) => group.rules.map((ruleId) => isRuleActive({ selection, ruleId }))),
  emptyOn: catalog.flatMap((group, index) =>
    group.rules.length === 0 && selection.groups.includes(group.name) ? [index] : [],
  ),
});

const sameCursor = ({ left, right }: { left: TreeCursor; right: TreeCursor }): boolean =>
  left.group === right.group && left.rule === right.rule;

const visibleRows = (state: TreeState): readonly TreeCursor[] =>
  state.rulesOn.flatMap((rules, group) => [
    { group, rule: null },
    ...(state.expanded === group ? Array.from({ length: rules.length }, (_, rule) => ({ group, rule })) : []),
  ]);

const movedCursor = ({ name, state }: { name: string; state: TreeState }): TreeCursor | undefined => {
  if (name !== "up" && name !== "down") {
    return undefined;
  }
  const rows = visibleRows(state);
  if (rows.length === 0) {
    return undefined;
  }
  const index = rows.findIndex((row) => sameCursor({ left: row, right: state.cursor }));
  const current = index === -1 ? 0 : index;
  const delta = name === "up" ? rows.length - 1 : 1;

  return rows[(current + delta) % rows.length];
};

const nextExpanded = ({ name, state }: { name: string; state: TreeState }): number | null | undefined => {
  if (name !== "left" && name !== "right") {
    return undefined;
  }
  const { group, rule } = state.cursor;
  const childCount = state.rulesOn[group]?.length ?? 0;
  if (name === "left") {
    return state.expanded === group ? null : state.expanded;
  }
  if (rule !== null || childCount === 0 || state.expanded === group) {
    return state.expanded;
  }

  return group;
};

const withGroupRules = ({
  state,
  group,
  rules,
}: {
  state: TreeState;
  group: number;
  rules: readonly boolean[];
}): TreeState => ({
  ...state,
  rulesOn: state.rulesOn.map((row, index) => (index === group ? rules : row)),
});

const toggledRule = ({ state, group, rule }: { state: TreeState; group: number; rule: number }): TreeState =>
  withGroupRules({
    state,
    group,
    rules: (state.rulesOn[group] ?? []).map((isOn, index) => (index === rule ? !isOn : isOn)),
  });

const toggledGroup = (state: TreeState): TreeState => {
  const { group } = state.cursor;
  const rules = state.rulesOn[group] ?? [];
  if (rules.length === 0) {
    const emptyOn = state.emptyOn.includes(group)
      ? state.emptyOn.filter((index) => index !== group)
      : [...state.emptyOn, group];

    return { ...state, emptyOn };
  }

  return withGroupRules({
    state,
    group,
    rules: rules.map(() => !rules.every((isOn) => isOn)),
  });
};

const toggled = (state: TreeState): TreeState => {
  const { rule } = state.cursor;
  if (rule === null) {
    return toggledGroup(state);
  }

  return toggledRule({ state, group: state.cursor.group, rule });
};

const keptCursor = ({ name, state }: { name: string; state: TreeState }): TreeCursor => {
  if (name === "left" && state.cursor.rule !== null) {
    return { group: state.cursor.group, rule: null };
  }

  return state.cursor;
};

export const checklistStep = ({
  name,
  state,
}: {
  name: string;
  state: TreeState;
}): { state: TreeState; isDone: boolean; shouldDraw: boolean } => {
  if (name === "return") {
    return { state, isDone: true, shouldDraw: false };
  }
  if (name === "space") {
    return { state: toggled(state), isDone: false, shouldDraw: true };
  }
  const cursor = movedCursor({ name, state });
  if (cursor !== undefined) {
    return { state: { ...state, cursor }, isDone: false, shouldDraw: true };
  }
  const expanded = nextExpanded({ name, state });
  if (expanded === undefined || expanded === state.expanded) {
    return { state, isDone: false, shouldDraw: false };
  }

  return { state: { ...state, expanded, cursor: keptCursor({ name, state }) }, isDone: false, shouldDraw: true };
};

const groupChoice = ({
  group,
  rulesOn,
  isEmptyOn,
}: {
  group: { name: string; rules: readonly string[] };
  rulesOn: readonly boolean[];
  isEmptyOn: boolean;
}): { groups: string[]; off: string[] } => {
  if (group.rules.length === 0) {
    return isEmptyOn ? { groups: [group.name], off: [] } : { groups: [], off: [] };
  }
  if (!rulesOn.some((isOn) => isOn)) {
    return { groups: [], off: [] };
  }

  return {
    groups: [group.name],
    off: group.rules.filter((_, index) => !rulesOn[index]),
  };
};

export const selectionFromTree = ({
  state,
  catalog,
}: {
  state: TreeState;
  catalog: readonly { name: string; rules: readonly string[] }[];
}): Selection => {
  const chosen = catalog.map((group, index) =>
    groupChoice({
      group,
      rulesOn: state.rulesOn[index] ?? [],
      isEmptyOn: state.emptyOn.includes(index),
    }),
  );

  return selectionFromFlags({
    isFull: false,
    only: chosen.flatMap((choice) => choice.groups),
    on: [],
    off: chosen.flatMap((choice) => choice.off),
  });
};
