import { BeerMapScreen } from "@/components/beer-map-screen";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const spots = await prisma.beerSpot.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });

  return <BeerMapScreen initialSpots={spots} />;
}
