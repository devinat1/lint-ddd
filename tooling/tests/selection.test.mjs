import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
	choicesFromAnswer,
	disableName,
	enableName,
	fullSelection,
	groupNames,
	groups,
	isRuleActive,
	selectionFromFlags,
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

test("checklist answers use one-based numbers", () => {
	assert.deepEqual(choicesFromAnswer({ answer: "  ", choices: ["codely", "boundaries"] }), []);
	assert.deepEqual(choicesFromAnswer({ answer: "2, 1", choices: ["codely", "boundaries"] }), [
		"boundaries",
		"codely",
	]);
	assert.throws(() => choicesFromAnswer({ answer: "0", choices: ["codely"] }), /Choose numbers/);
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
