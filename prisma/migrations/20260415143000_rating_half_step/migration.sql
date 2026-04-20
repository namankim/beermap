-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BeerSpot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "beerType" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "userEmail" TEXT,
    "rating" REAL NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BeerSpot" ("address", "beerType", "createdAt", "description", "id", "lat", "lng", "name", "rating", "submittedBy", "updatedAt", "userEmail")
SELECT "address", "beerType", "createdAt", "description", "id", "lat", "lng", "name", "rating", "submittedBy", "updatedAt", "userEmail" FROM "BeerSpot";
DROP TABLE "BeerSpot";
ALTER TABLE "new_BeerSpot" RENAME TO "BeerSpot";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
