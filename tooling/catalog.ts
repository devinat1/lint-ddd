export const groups: readonly { name: string; rules: readonly string[] }[] = [
  { name: "codely", rules: [] },
  {
    name: "boundaries",
    rules: [
      "boundaries/dependencies",
      "boundaries/no-unknown-files",
      "boundaries/no-unknown-dependencies",
      "boundaries/no-ignored-dependencies",
    ],
  },
  {
    name: "strict-types",
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
    rules: ["complexity", "max-depth", "max-lines-per-function", "import/no-cycle", "no-restricted-syntax"],
  },
  {
    name: "policy-conventions",
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
    rules: ["policy/named-messages", "policy/validated-input", "@typescript-eslint/no-magic-numbers"],
  },
  { name: "presentation", rules: ["policy/static-tailwind", "policy/used-react-props"] },
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

export const choicesFromAnswer = ({ answer, choices }: { answer: string; choices: readonly string[] }): string[] => {
  const tokens = answer
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token !== "");
  if (tokens.length === 0) {
    return [];
  }
  const indexes = tokens.map((token) => Number(token));
  const hasInvalidIndex = indexes.some((index) => !Number.isInteger(index) || index < 1 || index > choices.length);
  if (hasInvalidIndex) {
    throw new Error("Choose numbers from the list.");
  }

  return indexes.map((index) => choices[index - 1]);
};
