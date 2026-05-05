import { BeerMapScreen } from "@/components/beer-map-screen";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const spots = await prisma.beerSpot.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });

  return <BeerMapScreen initialSpots={spots} />;
}
