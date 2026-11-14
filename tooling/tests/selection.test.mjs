import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

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
} from "../catalog.ts";
import { conventionRules } from "../conventionRules.ts";
import { defineConfig } from "../eslint.config.mjs";
import { codeRules, frontendRules, strictLintConfiguration } from "../eslint.rules.ts";
import { presentationRules } from "../presentationRules.ts";
import { validationRules } from "../validationRules.ts";

const rulesFor = (name) => groups.find((group) => group.name === name)?.rules;
const prefixed = (rules) => Object.keys(rules).map((name) => `policy/${name}`);
const ruleValue = (configs, ruleId) =>
	configs.flatMap((config) => (config.rules?.[ruleId] === undefined ? [] : [config.rules[ruleId]])).at(-1);

test("catalog lists the authored rules", () => {
	assert.deepEqual(groupNames, [
		"codely",
		"boundaries",
		"strict-types",
		"code-style",
		"policy-conventions",
		"validation",
		"presentation",
	]);
	assert.deepEqual(rulesFor("codely"), []);
	assert.deepEqual(rulesFor("code-style"), Object.keys(codeRules));
	assert.deepEqual(rulesFor("strict-types"), Object.keys(strictLintConfiguration[0].rules));
	assert.deepEqual(
		new Set(rulesFor("policy-conventions")),
		new Set([...prefixed(conventionRules), "policy/comment-and-log", "no-param-reassign"]),
	);
	assert.deepEqual(
		new Set(rulesFor("validation")),
		new Set([...prefixed(validationRules), "policy/named-messages", "@typescript-eslint/no-magic-numbers"]),
	);
	assert.deepEqual(
		rulesFor("presentation"),
		Object.keys(presentationRules).map((name) => `policy/${name}`),
	);
	assert.deepEqual(
		new Set(rulesFor("boundaries")),
		new Set([
			"boundaries/dependencies",
			"boundaries/no-unknown-files",
			"boundaries/no-unknown-dependencies",
			"boundaries/no-ignored-dependencies",
		]),
	);
});

test("off beats group membership and on", () => {
	const selection = {
		groups: ["policy-conventions"],
		on: ["policy/validated-input"],
		off: ["policy/boolean-prefix"],
	};
	assert.equal(isRuleActive({ selection, ruleId: "policy/boolean-prefix" }), false);
	assert.equal(isRuleActive({ selection, ruleId: "policy/named-parameters" }), true);
	assert.equal(isRuleActive({ selection, ruleId: "policy/validated-input" }), true);
	assert.equal(isRuleActive({ selection, ruleId: "policy/static-tailwind" }), false);
});

test("flags accept a full selection and reject conflicts", () => {
	assert.deepEqual(selectionFromFlags({ isFull: true, only: [], on: [], off: [] }), fullSelection());
	assert.throws(
		() => selectionFromFlags({ isFull: true, only: ["codely"], on: [], off: [] }),
		/--full cannot be combined/,
	);
	assert.throws(() => selectionFromFlags({ isFull: false, only: ["missing"], on: [], off: [] }), /Unknown groups/);
	assert.throws(
		() =>
			selectionFromFlags({
				isFull: false,
				only: [],
				on: ["policy/boolean-prefix"],
				off: ["policy/boolean-prefix"],
			}),
		/both on and off/,
	);
});

test("enable and disable keep unrelated exceptions", () => {
	const initial = selectionFromFlags({
		isFull: false,
		only: ["policy-conventions"],
		on: ["policy/validated-input"],
		off: ["policy/boolean-prefix"],
	});
	const disabled = disableName({ selection: initial, name: "policy-conventions" });
	assert.deepEqual(disabled, {
		groups: [],
		on: ["policy/validated-input"],
		off: ["policy/boolean-prefix"],
	});
	const enabled = enableName({ selection: disabled, name: "policy/boolean-prefix" });
	assert.deepEqual(enabled.on, ["policy/boolean-prefix", "policy/validated-input"]);
	assert.deepEqual(enabled.off, []);
});

const closedTree = {
	cursor: { group: 0, rule: null },
	expanded: null,
	rulesOn: [[], [false, false]],
	emptyOn: [],
};

test("checklist moves onto rules and toggles a rule or a whole group", () => {
	const down = checklistStep({ name: "down", state: closedTree });
	assert.equal(down.shouldDraw, true);
	assert.deepEqual(down.state.cursor, { group: 1, rule: null });
	const wrapped = checklistStep({ name: "up", state: closedTree });
	assert.deepEqual(wrapped.state.cursor, { group: 1, rule: null });
	const opened = checklistStep({ name: "right", state: down.state });
	assert.deepEqual(opened.state.expanded, 1);
	const onRule = checklistStep({ name: "down", state: opened.state });
	assert.deepEqual(onRule.state.cursor, { group: 1, rule: 0 });
	const selected = checklistStep({ name: "space", state: onRule.state });
	assert.deepEqual(selected.state.rulesOn[1], [true, false]);
	const cleared = checklistStep({ name: "space", state: selected.state });
	assert.deepEqual(cleared.state.rulesOn[1], [false, false]);
	const allOn = checklistStep({
		name: "space",
		state: { ...selected.state, cursor: { group: 1, rule: null } },
	});
	assert.deepEqual(allOn.state.rulesOn[1], [true, true]);
	const allOff = checklistStep({ name: "space", state: allOn.state });
	assert.deepEqual(allOff.state.rulesOn[1], [false, false]);
	const emptyOn = checklistStep({ name: "space", state: closedTree });
	assert.deepEqual(emptyOn.state.emptyOn, [0]);
	const emptyOff = checklistStep({ name: "space", state: emptyOn.state });
	assert.deepEqual(emptyOff.state.emptyOn, []);
	const confirmed = checklistStep({ name: "return", state: selected.state });
	assert.equal(confirmed.isDone, true);
	assert.deepEqual(confirmed.state.rulesOn, selected.state.rulesOn);
	const ignored = checklistStep({ name: "left", state: closedTree });
	assert.equal(ignored.shouldDraw, false);
	assert.equal(ignored.state, closedTree);
});

test("checklist keeps one group open and collapses back to that group", () => {
	const opened = checklistStep({
		name: "right",
		state: { ...closedTree, cursor: { group: 1, rule: null } },
	});
	assert.equal(opened.isDone, false);
	assert.deepEqual(opened.state.expanded, 1);
	const stillOpen = checklistStep({ name: "right", state: opened.state });
	assert.equal(stillOpen.shouldDraw, false);
	assert.equal(stillOpen.state, opened.state);
	const onRule = { ...opened.state, cursor: { group: 1, rule: 0 }, rulesOn: [[], [true, false]] };
	const collapsed = checklistStep({ name: "left", state: onRule });
	assert.equal(collapsed.state.expanded, null);
	assert.deepEqual(collapsed.state.cursor, { group: 1, rule: null });
	assert.deepEqual(collapsed.state.rulesOn, onRule.rulesOn);
	const empty = checklistStep({ name: "right", state: closedTree });
	assert.equal(empty.shouldDraw, false);
	const other = checklistStep({
		name: "right",
		state: {
			cursor: { group: 0, rule: null },
			expanded: 1,
			rulesOn: [[false], [true, false]],
			emptyOn: [],
		},
	});
	assert.equal(other.state.expanded, 0);
	assert.deepEqual(other.state.rulesOn[1], [true, false]);
});

test("tree selection saves a partial group as the group plus the rules left off", () => {
	const codeStyle = groups.findIndex((group) => group.name === "code-style");
	const boundaries = groups.findIndex((group) => group.name === "boundaries");
	const codely = groups.findIndex((group) => group.name === "codely");
	const rulesOn = groups.map((group, index) => {
		if (index === boundaries) {
			return group.rules.map(() => true);
		}
		if (index === codeStyle) {
			return group.rules.map((rule) => rule === "complexity");
		}

		return group.rules.map(() => false);
	});
	const selection = selectionFromTree({
		state: { cursor: { group: codeStyle, rule: null }, expanded: codeStyle, rulesOn, emptyOn: [codely] },
		catalog: groups,
	});
	assert.deepEqual(selection, {
		groups: ["codely", "boundaries", "code-style"],
		on: [],
		off: groups[codeStyle].rules.filter((rule) => rule !== "complexity"),
	});
	const none = selectionFromTree({
		state: {
			cursor: { group: 0, rule: null },
			expanded: null,
			rulesOn: groups.map((group) => group.rules.map(() => false)),
			emptyOn: [],
		},
		catalog: groups,
	});
	assert.deepEqual(none, { groups: [], on: [], off: [] });
});

test("defineConfig enables a lone rule, a group rule, and turns an exception off", () => {
	const rootPath = fileURLToPath(new URL("../..", import.meta.url));
	const partial = defineConfig(rootPath, {
		groups: ["boundaries", "presentation"],
		on: ["policy/boolean-prefix"],
		off: ["policy/static-tailwind"],
	});
	assert.equal(ruleValue(partial, "boundaries/dependencies")[0], "error");
	assert.equal(ruleValue(partial, "policy/boolean-prefix"), "error");
	assert.equal(ruleValue(partial, "policy/named-parameters"), undefined);
	assert.equal(ruleValue(partial, "policy/static-tailwind"), "off");
	assert.equal(ruleValue(partial, "policy/used-react-props"), "error");
	assert.equal(ruleValue(partial, "constructor-super"), undefined);
	const jsxBlock = partial.find((config) => Array.isArray(config.files) && config.files.includes("**/*.{tsx,jsx}"));
	assert.deepEqual(jsxBlock?.rules["no-restricted-syntax"], [
		"error",
		...frontendRules["no-restricted-syntax"].slice(codeRules["no-restricted-syntax"].length),
	]);
	const full = defineConfig(rootPath, fullSelection());
	assert.equal(ruleValue(full, "policy/boolean-prefix"), "error");
	assert.equal(ruleValue(full, "check-file/folder-naming-convention")[0], "error");
	assert.equal(ruleValue(full, "prettier/prettier")[0], "error");
});
