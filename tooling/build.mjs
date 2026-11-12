import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

// ponytail: emit JS before publish. Node will not strip .ts files inside node_modules.
const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const copies = ["bin/lint-ddd.mjs", "tooling/cli.mjs", "tooling/manifest.mjs", "tooling/eslint.config.mjs"];

const rewrite = ({ source, relativePath }) => {
	const importsRewritten = source.replaceAll(/from "(\.[^"]+)\.ts"/g, 'from "$1.js"');
	if (relativePath !== "tooling/cli.mjs") {
		return importsRewritten;
	}

	return importsRewritten.replaceAll(
		'new URL("../package.json", import.meta.url)',
		'new URL("../../package.json", import.meta.url)',
	);
};

await rm(dist, { recursive: true, force: true });
await execFileAsync(process.execPath, [join(root, "node_modules/typescript/lib/tsc.js"), "-p", "tsconfig.build.json"], {
	cwd: root,
});
await Promise.all(
	copies.map(async (relativePath) => {
		const source = await readFile(join(root, relativePath), "utf8");
		const target = join(dist, relativePath);
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, rewrite({ source, relativePath }));
	}),
);
