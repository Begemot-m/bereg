#!/usr/bin/env node
/**
 * Страж миграций.
 *
 * Откат кода не откатывает базу. Поэтому разрушающая миграция — это точка
 * невозврата: выкатили, что-то пошло не так, вернули старый образ, а колонки
 * уже нет, и старый код падает на каждом запросе.
 *
 * Правило: удаление и переименование делаются в два релиза. Сначала
 * перестаём пользоваться, следующим релизом убираем. Между ними обе версии
 * кода живы, и откат безопасен.
 *
 * Если разрушающее изменение всё-таки осознанное — поставьте в файле
 * миграции строку с причиной:
 *
 *   -- allow-destructive: колонка не использовалась с релиза 12, данных нет
 *
 * Тогда страж пропустит: задача не запретить, а не дать сделать случайно.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIR = "prisma/migrations";

// NOT NULL без DEFAULT тоже разрушающее: на непустой таблице такая миграция
// падает и оставляет базу в половинчатом состоянии.
const DANGER = [
  { re: /\bDROP\s+TABLE\b/i, what: "удаление таблицы" },
  { re: /\bDROP\s+COLUMN\b/i, what: "удаление колонки" },
  { re: /\bALTER\s+COLUMN\b[\s\S]{0,80}?\bSET\s+NOT\s+NULL\b/i, what: "NOT NULL на существующей колонке" },
  { re: /\bALTER\s+COLUMN\b[\s\S]{0,80}?\bTYPE\b/i, what: "смена типа колонки" },
  { re: /\bDROP\s+CONSTRAINT\b/i, what: "снятие ограничения" },
  { re: /\bTRUNCATE\b/i, what: "очистка таблицы" },
];

const ALLOW = /--\s*allow-destructive:\s*\S+/i;

let dirs = [];
try {
  dirs = readdirSync(DIR).filter((name) => statSync(join(DIR, name)).isDirectory());
} catch {
  console.log("Миграций пока нет — проверять нечего.");
  process.exit(0);
}

const problems = [];
for (const dir of dirs) {
  const file = join(DIR, dir, "migration.sql");
  let sql;
  try {
    sql = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (ALLOW.test(sql)) continue;

  for (const { re, what } of DANGER) {
    if (re.test(sql)) problems.push({ dir, what });
  }
}

if (problems.length === 0) {
  console.log(`Миграции проверены (${dirs.length}): разрушающих изменений нет.`);
  process.exit(0);
}

console.error("\nМиграция может уничтожить данные и сделать откат невозможным:\n");
for (const p of problems) console.error(`  ${p.dir} — ${p.what}`);
console.error(`
Как быть:
  1. Разбейте на два релиза: сначала перестаньте использовать поле,
     следующим релизом удалите.
  2. Если изменение осознанное, добавьте в файл миграции строку:
     -- allow-destructive: почему это безопасно именно здесь
`);
process.exit(1);
