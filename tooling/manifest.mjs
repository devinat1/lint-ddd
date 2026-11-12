import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { orderSelection, parseSelection } from "./catalog.ts";

export const manifestName = "lint-ddd.config.json";
export const eslintConfigSource = `import { defineConfig } from "lint-ddd";

export default defineConfig();
`;

export const isOurEslintConfig = (source) => source.trim() === eslintConfigSource.trim();

const readJson = (filePath) => {
	try {
		return JSON.parse(readFileSync(filePath, "utf8"));
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown failure.";
		throw new Error(`Could not read ${filePath}. ${message.endsWith(".") ? message : `${message}.`}`);
	}
};

export const readSelection = (rootPath) => {
	const filePath = join(rootPath, manifestName);
	if (!existsSync(filePath)) {
		throw new Error("lint-ddd.config.json is missing. Run lint-ddd init first.");
	}

	return parseSelection(readJson(filePath));
};

export const writeSelection = (rootPath, selection) => {
	writeFileSync(join(rootPath, manifestName), `${JSON.stringify(orderSelection(selection), null, 2)}\n`);
};
