#!/usr/bin/env node
/**
 * Страж выкатки. Не даёт закончить сессию с правками, которые остались только
 * на этом компьютере: следующий инструмент возьмёт устаревшую базу, а демо
 * будет жить на старом коммите.
 *
 * Срабатывает на Stop: если есть незакоммиченное или незапушенное — просит
 * прогнать `cd frontend && bun run ship "текст коммита"`.
 *
 * Напоминает не чаще раза в 5 минут: иначе после неудачной выкатки диалог
 * зациклился бы на одном и том же сообщении.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const git = (...args) => { try { return execFileSync("git", args, { encoding: "utf8" }).trim(); } catch { return ""; } };

const root = git("rev-parse", "--show-toplevel");
if (!root) process.exit(0);

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== "master") process.exit(0);

const dirty = git("status", "--porcelain");
const unpushed = git("log", "--oneline", "origin/master..HEAD");
if (!dirty && !unpushed) process.exit(0);

const stamp = join(root, ".git", "claude-ship-reminder");
const COOLDOWN = 5 * 60 * 1000;
if (existsSync(stamp)) {
  const last = Number(readFileSync(stamp, "utf8"));
  if (Number.isFinite(last) && Date.now() - last < COOLDOWN) process.exit(0);
}
writeFileSync(stamp, String(Date.now()));

const lines = [
  "Работа не доехала до git и до демо.",
  dirty ? `Незакоммиченное:\n${dirty}` : "",
  unpushed ? `Незапушенные коммиты:\n${unpushed}` : "",
  'Выкати одной командой: cd frontend && bun run ship "что сделали" — проверка, коммит, пуш и сборка демо.',
  "Если правки намеренно оставлены локальными — скажи это пользователю вслух и заверши.",
].filter(Boolean);

console.error(lines.join("\n\n"));
process.exit(2);
