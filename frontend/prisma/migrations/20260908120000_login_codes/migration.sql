-- Вход по QR-коду: одноразовые коды, которые подтверждают в Telegram.
-- Аддитивно: одна новая таблица, существующие не трогаются.
CREATE TABLE "LoginCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userId" INTEGER,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    CONSTRAINT "LoginCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoginCode_codeHash_key" ON "LoginCode"("codeHash");
CREATE INDEX "LoginCode_expiresAt_idx" ON "LoginCode"("expiresAt");
CREATE INDEX "LoginCode_userId_createdAt_idx" ON "LoginCode"("userId", "createdAt");

ALTER TABLE "LoginCode" ADD CONSTRAINT "LoginCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
