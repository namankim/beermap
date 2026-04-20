import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json(
      {
        message: "Please sign in first."
      },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  const spot = await prisma.beerSpot.findUnique({
    where: {
      id
    }
  });

  if (!spot) {
    return NextResponse.json(
      {
        message: "This pin was not found."
      },
      { status: 404 }
    );
  }

  if (spot.userEmail !== session.user.email) {
    return NextResponse.json(
      {
        message: "You can only delete pins that you created."
      },
      { status: 403 }
    );
  }

  await prisma.beerSpot.delete({
    where: {
      id
    }
  });

  return NextResponse.json({ success: true });
}
