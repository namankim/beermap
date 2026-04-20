import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { beerSpotSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export async function GET() {
  const spots = await prisma.beerSpot.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });

  return NextResponse.json(spots);
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email || !session.user.name) {
      return NextResponse.json(
        {
          message: "Please sign in with Google first."
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = beerSpotSchema.parse(body);

    const spot = await prisma.beerSpot.create({
      data: {
        ...data,
        submittedBy: session.user.name,
        userEmail: session.user.email
      }
    });

    return NextResponse.json(spot, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to create beer spot."
      },
      { status: 400 }
    );
  }
}
