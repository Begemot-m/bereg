-- Разовые окна вне шаблона: психолог открывает их на конкретную дату из недели.
-- Колонки добавляются со значениями по умолчанию — старый код продолжает
-- работать с этой таблицей без изменений.
ALTER TABLE "SlotOverride" ADD COLUMN "added" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SlotOverride" ADD COLUMN "dur" INTEGER;
