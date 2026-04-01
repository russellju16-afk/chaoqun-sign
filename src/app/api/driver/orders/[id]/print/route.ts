import { NextRequest, NextResponse } from "next/server";
import { PrintStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";
import { unauthorized, forbidden, notFound, badRequest } from "@/lib/errors";
import { getDriverSession } from "@/lib/driver-session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface PrintRequestBody {
  copies?: number;
  printerName?: string;
}

const DEFAULT_PRINTER = process.env.DEFAULT_PRINTER_NAME ?? "default";

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await getDriverSession();
  if (!session.driverId) {
    return unauthorized();
  }

  const { id } = await params;

  // Parse optional body
  let body: PrintRequestBody = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as PrintRequestBody;
    }
  } catch {
    return badRequest("请求体格式错误");
  }

  const order = await prisma.deliveryOrder.findUnique({
    where: { id },
    select: {
      id: true,
      driverId: true,
      orderNo: true,
    },
  });

  if (order === null) {
    return notFound("送货单不存在");
  }

  if (order.driverId !== session.driverId) {
    return forbidden("无权操作此送货单");
  }

  // Validate copies if provided
  const copies =
    body.copies !== undefined && body.copies !== null ? body.copies : 1;
  if (!Number.isInteger(copies) || copies < 1 || copies > 10) {
    return badRequest("份数必须为 1-10 之间的整数");
  }

  const printerName = body.printerName?.trim() ?? DEFAULT_PRINTER;

  const printJob = await prisma.printJob.create({
    data: {
      orderId: id,
      printerName,
      copies,
      status: PrintStatus.QUEUED,
    },
  });

  return NextResponse.json(serializeBigInt(printJob), { status: 201 });
}
