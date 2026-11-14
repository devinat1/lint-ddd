import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { eslintConfigSource } from "../manifest.mjs";

const execFileAsync = promisify(execFile);
const bin = fileURLToPath(new URL("../../bin/lint-ddd.mjs", import.meta.url));
const roots = [];

const createRoot = async (packageJson = { name: "sample", version: "0.0.0" }) => {
	const root = await mkdtemp(join(tmpdir(), "lint-ddd-"));
	roots.push(root);
	await writeFile(join(root, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);

	return root;
};

after(async () => {
	await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

const run = async ({ cwd, args }) => {
	try {
		const result = await execFileAsync(process.execPath, [bin, ...args], { cwd, encoding: "utf8" });

		return { code: 0, stdout: result.stdout, stderr: result.stderr };
	} catch (error) {
		const code = typeof error.code === "number" ? error.code : 1;
		const stdout = typeof error.stdout === "string" ? error.stdout : "";
		const stderr = typeof error.stderr === "string" ? error.stderr : "";

		return { code, stdout, stderr };
	}
};

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));

test("init writes a partial selection, dependencies, and no install", async () => {
	const root = await createRoot({
		name: "sample",
		version: "0.0.0",
		devDependencies: { "lint-ddd": "file:../lint-ddd", left: "1.0.0" },
	});
	const result = await run({
		cwd: root,
		args: [
			"init",
			"--only",
			"policy-conventions",
			"--on",
			"policy/validated-input",
			"--off",
			"policy/boolean-prefix",
		],
	});
	assert.equal(result.code, 0, result.stderr);
	assert.match(result.stderr, /tsconfig\.eslint\.json is missing/);
	assert.deepEqual(await readJson(join(root, "lint-ddd.config.json")), {
		groups: ["policy-conventions"],
		on: ["policy/validated-input"],
		off: ["policy/boolean-prefix"],
	});
	assert.equal(await readFile(join(root, "eslint.config.mjs"), "utf8"), eslintConfigSource);
	const packageJson = await readJson(join(root, "package.json"));
	assert.equal(packageJson.devDependencies["lint-ddd"], "file:../lint-ddd");
	assert.equal(packageJson.devDependencies.left, "1.0.0");
	assert.equal(typeof packageJson.devDependencies.eslint, "string");
	assert.equal(typeof packageJson.devDependencies.typescript, "string");
	await assert.rejects(access(join(root, "node_modules")));
});

test("enable and disable update the manifest without dropping exceptions", async () => {
	const root = await createRoot();
	assert.equal(
		(await run({ cwd: root, args: ["init", "--only", "policy-conventions", "--off", "policy/boolean-prefix"] }))
			.code,
		0,
	);
	assert.equal((await run({ cwd: root, args: ["enable", "presentation"] })).code, 0);
	assert.equal((await run({ cwd: root, args: ["disable", "policy-conventions"] })).code, 0);
	assert.equal((await run({ cwd: root, args: ["enable", "policy/boolean-prefix"] })).code, 0);
	assert.equal((await run({ cwd: root, args: ["disable", "policy/named-parameters"] })).code, 0);
	assert.deepEqual(await readJson(join(root, "lint-ddd.config.json")), {
		groups: ["presentation"],
		on: ["policy/boolean-prefix"],
		off: ["policy/named-parameters"],
	});
});

test("init replaces an existing selection and still refuses a foreign config", async () => {
	const root = await createRoot();
	const first = await run({ cwd: root, args: ["init", "--only", "codely"] });
	assert.equal(first.code, 0, first.stderr);
	const installed = await readJson(join(root, "package.json"));
	delete installed.devDependencies.eslint;
	await writeFile(join(root, "package.json"), `${JSON.stringify(installed, null, 2)}\n`);
	const unchanged = await readFile(join(root, "lint-ddd.config.json"), "utf8");
	const blocked = await run({ cwd: root, args: ["init"] });
	assert.equal(blocked.code, 1);
	assert.match(blocked.stderr, /no terminal/);
	assert.equal(await readFile(join(root, "lint-ddd.config.json"), "utf8"), unchanged);
	const second = await run({ cwd: root, args: ["init", "--only", "boundaries"] });
	assert.equal(second.code, 0, second.stderr);
	assert.deepEqual(await readJson(join(root, "lint-ddd.config.json")), {
		groups: ["boundaries"],
		on: [],
		off: [],
	});
	assert.equal(await readFile(join(root, "eslint.config.mjs"), "utf8"), eslintConfigSource);
	assert.equal(typeof (await readJson(join(root, "package.json"))).devDependencies.eslint, "string");

	const foreign = await createRoot();
	await writeFile(join(foreign, "eslint.config.mjs"), "export default [];\n");
	const packageBefore = await readFile(join(foreign, "package.json"), "utf8");
	const refused = await run({ cwd: foreign, args: ["init", "--only", "codely"] });
	assert.equal(refused.code, 1);
	assert.match(refused.stderr, /eslint\.config\.mjs already exists/);
	await assert.rejects(access(join(foreign, "lint-ddd.config.json")));
	assert.equal(await readFile(join(foreign, "package.json"), "utf8"), packageBefore);

	const owned = await createRoot();
	assert.equal((await run({ cwd: owned, args: ["init", "--only", "codely"] })).code, 0);
	await writeFile(join(owned, "eslint.config.mjs"), "export default [];\n");
	const ownedConfig = await readFile(join(owned, "lint-ddd.config.json"), "utf8");
	const ownedPackage = await readFile(join(owned, "package.json"), "utf8");
	const ownedRefusal = await run({ cwd: owned, args: ["init", "--only", "boundaries"] });
	assert.equal(ownedRefusal.code, 1);
	assert.match(ownedRefusal.stderr, /eslint\.config\.mjs already exists/);
	assert.equal(await readFile(join(owned, "lint-ddd.config.json"), "utf8"), ownedConfig);
	assert.equal(await readFile(join(owned, "package.json"), "utf8"), ownedPackage);

	const silent = await createRoot();
	const noFlags = await run({ cwd: silent, args: ["init"] });
	assert.equal(noFlags.code, 1);
	assert.match(noFlags.stderr, /no terminal/);
	await assert.rejects(access(join(silent, "lint-ddd.config.json")));

	const empty = await mkdtemp(join(tmpdir(), "lint-ddd-"));
	roots.push(empty);
	const missing = await run({ cwd: empty, args: ["init", "--full"] });
	assert.equal(missing.code, 1);
	assert.match(missing.stderr, /package\.json is missing/);

	const conflict = await createRoot();
	const combined = await run({ cwd: conflict, args: ["init", "--full", "--only", "codely"] });
	assert.equal(combined.code, 1);
	await assert.rejects(access(join(conflict, "lint-ddd.config.json")));
});

test("published files run inside node_modules", async () => {
	const build = fileURLToPath(new URL("../build.mjs", import.meta.url));
	await execFileAsync(process.execPath, [build]);
	const packageRoot = fileURLToPath(new URL("../../node_modules/.lint-ddd-publish/", import.meta.url));
	roots.push(packageRoot);
	await rm(packageRoot, { recursive: true, force: true });
	await mkdir(packageRoot, { recursive: true });
	await cp(fileURLToPath(new URL("../../dist", import.meta.url)), join(packageRoot, "dist"), { recursive: true });
	await cp(fileURLToPath(new URL("../../package.json", import.meta.url)), join(packageRoot, "package.json"));
	const project = await createRoot();
	const result = await execFileAsync(
		process.execPath,
		[join(packageRoot, "dist", "bin", "lint-ddd.mjs"), "init", "--only", "boundaries"],
		{ cwd: project, encoding: "utf8" },
	);
	assert.match(result.stderr, /tsconfig\.eslint\.json is missing/);
	assert.deepEqual(JSON.parse(await readFile(join(project, "lint-ddd.config.json"), "utf8")).groups, ["boundaries"]);

	const configUrl = pathToFileURL(join(packageRoot, "dist", "tooling", "eslint.config.mjs")).href;
	await execFileAsync(process.execPath, [
		"--input-type=module",
		"--eval",
		`const loaded = await import(${JSON.stringify(configUrl)}); if (typeof loaded.defineConfig !== "function") process.exit(1);`,
	]);
});

test("enable requires an existing manifest", async () => {
	const root = await createRoot();
	const result = await run({ cwd: root, args: ["enable", "boundaries"] });
	assert.equal(result.code, 1);
	assert.match(result.stderr, /missing/);
});
