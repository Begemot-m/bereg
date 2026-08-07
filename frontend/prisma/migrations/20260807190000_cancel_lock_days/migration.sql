-- Запрет отмены переехал из localStorage психолога в базу: правило должно
-- доезжать до клиента на другом устройстве и проверяться на сервере.
ALTER TABLE "WorkHours" ADD COLUMN "cancelLockDays" INTEGER NOT NULL DEFAULT 0;
