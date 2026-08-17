#!/usr/bin/env node
/**
 * Проверка типов, которая не спотыкается о протухший кэш Next.
 *
 * `.next/types/**` попадает в tsconfig и живёт от прошлых сборок: удалили роут —
 * его сгенерированный тип остался и ссылается на исчезнувший модуль. Локально
 * это валило `bun run check` (и вместе с ним `ship`), хотя исходники чистые.
 * Кэш типов Next пересобирает сам на следующем `next dev`/`next build`, поэтому
 * просто сносим его перед tsc.
 */
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
rmSync(join(root, ".next", "types"), { recursive: true, force: true });

// Зовём сам tsc из пакета: в .bin у bun лежат обёртки, которых на Windows нет.
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
const res = spawnSync(process.execPath, [tsc, "--noEmit"], { stdio: "inherit", cwd: root });
process.exit(res.status ?? 1);
