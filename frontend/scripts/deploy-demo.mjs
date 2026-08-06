#!/usr/bin/env node
/**
 * Выкатка демо на Pages с проверкой результата.
 *
 * Пуш сам по себе ничего не гарантирует: сборка может не запуститься вовсе
 * (очередь Pages зависла, GitHub не создал run), а узнаём мы об этом, только
 * открыв демо руками. Скрипт доводит дело до конца: пушит, убеждается что run
 * создан (иначе запускает вручную), ждёт его и сверяет sha в version.json на
 * живом сайте с локальным HEAD.
 */
import { execFileSync } from "node:child_process";

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(msg);

const WORKFLOW = "deploy.yml";
const BRANCH = "master";

/** Опрос длится минутами, и одинокий обрыв связи не повод бросать выкатку. */
async function ghJson(path, tries = 5) {
  for (let i = 1; ; i++) {
    try {
      return JSON.parse(sh("gh", ["api", path]));
    } catch (e) {
      if (i >= tries) throw e;
      log(`GitHub не ответил (${i}/${tries}), повторю через 10 с…`);
      await sleep(10000);
    }
  }
}

/**
 * Actions и Pages иногда просто лежат: пуши не создают сборок, а начатые
 * висят в очереди. Без этой проверки авария выглядит как «сломали конфиг».
 */
async function githubTrouble() {
  try {
    const res = await fetch("https://www.githubstatus.com/api/v2/summary.json");
    const { components } = await res.json();
    const broken = components
      .filter((c) => ["Actions", "Pages"].includes(c.name) && c.status !== "operational")
      .map((c) => `${c.name}: ${c.status}`);
    return broken.length ? broken.join(", ") : null;
  } catch {
    return null;
  }
}

async function runsForSha(repo, sha) {
  const { workflow_runs } = await ghJson(`repos/${repo}/actions/runs?head_sha=${sha}&per_page=10`);
  return workflow_runs.filter((r) => r.path === `.github/workflows/${WORKFLOW}`);
}

async function main() {
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

  log("Пушу в origin…");
  sh("git", ["push", "origin", BRANCH]);

  const sha = sh("git", ["rev-parse", "HEAD"]);
  const repo = JSON.parse(sh("gh", ["repo", "view", "--json", "nameWithOwner"])).nameWithOwner;
  log(`HEAD ${sha.slice(0, 8)} → ${repo}`);

  // Пуш не всегда рождает run — ждём недолго и при тишине запускаем сами.
  let runs = [];
  for (let i = 0; i < 12 && runs.length === 0; i++) {
    await sleep(5000);
    runs = await runsForSha(repo, sha);
  }
  if (runs.length === 0) {
    log("Пуш не создал сборку — запускаю workflow вручную.");
    sh("gh", ["workflow", "run", WORKFLOW, "--ref", BRANCH]);
    for (let i = 0; i < 12 && runs.length === 0; i++) {
      await sleep(5000);
      runs = await runsForSha(repo, sha);
    }
    if (runs.length === 0) {
      const trouble = await githubTrouble();
      console.error(
        trouble
          ? `Сборка не появилась — на стороне GitHub авария (${trouble}). Дождись починки и повтори.`
          : "Сборка так и не появилась. Загляни в Actions: gh run list",
      );
      process.exit(1);
    }
  }

  const runId = runs[0].id;
  log(`Сборка ${runId}: https://github.com/${repo}/actions/runs/${runId}`);

  let run = runs[0];
  const deadline = Date.now() + 20 * 60_000;
  while (run.status !== "completed") {
    if (Date.now() > deadline) {
      const trouble = await githubTrouble();
      console.error(
        trouble
          ? `Сборка встала: на стороне GitHub авария (${trouble}). Повтори, когда починят.`
          : "Сборка идёт больше 20 минут — что-то не так, смотри лог.",
      );
      process.exit(1);
    }
    await sleep(15000);
    run = await ghJson(`repos/${repo}/actions/runs/${runId}`);
  }
  if (run.conclusion !== "success") {
    console.error(`Сборка завершилась как ${run.conclusion}. Лог: gh run view ${runId} --log-failed`);
    process.exit(1);
  }
  log("Сборка зелёная, жду обновления сайта…");

  // Зелёный run ещё не значит свежий сайт: CDN Pages отдаёт старое до минуты.
  const site = (await ghJson(`repos/${repo}/pages`)).html_url.replace(/\/$/, "");
  const until = Date.now() + 5 * 60_000;
  while (Date.now() < until) {
    try {
      const res = await fetch(`${site}/version.json?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const v = await res.json();
        if (v.sha === sha) {
          log(`Демо обновлено: ${site}  (сборка ${v.build})`);
          return;
        }
      }
    } catch {
      // сеть моргнула — просто пробуем ещё раз
    }
    await sleep(10000);
  }
  console.error(`Сборка прошла, но ${site}/version.json всё ещё отдаёт старую версию.`);
  process.exit(1);
}

main();
