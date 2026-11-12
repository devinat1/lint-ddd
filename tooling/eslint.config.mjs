import eslintConfigCodely from "eslint-config-codely";
import boundaries from "eslint-plugin-boundaries";
import { fileURLToPath } from "node:url";

import { codeRules, frontendRules, strictLintConfiguration } from "./eslint.rules.ts";
import { policyPlugin } from "./policyPlugin.ts";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
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
	{ category: "tooling", pattern: "*.config.mjs", exclusive: true },
];

export default [
	...eslintConfigCodely.full.filter((configuration) => configuration.ignores === undefined),
	{ ignores: ["node_modules/**", ".codegraph/**", "dist/**"] },
	{
		rules: {
			...codeRules,
			"check-file/folder-naming-convention": ["error", { "**/*": "+([a-zA-Z0-9\\[\\]\\(\\)\\.])" }],
		},
	},
	...strictLintConfiguration.map((configuration) => ({
		...configuration,
		languageOptions: {
			parserOptions: { ...configuration.languageOptions.parserOptions, tsconfigRootDir: rootPath },
		},
	})),
	{ plugins: { policy: policyPlugin }, rules: { "policy/comment-and-log": "error" } },
	{
		files: authoredTypescript,
		rules: {
			"policy/boolean-prefix": "error",
			"policy/named-parameters": "error",
			"policy/array-emptiness": "error",
			"policy/immutable-arrays": "error",
			"policy/parameter-mutation": "error",
			"no-param-reassign": ["error", { props: false }],
		},
	},
	{
		files: ["src/**/*.{ts,tsx}"],
		rules: {
			"policy/named-messages": "error",
			"policy/validated-input": "error",
			"@typescript-eslint/no-magic-numbers": [
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
			],
		},
	},
	{ files: ["src/{domain,ports}/**/*.ts"], rules: { "policy/optional-nullable": "error" } },
	{
		files: ["{src,tests}/**/*.{ts,tsx,js,jsx,mjs,cjs}"],
		rules: { "policy/typescript-tests": "error" },
	},
	{
		files: ["**/*.{tsx,jsx}"],
		rules: { ...frontendRules, "policy/static-tailwind": "error" },
	},
	{ files: ["src/presentation/**/*.tsx"], rules: { "policy/used-react-props": "error" } },
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
		rules: {
			"boundaries/no-unknown-files": "error",
			"boundaries/no-unknown-dependencies": "error",
			"boundaries/no-ignored-dependencies": "error",
			"boundaries/dependencies": [
				"error",
				{
					default: "disallow",
					checkAllOrigins: true,
					checkUnknownLocals: true,
					checkInternals: true,
					policies: [
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
					],
				},
			],
		},
	},
];
