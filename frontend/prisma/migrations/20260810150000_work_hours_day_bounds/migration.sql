-- Границы шкалы редактора графика. Раньше «работаю с 9 до 22» жило только в
-- памяти компонента и сбрасывалось к умолчанию при каждом открытии.
ALTER TABLE "WorkHours" ADD COLUMN "dayFrom" INTEGER NOT NULL DEFAULT 9;
ALTER TABLE "WorkHours" ADD COLUMN "dayTo" INTEGER NOT NULL DEFAULT 21;
