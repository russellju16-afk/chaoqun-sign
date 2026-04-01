import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";
import { unauthorized, forbidden, notFound } from "@/lib/errors";
import { getDriverSession } from "@/lib/driver-session";
import { generateViewUrl } from "@/lib/oss";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await getDriverSession();
  if (!session.driverId) {
    return unauthorized();
  }

  const { id } = await params;

  const order = await prisma.deliveryOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      driver: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      items: {
        orderBy: { id: "asc" },
      },
      signRecord: true,
      printJobs: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (order === null) {
    return notFound("送货单不存在");
  }

  // Drivers may only view their own orders
  if (order.driverId !== session.driverId) {
    return forbidden("无权查看此送货单");
  }

  // Attach pre-signed view URLs to the sign record if present
  const enrichedSignRecord =
    order.signRecord !== null
      ? {
          ...order.signRecord,
          signatureViewUrl: generateViewUrl(order.signRecord.signatureUrl),
          photoViewUrls: order.signRecord.photoUrls.map((key) =>
            generateViewUrl(key),
          ),
        }
      : null;

  const payload = { ...order, signRecord: enrichedSignRecord };

  return NextResponse.json(serializeBigInt(payload));
}
