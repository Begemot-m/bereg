-- История платежей. До сих пор оплата жила только в Subscription, одной
-- строкой на психолога: продление затирало предыдущий платёж, и выручка за
-- период не восстанавливалась ниоткуда. Миграция только добавляет — откат
-- кода на прошлый образ базу не ломает.
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" SERIAL NOT NULL,
    "psychologistId" INTEGER NOT NULL,
    "yookassaPaymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "kind" TEXT NOT NULL DEFAULT 'initial',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- Один платёж — одна строка: вебхук и автопродление могут провести его
-- наперегонки, и вторая вставка должна отвалиться сама.
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_yookassaPaymentId_key" ON "Payment"("yookassaPaymentId");
CREATE INDEX IF NOT EXISTS "Payment_paidAt_idx" ON "Payment"("paidAt");
CREATE INDEX IF NOT EXISTS "Payment_psychologistId_paidAt_idx" ON "Payment"("psychologistId", "paidAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_psychologistId_fkey"
    FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Задним числом таблицу не наполняем. Восстановить можно только сам факт
-- последнего платежа, но не сумму: подставить туда текущую цену — значит
-- записать в отчёт о деньгах выдуманное число. История начинается с выкатки.
