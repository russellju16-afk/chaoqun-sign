import { NextRequest, NextResponse } from "next/server";
import { PrintStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { enqueuePrintJob } from "@/lib/print/queue";
import { serializeBigInt } from "@/lib/serialize";
import {
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  serverError,
} from "@/lib/errors";
import { validateDriverSession } from "@/lib/driver-session";

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
  // 同时验证 session 有效性和司机 isActive 状态
  const session = await validateDriverSession();
  if (!session) {
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

  // 先创建 DB 记录，再入队；入队失败时将记录标记为 FAILED（补偿模式），
  // 避免留下状态永远为 QUEUED 却永远不会被处理的孤儿记录。
  let printJob: Awaited<ReturnType<typeof prisma.printJob.create>> | undefined;
  try {
    printJob = await prisma.printJob.create({
      data: {
        orderId: id,
        printerName,
        copies,
        status: PrintStatus.QUEUED,
      },
    });

    await enqueuePrintJob({
      printJobId: printJob.id,
      orderId: id,
      printerName,
      copies,
      format: "a4", // 司机端默认使用 A4 格式
    });

    return NextResponse.json(serializeBigInt(printJob), { status: 201 });
  } catch (err: unknown) {
    console.error(
      "[driver/print route] failed to create/enqueue print job:",
      err,
    );

    // 如果 DB 记录已创建但入队失败，将其标记为 FAILED 避免成为孤儿记录
    if (printJob !== undefined) {
      await prisma.printJob
        .update({
          where: { id: printJob.id },
          data: {
            status: PrintStatus.FAILED,
            error: "入队失败: " + String(err),
          },
        })
        .catch((updateErr: unknown) => {
          console.error(
            "[driver/print route] failed to mark print job as FAILED:",
            updateErr,
          );
        });
    }

    return serverError("打印任务创建失败，请稍后重试");
  }
}
