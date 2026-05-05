-- CreateTable
CREATE TABLE "BeerSpot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "beerType" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "userEmail" TEXT,
    "rating" DOUBLE PRECISION NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeerSpot_pkey" PRIMARY KEY ("id")
);
