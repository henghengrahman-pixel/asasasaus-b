CREATE TYPE "PartnerClaimStatus" AS ENUM ('UNCLAIMED', 'CLAIMED');
CREATE TYPE "StorefrontStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');
CREATE TYPE "PartnerMediaKind" AS ENUM ('LOGO', 'PROFILE', 'BANNER', 'GALLERY');
CREATE TYPE "PartnerClaimInvitationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'REVOKED', 'EXPIRED');

ALTER TABLE "Partner" ADD COLUMN "slug" TEXT,
ADD COLUMN "claimStatus" "PartnerClaimStatus" NOT NULL DEFAULT 'UNCLAIMED',
ADD COLUMN "storefrontStatus" "StorefrontStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN "claimedAt" TIMESTAMP(3);

DO $$
DECLARE r RECORD; base_slug TEXT; candidate TEXT; suffix INT;
BEGIN
  FOR r IN SELECT id, "businessName" FROM "Partner" WHERE "slug" IS NULL LOOP
    base_slug := trim(both '-' from regexp_replace(lower(r."businessName"), '[^a-z0-9]+', '-', 'g'));
    IF base_slug = '' THEN base_slug := 'mitra'; END IF;
    candidate := base_slug; suffix := 2;
    WHILE EXISTS (SELECT 1 FROM "Partner" WHERE "slug" = candidate) LOOP
      candidate := base_slug || '-' || suffix; suffix := suffix + 1;
    END LOOP;
    UPDATE "Partner" SET "slug" = candidate WHERE id = r.id;
  END LOOP;
END $$;
CREATE UNIQUE INDEX "Partner_slug_key" ON "Partner"("slug");

CREATE TABLE "PartnerStorefront" (
  "id" TEXT NOT NULL, "partnerId" TEXT NOT NULL, "displayName" TEXT, "tagline" TEXT,
  "description" TEXT, "whatsapp" TEXT, "publicAddress" TEXT, "estimatedResponseMinutes" INTEGER,
  "facilities" JSONB, "draftData" JSONB, "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerStorefront_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerStorefront_partnerId_key" ON "PartnerStorefront"("partnerId");
ALTER TABLE "PartnerStorefront" ADD CONSTRAINT "PartnerStorefront_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PartnerMedia" (
  "id" TEXT NOT NULL, "partnerId" TEXT NOT NULL, "kind" "PartnerMediaKind" NOT NULL, "url" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL, "width" INTEGER, "height" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0, "hidden" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerMedia_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerMedia_partnerId_kind_hidden_sortOrder_idx" ON "PartnerMedia"("partnerId","kind","hidden","sortOrder");
ALTER TABLE "PartnerMedia" ADD CONSTRAINT "PartnerMedia_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PartnerPromotion" (
  "id" TEXT NOT NULL, "partnerId" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
  "startsAt" TIMESTAMP(3), "endsAt" TIMESTAMP(3), "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerPromotion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerPromotion_partnerId_active_idx" ON "PartnerPromotion"("partnerId","active");
ALTER TABLE "PartnerPromotion" ADD CONSTRAINT "PartnerPromotion_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PartnerBusinessHour" (
  "id" TEXT NOT NULL, "partnerId" TEXT NOT NULL, "dayOfWeek" INTEGER NOT NULL, "openMinute" INTEGER, "closeMinute" INTEGER, "closed" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "PartnerBusinessHour_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerBusinessHour_partnerId_dayOfWeek_key" ON "PartnerBusinessHour"("partnerId","dayOfWeek");
ALTER TABLE "PartnerBusinessHour" ADD CONSTRAINT "PartnerBusinessHour_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PartnerAnalyticsEvent" (
  "id" TEXT NOT NULL, "partnerId" TEXT NOT NULL, "type" TEXT NOT NULL, "serviceId" TEXT, "orderId" TEXT, "sessionHash" TEXT, "valueInt" INTEGER, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PartnerAnalyticsEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerAnalyticsEvent_partnerId_type_createdAt_idx" ON "PartnerAnalyticsEvent"("partnerId","type","createdAt");
ALTER TABLE "PartnerAnalyticsEvent" ADD CONSTRAINT "PartnerAnalyticsEvent_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PartnerRankingSnapshot" (
  "id" TEXT NOT NULL, "partnerId" TEXT NOT NULL, "categoryId" TEXT NOT NULL, "areaId" TEXT NOT NULL, "score" DECIMAL(8,5) NOT NULL,
  "rank" INTEGER, "eligible" BOOLEAN NOT NULL DEFAULT false, "metrics" JSONB NOT NULL, "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerRankingSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerRankingSnapshot_partnerId_categoryId_areaId_key" ON "PartnerRankingSnapshot"("partnerId","categoryId","areaId");
CREATE INDEX "PartnerRankingSnapshot_categoryId_areaId_eligible_rank_idx" ON "PartnerRankingSnapshot"("categoryId","areaId","eligible","rank");
ALTER TABLE "PartnerRankingSnapshot" ADD CONSTRAINT "PartnerRankingSnapshot_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PartnerClaim" (
  "id" TEXT NOT NULL, "partnerId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "phone" TEXT NOT NULL,
  "status" "PartnerClaimInvitationStatus" NOT NULL DEFAULT 'ACTIVE', "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PartnerClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerClaim_tokenHash_key" ON "PartnerClaim"("tokenHash");
CREATE INDEX "PartnerClaim_partnerId_status_expiresAt_idx" ON "PartnerClaim"("partnerId","status","expiresAt");
ALTER TABLE "PartnerClaim" ADD CONSTRAINT "PartnerClaim_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PartnerSlugRedirect" (
  "id" TEXT NOT NULL, "partnerId" TEXT NOT NULL, "oldSlug" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerSlugRedirect_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerSlugRedirect_oldSlug_key" ON "PartnerSlugRedirect"("oldSlug");
ALTER TABLE "PartnerSlugRedirect" ADD CONSTRAINT "PartnerSlugRedirect_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
