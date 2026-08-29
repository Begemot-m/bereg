-- Клиент, заведённый выбором контакта в Telegram: аккаунт не подключён,
-- но у карточки есть лицо, ник и id для будущей связки.
ALTER TABLE "Client" ADD COLUMN "tgUserId" BIGINT;
ALTER TABLE "Client" ADD COLUMN "tgUsername" TEXT;
ALTER TABLE "Client" ADD COLUMN "tgPhotoId" TEXT;

CREATE INDEX "Client_tgUserId_idx" ON "Client"("tgUserId");
