#!/usr/bin/env node
/**
 * Одна команда на всю выкатку: проверка → коммит → пуш → сборка демо.
 *
 *   cd frontend && bun run ship "текст коммита"
 *
 * Раньше это были три отдельных шага, и каждый инструмент решал заново, делать
 * их или нет: правки оставались локальными, демо жило на старом коммите, а
 * следующая сессия начиналась с устаревшей базы. Здесь решать нечего —
 * либо всё прошло, либо скрипт остановился и сказал, на чём.
 *
 * Флаги:
 *   --no-check  пропустить `bun run check` (только если он уже прогнан руками)
 *   --wait      дождаться подтверждения, что демо собралось
 */
import { spawnSync } from "node:child_process";

const WIN = process.platform === "win32";
// git и node зовём напрямую: под shell на Windows многословный текст коммита
// разлетается на отдельные аргументы. Через shell идёт только bun.
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { stdio: "inherit", ...opts });
const runShell = (cmd, args) => spawnSync(cmd, args, { stdio: "inherit", shell: WIN });
const out = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8" }).stdout?.trim() ?? "";
const die = (msg) => { console.error(`\n✗ ${msg}`); process.exit(1); };

const argv = process.argv.slice(2);
const skipCheck = argv.includes("--no-check");
const wait = argv.includes("--wait");
const message = argv.filter((a) => !a.startsWith("--")).join(" ").trim();

const branch = out("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
if (branch !== "master") die(`Демо собирается только с master, а сейчас ${branch}.`);

const dirty = out("git", ["status", "--porcelain"]);
const unpushed = out("git", ["log", "--oneline", "origin/master..HEAD"]);
if (!dirty && !unpushed) { console.log("Нечего выкатывать: рабочее дерево чистое и всё запушено."); process.exit(0); }
if (dirty && !message) die('Нужен текст коммита: bun run ship "что сделали"');

if (!skipCheck) {
  console.log("→ Проверка (типы, тесты, миграции)…");
  if (runShell("bun", ["run", "check"]).status !== 0) die("Проверка не прошла — выкатывать нечего. Почини и повтори.");
}

if (dirty) {
  console.log("→ Коммит…");
  if (run("git", ["add", "-A"]).status !== 0) die("git add не отработал.");
  if (run("git", ["commit", "-m", message]).status !== 0) die("git commit не отработал.");
}

console.log("→ Пуш и сборка демо…");
const deploy = run(process.execPath, ["scripts/deploy-demo.mjs", ...(wait ? ["--wait"] : [])]);
if (deploy.status !== 0) die("Выкатка не удалась. Смотри сообщение выше.");
