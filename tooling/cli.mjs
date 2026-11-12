import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import { emitKeypressEvents } from "node:readline";
import { fileURLToPath } from "node:url";

import { changeNames, checklistStep, groupNames, groups, ruleIds, selectionFromFlags } from "./catalog.ts";
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

const keyName = (key) => {
	if (key === undefined) {
		return "";
	}
	if (key.ctrl === true && key.name === "c") {
		return "cancel";
	}
	if (key.name === "space" || key.sequence === " ") {
		return "space";
	}
	if (key.name === "return" || key.name === "enter") {
		return "return";
	}
	if (key.name === "up" || key.name === "down") {
		return key.name;
	}

	return "";
};

const groupDetails = Object.fromEntries(groups.map((group) => [group.name, group.detail]));

const checklistLines = ({ prompt, choices, details, state }) => {
	const screenRows = stdout.rows > 0 ? stdout.rows : 24;
	const screenColumns = stdout.columns > 0 ? stdout.columns : 80;
	const room = Math.max(1, screenRows - 3);
	const size = Math.min(choices.length, room);
	const start = Math.min(Math.max(0, state.cursor - Math.floor((size - 1) / 2)), Math.max(0, choices.length - size));
	const width = Math.max(20, screenColumns - 1);
	const nameWidth =
		details === undefined || choices.length === 0 ? 0 : Math.max(...choices.map((choice) => choice.length));
	const fit = (line) => (line.length > width ? line.slice(0, width) : line);
	const rows = choices.slice(start, start + size).map((choice, offset) => {
		const index = start + offset;
		const pointer = index === state.cursor ? ">" : " ";
		const mark = state.selected.includes(index) ? "x" : " ";
		const detail = details?.[choice];
		const label = detail === undefined ? choice : `${choice.padEnd(nameWidth)}  ${detail}`;

		return fit(`${pointer} [${mark}] ${label}`);
	});

	return [fit(prompt), ...rows, "arrows move, space select, enter confirm"];
};

const ask = ({ prompt, choices, details }) =>
	new Promise((resolve) => {
		const session = { state: { cursor: 0, selected: [] }, onKeypress: undefined };
		const stop = () => {
			if (session.onKeypress !== undefined) {
				stdin.off("keypress", session.onKeypress);
			}
			stdin.setRawMode(false);
			stdin.pause();
		};
		const paint = () => {
			stdout.write(
				`\x1b[H\x1b[J${checklistLines({ prompt, choices, details, state: session.state }).join("\n")}`,
			);
		};
		const finish = (line) => {
			stop();
			stdout.write(line === undefined ? "\x1b[?25h\x1b[?1049l" : `\x1b[?25h\x1b[?1049l${line}\n`);
		};
		session.onKeypress = (_char, key) => {
			const name = keyName(key);
			if (name === "cancel") {
				finish();
				process.exitCode = 130;

				return;
			}
			const next = checklistStep({ name, state: session.state, count: choices.length });
			session.state = next.state;
			if (!next.isDone) {
				if (next.shouldDraw) {
					paint();
				}

				return;
			}
			const picked = choices.filter((_choice, index) => session.state.selected.includes(index));
			const summary = picked.join(", ");
			finish(`${prompt} ${summary === "" ? "(none)" : summary}`);
			resolve(picked);
		};
		emitKeypressEvents(stdin);
		stdin.setRawMode(true);
		stdin.resume();
		stdout.write("\x1b[?1049h\x1b[?25l");
		paint();
		stdin.on("keypress", session.onKeypress);
	});

const promptSelection = async () => {
	const only = await ask({ prompt: "Groups.", choices: groupNames, details: groupDetails });
	const on = await ask({ prompt: "Rules to force on.", choices: ruleIds });
	const off = await ask({ prompt: "Rules to force off.", choices: ruleIds });

	return selectionFromFlags({ isFull: false, only, on, off });
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
