import { ESLint } from "eslint";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { after, test } from "node:test";

process.env.TSESTREE_SINGLE_RUN = "false";
const paths = {
	domain: "src/domain/lintPolicyFixture.ts",
	ports: "src/ports/lintPolicyFixture.ts",
	application: "src/application/lintPolicyFixture.ts",
	primary: "src/adapters/primary/web/lintPolicyFixture.ts",
	secondary: "src/adapters/secondary/random/lintPolicyFixture.ts",
	otherSecondary: "src/adapters/secondary/fixed/lintPolicyFixture.ts",
	composition: "src/composition/lintPolicyFixture.ts",
	presentation: "src/presentation/lintPolicyFixture.tsx",
	unknown: "src/unclassified/lintPolicyFixture.ts",
	domainTest: "src/domain/fixture.test.ts",
	domainSpec: "src/domain/fixture.spec.ts",
	domainTsxTest: "src/domain/view.test.tsx",
	domainJsTest: "src/domain/fixture.test.js",
};
await Promise.all(
	Object.values(paths).map(async (path) => {
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, "export type Fixture = number;\n", { flag: "wx" });
	}),
);
after(async () => {
	await Promise.all(Object.values(paths).map((path) => rm(path)));
});
const eslint = new ESLint();
const check = async ({ filePath, code, shouldFail, rule = "boundaries/dependencies" }) => {
	const [result] = await eslint.lintText(code, { filePath });
	assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
	assert.equal(
		result.messages.some((message) => message.ruleId === null),
		false,
		JSON.stringify(result.messages),
	);
	assert.equal(
		result.messages.some((message) => message.ruleId === rule),
		shouldFail,
		`${filePath}: ${code}`,
	);
	if (rule === "boundaries/dependencies") {
		assert.equal(
			result.messages.some((message) => message.ruleId === "boundaries/no-unknown-files"),
			false,
			JSON.stringify(result.messages),
		);
		assert.equal(
			result.messages.some((message) => message.ruleId === "boundaries/no-unknown-dependencies"),
			false,
			JSON.stringify(result.messages),
		);
	}
};

test("domain cannot import application, ports, adapters or composition", async () => {
	await Promise.all(
		[
			"../application/lintPolicyFixture.ts",
			"../ports/lintPolicyFixture.ts",
			"../adapters/secondary/random/lintPolicyFixture.ts",
			"../composition/lintPolicyFixture.ts",
		].map((target) => check({ filePath: paths.domain, code: `import '${target}';`, shouldFail: true })),
	);
	await check({ filePath: paths.domain, code: "export const value = 1;", shouldFail: false });
});

test("ports may use domain but not application", async () => {
	await check({ filePath: paths.ports, code: "import '../domain/lintPolicyFixture.ts';", shouldFail: false });
	await check({ filePath: paths.ports, code: "import '../application/lintPolicyFixture.ts';", shouldFail: true });
});

test("application may use a port but not a concrete adapter", async () => {
	await check({ filePath: paths.application, code: "import '../ports/lintPolicyFixture.ts';", shouldFail: false });
	await check({ filePath: paths.application, code: "import '../domain/lintPolicyFixture.ts';", shouldFail: false });
	await check({
		filePath: paths.application,
		code: "import '../adapters/secondary/random/lintPolicyFixture.ts';",
		shouldFail: true,
	});
});

test("composition may connect application, ports and both adapter roles", async () => {
	await check({
		filePath: paths.composition,
		code: [
			"../application/lintPolicyFixture.ts",
			"../ports/lintPolicyFixture.ts",
			"../adapters/secondary/random/lintPolicyFixture.ts",
			"../adapters/primary/web/lintPolicyFixture.ts",
		]
			.map((target) => `import '${target}';`)
			.join("\n"),
		shouldFail: false,
	});
});

test("primary adapters may call application but not secondary adapters", async () => {
	await check({
		filePath: paths.primary,
		code: "import '../../../application/lintPolicyFixture.ts';",
		shouldFail: false,
	});
	await check({
		filePath: paths.primary,
		code: "import '../../secondary/random/lintPolicyFixture.ts';",
		shouldFail: true,
	});
});

test("secondary adapters use ports, never application or independent adapters", async () => {
	await check({
		filePath: paths.secondary,
		code: "import '../../../ports/lintPolicyFixture.ts';",
		shouldFail: false,
	});
	await check({
		filePath: paths.secondary,
		code: "import '../../../application/lintPolicyFixture.ts';",
		shouldFail: true,
	});
	await check({
		filePath: paths.secondary,
		code: "import '../../primary/web/lintPolicyFixture.ts';",
		shouldFail: true,
	});
	await check({ filePath: paths.secondary, code: "import '../fixed/lintPolicyFixture.ts';", shouldFail: true });
});

test("presentation imports composition, not concrete adapters", async () => {
	await check({
		filePath: paths.presentation,
		code: "import '../composition/lintPolicyFixture.ts';",
		shouldFail: false,
	});
	await check({
		filePath: paths.presentation,
		code: "import '../adapters/secondary/random/lintPolicyFixture.ts';",
		shouldFail: true,
	});
});

test("type imports, reexports, dynamic imports and require cannot bypass boundaries", async () => {
	const target = "../adapters/secondary/random/lintPolicyFixture.ts";
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

test("core cannot import Node or framework libraries", async () => {
	await check({ filePath: paths.domain, code: "import 'node:fs';", shouldFail: true });
	await check({ filePath: paths.application, code: "import 'node:http';", shouldFail: true });
	await check({ filePath: paths.ports, code: "import 'typescript';", shouldFail: true });
	await check({ filePath: paths.secondary, code: "import 'node:crypto';", shouldFail: false });
});

test("unclassified source files are rejected", async () => {
	await check({
		filePath: paths.unknown,
		code: "export const value = 1;",
		shouldFail: true,
		rule: "boundaries/no-unknown-files",
	});
});

test("shared conventions are active in TypeScript", async () => {
	await Promise.all(
		[
			["let value = 1;", "no-restricted-syntax"],
			["export const won = true;", "policy/boolean-prefix"],
			["export const join = (left: string, right: string): string => left + right;", "policy/named-parameters"],
			["declare const values: number[]; if (values.length) {}", "policy/array-emptiness"],
			["const values: number[] = []; values.push(1);", "policy/immutable-arrays"],
			[
				"export const change = (value: { count: number }): void => { value.count = 1; };",
				"policy/parameter-mutation",
			],
			["export const value: any = 1;", "@typescript-eslint/no-explicit-any"],
			[
				"declare const value: unknown; export const name = value as string;",
				"@typescript-eslint/no-unsafe-type-assertion",
			],
			["JSON.parse('{}');", "policy/validated-input"],
			["throw new Error('Failure.');", "policy/named-messages"],
		].map(([code, rule]) => check({ filePath: paths.application, code, rule, shouldFail: true })),
	);
	await check({
		filePath: paths.application,
		code: "export const hasWon = true;",
		rule: "policy/boolean-prefix",
		shouldFail: false,
	});
});

test("product tests must be TypeScript .test.ts files", async () => {
	await check({
		filePath: paths.domainJsTest,
		code: "export const value = 1;\n",
		rule: "policy/typescript-tests",
		shouldFail: true,
	});
	await check({
		filePath: paths.domainSpec,
		code: "export const value = 1;\n",
		rule: "policy/typescript-tests",
		shouldFail: true,
	});
	await check({
		filePath: paths.domainTsxTest,
		code: "export const value = 1;\n",
		rule: "policy/typescript-tests",
		shouldFail: true,
	});
	await check({
		filePath: paths.domainTest,
		code: "export const value = 1;\n",
		rule: "policy/typescript-tests",
		shouldFail: false,
	});
	await check({
		filePath: "tooling/tests/architecture.test.mjs",
		code: "export const value = 1;\n",
		rule: "policy/typescript-tests",
		shouldFail: false,
	});
});

test("errors are classified by class or code, not message text", async () => {
	await check({
		filePath: paths.application,
		code: "declare const error: Error; export const matched = error.message === 'nope';\n",
		rule: "no-restricted-syntax",
		shouldFail: true,
	});
	await check({
		filePath: paths.application,
		code: "declare const error: Error; const messages: string[] = []; export const matched = messages.includes(error.message);\n",
		rule: "no-restricted-syntax",
		shouldFail: true,
	});
});

test("product code cannot import a colocated test, and same-adapter files can import each other", async () => {
	await check({
		filePath: paths.domain,
		code: 'import "./fixture.test.ts";\n',
		shouldFail: true,
	});
	await check({
		filePath: paths.secondary,
		code: 'import "./lintPolicyFixture.ts";\n',
		shouldFail: false,
	});
});

test("frontend rules reject inline styling and margin spacing", async () => {
	await check({
		filePath: paths.presentation,
		code: "export const view = <div style={{ color: 'red' }} />;",
		rule: "no-restricted-syntax",
		shouldFail: true,
	});
	await check({
		filePath: paths.presentation,
		code: "export const view = <div className='mt-2' />;",
		rule: "policy/static-tailwind",
		shouldFail: true,
	});
	await check({
		filePath: paths.presentation,
		code: "export const view = <div className='gap-2 p-4' />;",
		rule: "policy/static-tailwind",
		shouldFail: false,
	});
});
