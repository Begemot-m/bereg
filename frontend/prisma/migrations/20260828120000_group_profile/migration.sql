-- Общая информация группы: миниатюра, правила и стоимость участия.
-- Аддитивно: три колонки со значением по умолчанию, откат кода безопасен.
ALTER TABLE "Group" ADD COLUMN "avatar" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Group" ADD COLUMN "rules" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Group" ADD COLUMN "price" TEXT NOT NULL DEFAULT '';
