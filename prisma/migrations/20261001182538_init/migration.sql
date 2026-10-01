-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SpotActionType" AS ENUM ('WANT_TO_GO', 'VISITED', 'FAVORITE');

-- CreateEnum
CREATE TYPE "SpotSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('STORY', 'GUIDE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "preferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "homeCity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "address" TEXT,
    "description" TEXT NOT NULL,
    "tags" TEXT[],
    "rating" DOUBLE PRECISION,
    "crowdLevel" INTEGER,
    "avgCost" INTEGER,
    "suggestedDuration" TEXT,
    "bestSeason" TEXT[],
    "transportInfo" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "ticketBookingUrl" TEXT,
    "hotelBookingUrl" TEXT,
    "gaodeNavigationUrl" TEXT,
    "isNationalKeyVillage" BOOLEAN NOT NULL DEFAULT false,
    "batch" TEXT,
    "source" TEXT NOT NULL,
    "accommodationTips" JSONB,
    "diningTips" JSONB,
    "routeHighlights" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSpotAction" (
    "id" TEXT NOT NULL,
    "type" "SpotActionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "spotId" TEXT NOT NULL,

    CONSTRAINT "UserSpotAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "content" TEXT,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visitDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "spotId" TEXT NOT NULL,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchHistory" (
    "id" TEXT NOT NULL,
    "query" TEXT,
    "province" TEXT,
    "city" TEXT,
    "tag" TEXT,
    "preferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resultIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "type" "PostType" NOT NULL DEFAULT 'STORY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "spotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spotId" TEXT,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLike" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotSubmission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "address" TEXT,
    "description" TEXT NOT NULL,
    "tags" TEXT[],
    "suggestedDuration" TEXT,
    "transportInfo" TEXT,
    "imageUrl" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "reason" TEXT,
    "status" "SpotSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerNotes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'user_submission',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "approvedSpotId" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SpotSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalObservation" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT,
    "authorName" TEXT,
    "authorProfileUrl" TEXT,
    "postUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "contentSummary" TEXT NOT NULL,
    "commentsSummary" TEXT,
    "priceInfo" TEXT,
    "estimatedCost" INTEGER,
    "ratingText" TEXT,
    "likeCount" INTEGER,
    "commentCount" INTEGER,
    "collectCount" INTEGER,
    "regionText" TEXT,
    "province" TEXT,
    "city" TEXT,
    "district" TEXT,
    "tags" TEXT[],
    "source" TEXT NOT NULL,
    "batch" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "spotId" TEXT,

    CONSTRAINT "ExternalObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Spot_province_city_idx" ON "Spot"("province", "city");

-- CreateIndex
CREATE UNIQUE INDEX "Spot_name_province_city_district_key" ON "Spot"("name", "province", "city", "district");

-- CreateIndex
CREATE INDEX "UserSpotAction_spotId_type_idx" ON "UserSpotAction"("spotId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "UserSpotAction_userId_spotId_type_key" ON "UserSpotAction"("userId", "spotId", "type");

-- CreateIndex
CREATE INDEX "CheckIn_spotId_createdAt_idx" ON "CheckIn"("spotId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchHistory_userId_createdAt_idx" ON "SearchHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_spotId_createdAt_idx" ON "Post"("spotId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_postId_createdAt_idx" ON "Comment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "PostLike_userId_createdAt_idx" ON "PostLike"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostLike_postId_userId_key" ON "PostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "SpotSubmission_status_createdAt_idx" ON "SpotSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ExternalObservation_platform_publishedAt_idx" ON "ExternalObservation"("platform", "publishedAt");

-- CreateIndex
CREATE INDEX "ExternalObservation_province_city_idx" ON "ExternalObservation"("province", "city");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalObservation_platform_externalId_key" ON "ExternalObservation"("platform", "externalId");

-- AddForeignKey
ALTER TABLE "UserSpotAction" ADD CONSTRAINT "UserSpotAction_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "Spot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSpotAction" ADD CONSTRAINT "UserSpotAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "Spot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchHistory" ADD CONSTRAINT "SearchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "Spot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "Spot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotSubmission" ADD CONSTRAINT "SpotSubmission_approvedSpotId_fkey" FOREIGN KEY ("approvedSpotId") REFERENCES "Spot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotSubmission" ADD CONSTRAINT "SpotSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalObservation" ADD CONSTRAINT "ExternalObservation_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "Spot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
