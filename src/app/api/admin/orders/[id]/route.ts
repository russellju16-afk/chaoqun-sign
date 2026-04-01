import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { id } = await params;

  const order = await prisma.deliveryOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      driver: true,
      items: {
        orderBy: { id: "asc" },
      },
      signRecord: true,
      printJobs: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (order === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(serializeBigInt(order));
}
