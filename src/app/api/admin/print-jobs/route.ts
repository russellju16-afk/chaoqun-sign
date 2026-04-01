import { NextRequest, NextResponse } from "next/server";
import { PrintStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parsePagination, buildPaginatedResponse } from "@/lib/pagination";
import { serializeBigInt } from "@/lib/serialize";

/**
 * GET /api/admin/print-jobs
 *
 * Returns paginated print jobs (newest first).
 *
 * Query params:
 *   status  — filter by PrintStatus (QUEUED | PRINTING | COMPLETED | FAILED)
 *   page    — page number (default 1)
 *   pageSize — items per page (default 20, max 100)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const pagination = parsePagination(searchParams);

  const statusParam = searchParams.get("status");
  const status =
    statusParam !== null && statusParam in PrintStatus
      ? (statusParam as PrintStatus)
      : undefined;

  const where = status !== undefined ? { status } : {};

  const [jobs, total] = await Promise.all([
    prisma.printJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        orderId: true,
        printerName: true,
        copies: true,
        status: true,
        error: true,
        createdAt: true,
        updatedAt: true,
        order: {
          select: {
            orderNo: true,
            customerName: true,
          },
        },
      },
    }),
    prisma.printJob.count({ where }),
  ]);

  const response = buildPaginatedResponse(jobs, total, pagination);
  return NextResponse.json(serializeBigInt(response));
}
