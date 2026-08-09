-- Доставка в Telegram теперь бывает не только про встречу: домашнее задание
-- живёт своей жизнью, поэтому связь со встречей стала необязательной.
ALTER TABLE "TelegramDelivery" ALTER COLUMN "appointmentId" DROP NOT NULL;
ALTER TABLE "TelegramDelivery" ADD COLUMN "homeworkId" INTEGER;

ALTER TABLE "TelegramDelivery"
  ADD CONSTRAINT "TelegramDelivery_homeworkId_fkey"
  FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "TelegramDelivery_homeworkId_idx" ON "TelegramDelivery"("homeworkId");
