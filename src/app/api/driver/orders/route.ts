import { NextRequest, NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";
import { unauthorized } from "@/lib/errors";
import { validateDriverSession } from "@/lib/driver-session";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await validateDriverSession();
  if (!session) {
    return unauthorized();
  }

  const { searchParams } = request.nextUrl;

  // Default date is today
  const dateParam = searchParams.get("date");
  const statusParam = searchParams.get("status");

  let targetDate: Date;
  if (dateParam !== null) {
    const parsed = new Date(dateParam);
    targetDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    targetDate = new Date();
  }

  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  // Validate status enum if provided
  const status =
    statusParam !== null && statusParam in OrderStatus
      ? (statusParam as OrderStatus)
      : undefined;

  const orders = await prisma.deliveryOrder.findMany({
    where: {
      driverId: session.driverId,
      deliveryDate: { gte: dayStart, lte: dayEnd },
      ...(status !== undefined ? { status } : {}),
    },
    orderBy: { deliveryDate: "desc" },
    select: {
      id: true,
      orderNo: true,
      kdBillNo: true,
      customerName: true,
      customerPhone: true,
      customerAddress: true,
      totalAmount: true,
      status: true,
      deliveryDate: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          kdCustomerId: true,
          customerName: true,
          signMode: true,
          contactPhone: true,
          contactName: true,
        },
      },
      _count: {
        select: { items: true },
      },
      signRecord: {
        select: {
          id: true,
          signerName: true,
          signedAt: true,
        },
      },
    },
  });

  return NextResponse.json(serializeBigInt(orders));
}
