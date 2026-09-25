ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "seoTitle" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "seoTitle" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "popular" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Area" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "Area" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "flagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "moderationReason" TEXT;

CREATE TABLE IF NOT EXISTS "ServiceMedia" (
  "id" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "storageKey" TEXT,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceMedia_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ServiceMedia_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ServiceMedia_serviceId_sortOrder_idx" ON "ServiceMedia"("serviceId", "sortOrder");

CREATE TABLE IF NOT EXISTS "ServiceArea" (
  "serviceId" TEXT NOT NULL,
  "areaId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ServiceArea_pkey" PRIMARY KEY ("serviceId", "areaId"),
  CONSTRAINT "ServiceArea_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ServiceArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ServiceArea_areaId_active_idx" ON "ServiceArea"("areaId", "active");

CREATE TABLE IF NOT EXISTS "OrderAttachment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "group" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "storageKey" TEXT,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "originalName" TEXT NOT NULL,
  "uploadedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderAttachment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OrderAttachment_orderId_group_createdAt_idx" ON "OrderAttachment"("orderId", "group", "createdAt");
