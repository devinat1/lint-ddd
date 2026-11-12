import eslintConfigCodely from "eslint-config-codely";
import boundaries from "eslint-plugin-boundaries";
import importPlugin from "eslint-plugin-import-x";
import prettierPlugin from "eslint-plugin-prettier";
import typescriptEslint from "typescript-eslint";

import { isRuleActive, ruleIds } from "./catalog.ts";
import { codeRules, frontendRules, strictLintConfiguration } from "./eslint.rules.ts";
import { readSelection } from "./manifest.mjs";
import { policyPlugin } from "./policyPlugin.ts";

const elements = [
	{ type: "domain", pattern: "src/domain", partialMatch: false },
	{ type: "ports", pattern: "src/ports", partialMatch: false },
	{ type: "application", pattern: "src/application", partialMatch: false },
	{ type: "primary", pattern: "src/adapters/primary/*", partialMatch: false },
	{ type: "secondary", pattern: "src/adapters/secondary/*", partialMatch: false },
	{ type: "composition", pattern: "src/composition", partialMatch: false },
	{ type: "presentation", pattern: "src/presentation", partialMatch: false },
	{ type: "test", pattern: "tests", partialMatch: false },
	{ type: "tooling", pattern: "tooling", partialMatch: false },
];
const dependencies = {
	domain: ["domain"],
	ports: ["domain", "ports"],
	application: ["domain", "ports", "application"],
	primary: ["application", "ports", "domain", "composition"],
	secondary: ["ports", "domain"],
	composition: ["application", "ports", "domain", "primary", "secondary", "composition"],
	presentation: ["presentation", "composition", "domain"],
	test: ["*"],
	tooling: ["*"],
};
const externalDependencies = {
	domain: ["zod"],
	ports: ["zod"],
	application: ["zod"],
	primary: ["zod", "node:http"],
	secondary: ["zod", "node:crypto"],
	composition: ["zod"],
	presentation: ["react", "react-dom", "react/jsx-runtime", "next", "next/link", "next/navigation"],
};
const authoredTypescript = ["{src,tests,tooling}/**/*.{ts,tsx}"];
const selectRole = (role) => [{ element: { type: role } }, { file: { categories: [role] } }];
const files = [
	{ category: "test", pattern: "**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}", exclusive: true },
	{ category: "test", pattern: "tests/**", exclusive: true },
	{ category: "tooling", pattern: "tooling/**", exclusive: true },
	{ category: "tooling", pattern: "bin/lint-ddd.mjs", exclusive: true },
	{ category: "tooling", pattern: "*.config.mjs", exclusive: true },
];
const strictRules = strictLintConfiguration[0].rules;
const codeSyntax = codeRules["no-restricted-syntax"];
const jsxSyntaxSelectors = frontendRules["no-restricted-syntax"].slice(codeSyntax.length);
const jsxOnlySyntax = ["error", ...jsxSyntaxSelectors];
const folderNaming = ["error", { "**/*": "+([a-zA-Z0-9\\[\\]\\(\\)\\.])" }];
const magicNumbers = [
	"error",
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

const configuredRules = (selection, specs) => {
	const rules = Object.fromEntries(
		specs.flatMap(([ruleId, value]) => {
			if (selection.off.includes(ruleId)) {
				return [[ruleId, "off"]];
			}
			if (isRuleActive({ selection, ruleId })) {
				return [[ruleId, value]];
			}

			return [];
		}),
	);

	return Object.keys(rules).length === 0 ? undefined : rules;
};

const ruleIsUsed = (selection, ruleId) => isRuleActive({ selection, ruleId }) || selection.off.includes(ruleId);

const usesTypescriptRules = (selection) =>
	ruleIds.some((ruleId) => ruleId.startsWith("@typescript-eslint/") && ruleIsUsed(selection, ruleId));

const hostPlugins = (selection) => {
	if (selection.groups.includes("codely")) {
		return undefined;
	}
	const plugins = {};
	if (ruleIsUsed(selection, "import/no-cycle")) {
		plugins.import = importPlugin;
	}
	if (ruleIsUsed(selection, "prettier/prettier")) {
		plugins.prettier = prettierPlugin;
	}

	return Object.keys(plugins).length === 0 ? undefined : plugins;
};

const typescriptBlock = (selection) => {
	if (selection.groups.includes("codely") || !usesTypescriptRules(selection)) {
		return undefined;
	}

	return {
		files: ["**/*.{ts,tsx,mts,cts}"],
		plugins: { "@typescript-eslint": typescriptEslint.plugin },
		languageOptions: { parser: typescriptEslint.parser },
	};
};

const jsxSyntax = (selection) => {
	if (!selection.groups.includes("presentation") || selection.off.includes("no-restricted-syntax")) {
		return undefined;
	}
	if (isRuleActive({ selection, ruleId: "no-restricted-syntax" })) {
		return frontendRules["no-restricted-syntax"];
	}

	return jsxOnlySyntax;
};

const baseBlocks = ({ selection, rootPath }) => {
	const blocks = [];
	if (selection.groups.includes("codely")) {
		blocks.push(...eslintConfigCodely.full.filter((configuration) => configuration.ignores === undefined));
	}
	blocks.push({ ignores: ["node_modules/**", ".codegraph/**", "dist/**"] });
	const plugins = hostPlugins(selection);
	if (plugins !== undefined) {
		blocks.push({ plugins });
	}
	const typescript = typescriptBlock(selection);
	if (typescript !== undefined) {
		blocks.push(typescript);
	}
	const codeStyleRules = { ...(configuredRules(selection, Object.entries(codeRules)) ?? {}) };
	if (selection.groups.includes("codely") && selection.groups.includes("code-style")) {
		codeStyleRules["check-file/folder-naming-convention"] = folderNaming;
	}
	if (Object.keys(codeStyleRules).length !== 0) {
		blocks.push({ rules: codeStyleRules });
	}
	const selectedStrictRules = configuredRules(selection, Object.entries(strictRules));
	if (selectedStrictRules !== undefined) {
		const hasActiveStrictRule = Object.keys(strictRules).some((ruleId) => isRuleActive({ selection, ruleId }));
		const languageOptions = hasActiveStrictRule
			? {
					parserOptions: {
						projectService: false,
						project: ["./tsconfig.eslint.json"],
						tsconfigRootDir: rootPath,
					},
					...(selection.groups.includes("codely") ? {} : { parser: typescriptEslint.parser }),
				}
			: undefined;
		blocks.push({
			files: ["**/*.{ts,tsx}"],
			...(languageOptions === undefined ? {} : { languageOptions }),
			rules: selectedStrictRules,
		});
	}

	return blocks;
};

const policyBlocks = (selection) => {
	const usesPolicy = ruleIds.some((ruleId) => ruleId.startsWith("policy/") && ruleIsUsed(selection, ruleId));
	if (!usesPolicy) {
		return [];
	}
	const commentRules = configuredRules(selection, [["policy/comment-and-log", "error"]]);
	const blocks = [
		{
			plugins: { policy: policyPlugin },
			...(commentRules === undefined ? {} : { rules: commentRules }),
		},
	];
	const conventionRules = configuredRules(selection, [
		["policy/boolean-prefix", "error"],
		["policy/named-parameters", "error"],
		["policy/array-emptiness", "error"],
		["policy/immutable-arrays", "error"],
		["policy/parameter-mutation", "error"],
		["no-param-reassign", ["error", { props: false }]],
	]);
	if (conventionRules !== undefined) {
		blocks.push({ files: authoredTypescript, rules: conventionRules });
	}
	const validationRules = configuredRules(selection, [
		["policy/named-messages", "error"],
		["policy/validated-input", "error"],
		["@typescript-eslint/no-magic-numbers", magicNumbers],
	]);
	if (validationRules !== undefined) {
		blocks.push({ files: ["src/**/*.{ts,tsx}"], rules: validationRules });
	}
	const nullableRules = configuredRules(selection, [["policy/optional-nullable", "error"]]);
	if (nullableRules !== undefined) {
		blocks.push({ files: ["src/{domain,ports}/**/*.ts"], rules: nullableRules });
	}
	const testRules = configuredRules(selection, [["policy/typescript-tests", "error"]]);
	if (testRules !== undefined) {
		blocks.push({ files: ["{src,tests}/**/*.{ts,tsx,js,jsx,mjs,cjs}"], rules: testRules });
	}
	const jsxRules = { ...(configuredRules(selection, [["policy/static-tailwind", "error"]]) ?? {}) };
	const syntax = jsxSyntax(selection);
	if (syntax !== undefined) {
		jsxRules["no-restricted-syntax"] = syntax;
	}
	if (Object.keys(jsxRules).length !== 0) {
		blocks.push({ files: ["**/*.{tsx,jsx}"], rules: jsxRules });
	}
	const reactPropRules = configuredRules(selection, [["policy/used-react-props", "error"]]);
	if (reactPropRules !== undefined) {
		blocks.push({ files: ["src/presentation/**/*.tsx"], rules: reactPropRules });
	}

	return blocks;
};

const boundaryPolicies = () => [
	{
		dependency: { relationship: { to: "internal" } },
		allow: { to: { module: { origin: "local" } } },
	},
	...Object.entries(dependencies).map(([role, allowed]) => ({
		from: { element: { type: role } },
		allow: { to: { element: { type: allowed } } },
	})),
	...Object.entries(externalDependencies).map(([role, allowed]) => ({
		from: { element: { type: role } },
		allow: { to: { module: { origin: ["external", "core"], source: allowed } } },
	})),
	{
		from: { module: { origin: "local" } },
		disallow: { to: { file: { categories: ["test", "tooling"] } } },
	},
	...["test", "tooling"].map((role) => ({
		from: selectRole(role),
		allow: { to: { module: { origin: ["local", "external", "core"] } } },
	})),
];

const boundaryBlocks = ({ selection, rootPath }) => {
	const rules = configuredRules(selection, [
		["boundaries/no-unknown-files", "error"],
		["boundaries/no-unknown-dependencies", "error"],
		["boundaries/no-ignored-dependencies", "error"],
		[
			"boundaries/dependencies",
			[
				"error",
				{
					default: "disallow",
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
			files: ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"],
			plugins: { boundaries },
			settings: {
				"boundaries/root-path": rootPath,
				"boundaries/elements": elements,
				"boundaries/files": files,
				"boundaries/dependency-nodes": ["import", "export", "require", "dynamic-import"],
				"boundaries/additional-dependency-nodes": [
					{ selector: "TSImportType > Literal", kind: "type", name: "type-import" },
					{ selector: "TSExternalModuleReference > Literal", kind: "value", name: "import-equals" },
				],
				"import/resolver": { typescript: { project: `${rootPath}/tsconfig.eslint.json` } },
			},
			rules,
		},
	];
};

export const defineConfig = (rootPath = process.cwd(), selection = readSelection(rootPath)) => [
	...baseBlocks({ selection, rootPath }),
	...policyBlocks(selection),
	...boundaryBlocks({ selection, rootPath }),
];
