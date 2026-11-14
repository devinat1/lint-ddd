import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import { emitKeypressEvents } from "node:readline";
import { fileURLToPath } from "node:url";

import {
	changeNames,
	checklistStep,
	groups,
	selectionFromFlags,
	selectionFromTree,
	treeFromSelection,
} from "./catalog.ts";
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
	if (key.name === "up" || key.name === "down" || key.name === "left" || key.name === "right") {
		return key.name;
	}

	return "";
};

const fitLine = ({ line, width }) => (line.length > width ? line.slice(0, width) : line);

const pointsAt = ({ state, group, rule }) => state.cursor.group === group && state.cursor.rule === rule;

const groupMark = ({ state, index }) => {
	const rules = state.rulesOn[index] ?? [];
	if (rules.length === 0) {
		return state.emptyOn.includes(index) ? "x" : " ";
	}
	if (rules.every((isOn) => isOn)) {
		return "x";
	}
	if (rules.some((isOn) => isOn)) {
		return "-";
	}

	return " ";
};

const childLine = ({ state, group, rule, ruleIndex, ruleCount, width }) => {
	const branch = ruleIndex === ruleCount - 1 ? "└─" : "├─";
	const prefix = pointsAt({ state, group, rule: ruleIndex }) ? "    > " : "      ";
	const mark = state.rulesOn[group]?.[ruleIndex] === true ? "x" : " ";

	return fitLine({ line: `${prefix}${branch} [${mark}] ${rule}`, width });
};

const groupBlock = ({ state, group, index, nameWidth, width }) => {
	const pointer = pointsAt({ state, group: index, rule: null }) ? ">" : " ";
	const mark = groupMark({ state, index });
	const isOpen = state.expanded === index;
	const glyph = group.rules.length === 0 ? "  " : ` ${isOpen ? "▾" : "▸"}`;
	const line = fitLine({
		line: `${pointer} [${mark}] ${group.name.padEnd(nameWidth)}${glyph}  ${group.detail}`,
		width,
	});
	const children = isOpen
		? group.rules.map((rule, ruleIndex) =>
				childLine({ state, group: index, rule, ruleIndex, ruleCount: group.rules.length, width }),
			)
		: [];

	return [line, ...children];
};

const treeLines = ({ prompt, state }) => {
	const screenRows = stdout.rows > 0 ? stdout.rows : 24;
	const screenColumns = stdout.columns > 0 ? stdout.columns : 80;
	const width = Math.max(20, screenColumns - 1);
	const nameWidth = Math.max(...groups.map((group) => group.name.length));
	const drawn = groups.reduce(
		(acc, group, index) => {
			const block = groupBlock({ state, group, index, nameWidth, width });
			const local = block.findIndex((_, row) =>
				pointsAt({ state, group: index, rule: row === 0 ? null : row - 1 }),
			);

			return {
				rows: [...acc.rows, ...block],
				cursorRow: local === -1 ? acc.cursorRow : acc.rows.length + local,
			};
		},
		{ rows: [], cursorRow: 0 },
	);
	const { rows, cursorRow } = drawn;
	const room = Math.max(1, screenRows - 3);
	const size = Math.min(rows.length, room);
	const preferred = cursorRow - Math.floor((size - 1) / 2);
	const start = Math.min(Math.max(0, preferred), Math.max(0, rows.length - size));

	return [
		fitLine({ line: prompt, width }),
		...rows.slice(start, start + size),
		"arrows move, left/right expand, space selects, enter confirms",
	];
};

const ask = ({ prompt, state }) =>
	new Promise((resolve) => {
		const session = { state, onKeypress: undefined };
		const stop = () => {
			if (session.onKeypress !== undefined) {
				stdin.off("keypress", session.onKeypress);
			}
			stdin.setRawMode(false);
			stdin.pause();
		};
		const paint = () => {
			stdout.write(`\x1b[H\x1b[J${treeLines({ prompt, state: session.state }).join("\n")}`);
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
			const next = checklistStep({ name, state: session.state });
			session.state = next.state;
			if (!next.isDone) {
				if (next.shouldDraw) {
					paint();
				}

				return;
			}
			const summary = selectionFromTree({ state: session.state, catalog: groups }).groups.join(", ");
			finish(`${prompt} ${summary === "" ? "(none)" : summary}`);
			resolve(session.state);
		};
		emitKeypressEvents(stdin);
		stdin.setRawMode(true);
		stdin.resume();
		stdout.write("\x1b[?1049h\x1b[?25l");
		paint();
		stdin.on("keypress", session.onKeypress);
	});

const promptSelection = async ({ selection }) =>
	selectionFromTree({
		state: await ask({ prompt: "Groups.", state: treeFromSelection({ selection, catalog: groups }) }),
		catalog: groups,
	});

const chooseSelection = async ({ parsed, current }) => {
	const hasFlags = parsed.isFull || parsed.only.length !== 0 || parsed.on.length !== 0 || parsed.off.length !== 0;
	if (hasFlags) {
		return selectionFromFlags({ isFull: parsed.isFull, only: parsed.only, on: parsed.on, off: parsed.off });
	}
	if (!stdin.isTTY || !stdout.isTTY) {
		throw new Error("Pass --full or --only when there is no terminal.");
	}

	return promptSelection({ selection: current });
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
	const configPath = join(rootPath, "lint-ddd.config.json");
	const current = existsSync(configPath) ? readSelection(rootPath) : { groups: [], on: [], off: [] };
	const selection = await chooseSelection({ parsed, current });
	const nextPackage = withDevDependencies(packageManifest);
	writeSelection(rootPath, selection);
	writeFileSync(eslintPath, eslintConfigSource);
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
