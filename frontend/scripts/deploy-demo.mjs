#!/usr/bin/env node
/**
 * Выкатка демо: пуш в master, дальше GitHub Actions собирает и публикует сам.
 *
 * Скрипт не ждёт сборку и ничего не опрашивает — именно ожидание и делало
 * выкатку «долгой». Пуш и есть выкатка: через пару минут демо обновлено.
 *
 * Проверить, что сейчас выложено, можно в любой момент одной командой:
 *   bun run deploy:status
 * Она читает тег `demo-live`, который workflow двигает на выкаченный коммит,
 * через `git ls-remote` — по github.com, без api.github.com и без самого
 * сайта Pages (в части сетей оба хоста закрыты, и старый скрипт на них падал).
 *
 * `bun run deploy:demo --wait` — если всё-таки нужно дождаться подтверждения.
 */
import { execFileSync } from "node:child_process";

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(msg);

const BRANCH = "master";
const TAG = "demo-live";
const SITE = "https://begemot-m.github.io/bereg/";

/** Что сейчас выложено в демо. `null` — тега ещё нет или сеть моргнула. */
function liveSha() {
  try {
    const out = sh("git", ["ls-remote", "origin", `refs/tags/${TAG}`]);
    return out ? out.split(/\s+/)[0] : null;
  } catch {
    return null;
  }
}

function status() {
  const live = liveSha();
  const head = sh("git", ["rev-parse", "HEAD"]);
  if (!live) {
    log("Метки выкатки ещё нет — первая сборка с ней либо идёт, либо не запускалась.");
    return;
  }
  log(live === head
    ? `В демо ${live.slice(0, 8)} — это текущий HEAD. ${SITE}`
    : `В демо ${live.slice(0, 8)}, локально ${head.slice(0, 8)} — сборка ещё идёт или не запускалась.`);
}

async function wait(sha) {
  const deadline = Date.now() + 15 * 60_000;
  while (Date.now() < deadline) {
    await sleep(15_000);
    if (liveSha() === sha) { log(`Демо обновлено: ${SITE}`); return; }
  }
  console.error(`Выкатка не подтвердилась за 15 минут. Смотри Actions; при аварии Actions/Pages пуши не создают сборок — https://www.githubstatus.com`);
  process.exit(1);
}

async function main() {
  if (process.argv.includes("--status")) { status(); return; }

  const dirty = sh("git", ["status", "--porcelain"]);
  if (dirty) {
    console.error("Есть незакоммиченные правки — сначала commit, иначе выкатится не то:\n" + dirty);
    process.exit(1);
  }

  const branch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== BRANCH) {
    console.error(`Демо собирается только с ${BRANCH}, а сейчас ${branch}.`);
    process.exit(1);
  }

  sh("git", ["push", "origin", BRANCH]);
  const sha = sh("git", ["rev-parse", "HEAD"]);

  // Пуш в этом репозитории перестал рождать сборки: события доходят, а run не
  // создаётся (проверено 7 августа 2026 — PushEvent есть, workflow_runs пусто).
  // Поэтому запускаем workflow явно. Ручной запуск работает даже когда push-
  // триггер молчит, и лишним он не бывает: если сборка уже идёт, очередь Pages
  // просто выполнит их по очереди.
  let started = true;
  try {
    sh("gh", ["workflow", "run", "deploy.yml", "--ref", BRANCH]);
  } catch {
    started = false;
  }

  // Не запустили сборку — это провал выкатки, а не примечание. Иначе «пуш
  // прошёл» читается как «выкачено», и демо неделю живёт на старом коммите.
  if (!started) {
    console.error(`Запушено ${sha.slice(0, 8)}, но запустить сборку не удалось (api.github.com не ответил).`);
    console.error("Дальше руками: открой https://github.com/Begemot-m/bereg/actions, workflow «Deploy demo to GitHub Pages» → Run workflow.");
    console.error("Или повтори позже: cd frontend && bun run deploy:demo. Проверить: bun run deploy:status");
    process.exit(2);
  }

  log(`Запушено ${sha.slice(0, 8)}, сборка запущена — демо обновится за пару минут: ${SITE}`);
  log("Проверить: bun run deploy:status");

  if (process.argv.includes("--wait")) await wait(sha);
}

main();
