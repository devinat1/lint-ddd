import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { changeNames, choicesFromAnswer, groupNames, ruleIds, selectionFromFlags } from "./catalog.ts";
import { eslintConfigSource, isOurEslintConfig, readSelection, writeSelection } from "./manifest.mjs";

const dependencyNames = [
	"eslint",
	"typescript",
	"eslint-config-codely",
	"eslint-plugin-boundaries",
	"eslint-import-resolver-typescript",
	"@typescript-eslint/utils",
];

const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const readJson = (filePath) => {
	try {
		return JSON.parse(readFileSync(filePath, "utf8"));
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown failure.";
		throw new Error(`Could not read ${filePath}. ${message.endsWith(".") ? message : `${message}.`}`);
	}
};

const ourPackage = readJson(fileURLToPath(new URL("../package.json", import.meta.url)));
if (typeof ourPackage.version !== "string") {
	throw new Error("lint-ddd package version is missing.");
}

const rangeOf = (name) => {
	const range =
		ourPackage.dependencies?.[name] ?? ourPackage.peerDependencies?.[name] ?? ourPackage.devDependencies?.[name];
	if (typeof range !== "string") {
		throw new Error(`Missing dependency range for ${name}.`);
	}

	return range;
};

const splitList = (value) =>
	value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item !== "");

const parseArgv = (argv) => {
	const [command, ...tokens] = argv;
	if (command === undefined) {
		throw new Error("Usage: lint-ddd init, enable, or disable.");
	}
	const parsed = tokens.reduce(
		(state, token, index, all) => {
			if (state.shouldSkip) {
				return { ...state, shouldSkip: false };
			}
			if (token === "--full") {
				return { ...state, isFull: true };
			}
			if (token === "--only" || token === "--on" || token === "--off") {
				const value = all[index + 1];
				if (value === undefined || value.startsWith("--")) {
					throw new Error(`${token} needs a comma-separated list.`);
				}
				const key = token.slice("--".length);

				return { ...state, [key]: [...state[key], ...splitList(value)], shouldSkip: true };
			}
			if (token.startsWith("--")) {
				throw new Error(`Unknown flag ${token}.`);
			}

			return { ...state, positionals: [...state.positionals, token] };
		},
		{ isFull: false, only: [], on: [], off: [], positionals: [], shouldSkip: false },
	);

	return { command, ...parsed };
};

const ask = async ({ prompt, choices, rl }) => {
	stdout.write(`${prompt}\n`);
	choices.forEach((choice, index) => {
		stdout.write(`${index + 1}. ${choice}\n`);
	});
	stdout.write("Comma-separated numbers, or empty for none:\n");

	return choicesFromAnswer({ answer: await rl.question(""), choices });
};

const promptSelection = async () => {
	const rl = createInterface({ input: stdin, output: stdout });
	try {
		const only = await ask({ prompt: "Groups.", choices: groupNames, rl });
		const on = await ask({ prompt: "Rules to force on.", choices: ruleIds, rl });
		const off = await ask({ prompt: "Rules to force off.", choices: ruleIds, rl });

		return selectionFromFlags({ isFull: false, only, on, off });
	} finally {
		rl.close();
	}
};

const chooseSelection = async (parsed) => {
	const hasFlags = parsed.isFull || parsed.only.length !== 0 || parsed.on.length !== 0 || parsed.off.length !== 0;
	if (hasFlags) {
		return selectionFromFlags({ isFull: parsed.isFull, only: parsed.only, on: parsed.on, off: parsed.off });
	}
	if (!stdin.isTTY || !stdout.isTTY) {
		throw new Error("Pass --full or --only when there is no terminal.");
	}

	return promptSelection();
};

const withDevDependencies = (packageManifest) => {
	const devDependencies = isRecord(packageManifest.devDependencies) ? packageManifest.devDependencies : {};
	const current = devDependencies["lint-ddd"];
	const keepsLocal = typeof current === "string" && (current.startsWith("file:") || current.startsWith("link:"));
	const added = Object.fromEntries(dependencyNames.map((name) => [name, rangeOf(name)]));

	return {
		...packageManifest,
		devDependencies: {
			...devDependencies,
			...added,
			"lint-ddd": keepsLocal ? current : `^${ourPackage.version}`,
		},
	};
};

const init = async (parsed) => {
	const rootPath = process.cwd();
	const packagePath = join(rootPath, "package.json");
	if (!existsSync(packagePath)) {
		throw new Error("package.json is missing.");
	}
	const packageManifest = readJson(packagePath);
	if (!isRecord(packageManifest)) {
		throw new Error("package.json must be an object.");
	}
	const eslintPath = join(rootPath, "eslint.config.mjs");
	if (existsSync(eslintPath) && !isOurEslintConfig(readFileSync(eslintPath, "utf8"))) {
		throw new Error("eslint.config.mjs already exists.");
	}
	if (existsSync(join(rootPath, "lint-ddd.config.json"))) {
		throw new Error("lint-ddd.config.json already exists.");
	}
	const selection = await chooseSelection(parsed);
	const nextPackage = withDevDependencies(packageManifest);
	writeSelection(rootPath, selection);
	if (!existsSync(eslintPath)) {
		writeFileSync(eslintPath, eslintConfigSource);
	}
	writeFileSync(packagePath, `${JSON.stringify(nextPackage, null, 2)}\n`);
	if (!existsSync(join(rootPath, "tsconfig.eslint.json"))) {
		console.error("warning: tsconfig.eslint.json is missing. The strict-types group needs that file.");
	}
};

const updateSelection = ({ names, isEnable }) => {
	if (names.length === 0) {
		throw new Error("Name at least one group or rule.");
	}
	const rootPath = process.cwd();
	writeSelection(rootPath, changeNames({ selection: readSelection(rootPath), names, isEnable }));
};

const main = async () => {
	const parsed = parseArgv(process.argv.slice(2));
	if (parsed.command === "init") {
		if (parsed.positionals.length !== 0) {
			throw new Error("init does not take positional arguments.");
		}
		await init(parsed);

		return;
	}
	if (parsed.command !== "enable" && parsed.command !== "disable") {
		throw new Error(`Unknown command ${parsed.command}.`);
	}
	if (parsed.isFull || parsed.only.length !== 0 || parsed.on.length !== 0 || parsed.off.length !== 0) {
		throw new Error("enable and disable take group or rule names, not flags.");
	}
	updateSelection({ names: parsed.positionals, isEnable: parsed.command === "enable" });
};

try {
	await main();
} catch (error) {
	const message = error instanceof Error ? error.message : "Unknown failure.";
	console.error(message.endsWith(".") ? message : `${message}.`);
	process.exitCode = 1;
}
