ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "dispatchEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "serviceRadiusKm" INTEGER NOT NULL DEFAULT 10;
CREATE INDEX IF NOT EXISTS "Partner_dispatchEnabled_online_idx" ON "Partner"("dispatchEnabled", "online");
