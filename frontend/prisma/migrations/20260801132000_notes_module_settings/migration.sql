ALTER TABLE "Client"
ADD COLUMN "notesModuleEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "notesModuleShared" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notesModulePsychologist" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Client"
SET "notesModuleEnabled" = true,
    "notesModulePsychologist" = true
WHERE EXISTS (
    SELECT 1 FROM "SessionReflection"
    WHERE "SessionReflection"."clientId" = "Client"."id"
);
