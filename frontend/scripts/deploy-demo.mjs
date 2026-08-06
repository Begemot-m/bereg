#!/usr/bin/env node
/**
 * Выкатка демо на Pages с проверкой результата.
 *
 * Всё общение с GitHub идёт через git по `github.com`. Раньше скрипт опрашивал
 * `api.github.com` и сам сайт `*.github.io` — в части сетей оба закрыты, и
 * выкатка выглядела упавшей, хотя на самом деле шла нормально.
 *
 * Признак успеха теперь — тег `demo-live`: workflow двигает его на коммит,
 * который реально доехал до Pages. Тег виден обычным `git ls-remote`.
 *
 * Пуш сам по себе ничего не гарантирует: сборка может не запуститься вовсе
 * (зависшая очередь Pages, авария Actions). Если тег долго не двигается,
 * скрипт толкает выкатку пустым коммитом — это создаёт новый запуск workflow
 * без обращения к API.
 */
import { execFileSync } from "node:child_process";

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(msg);

const BRANCH = "master";
const TAG = "demo-live";
const POLL_MS = 15_000;
/** Обычная сборка укладывается в 5–7 минут; после этого считаем, что она не стартовала. */
const NUDGE_AFTER_MS = 9 * 60_000;
const DEADLINE_MS = 25 * 60_000;

/** Что сейчас выложено в демо. `null` — тега ещё нет (или сеть моргнула). */
function liveSha() {
  try {
    const out = sh("git", ["ls-remote", "origin", `refs/tags/${TAG}`]);
    return out ? out.split(/\s+/)[0] : null;
  } catch {
    return null;
  }
}

/**
 * Приятный, но необязательный контроль: если сайт из этой сети открывается,
 * сверим ещё и version.json. Недоступность демо здесь ничего не значит —
 * тег уже доказал, что выкатка прошла.
 */
async function siteBuild(sha) {
  try {
    const res = await fetch(`https://begemot-m.github.io/bereg/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const v = await res.json();
    return v.sha === sha ? v.build : null;
  } catch {
    return null;
  }
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

  const before = liveSha();

  log("Пушу в origin…");
  sh("git", ["push", "origin", BRANCH]);

  let sha = sh("git", ["rev-parse", "HEAD"]);
  log(`HEAD ${sha.slice(0, 8)} — жду, когда сборка доедет до Pages…`);

  const deadline = Date.now() + DEADLINE_MS;
  let nudged = false;
  let nudgeAt = Date.now() + NUDGE_AFTER_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_MS);

    const live = liveSha();
    if (live === sha) {
      const build = await siteBuild(sha);
      log(build
        ? `Демо обновлено: https://begemot-m.github.io/bereg/  (сборка ${build})`
        : "Демо обновлено: https://begemot-m.github.io/bereg/");
      return;
    }

    // Тег стоит там же, где до пуша, и время вышло — сборка, похоже,
    // не запустилась. Пустой коммит рождает новый запуск workflow.
    if (!nudged && Date.now() > nudgeAt && live === before) {
      log("Сборка не отзывается — толкаю выкатку пустым коммитом.");
      sh("git", ["commit", "--allow-empty", "-m", "Перезапуск выкатки демо"]);
      sh("git", ["push", "origin", BRANCH]);
      sha = sh("git", ["rev-parse", "HEAD"]);
      nudged = true;
      nudgeAt = Date.now() + NUDGE_AFTER_MS;
    }
  }

  console.error(
    `Выкатка не подтвердилась за ${Math.round(DEADLINE_MS / 60000)} минут: тег ${TAG} всё ещё на ${(liveSha() ?? "—").slice(0, 8)}.\n` +
    "Смотри Actions репозитория; при авариях Actions/Pages пуши перестают создавать сборки вовсе — https://www.githubstatus.com",
  );
  process.exit(1);
}

main();
