import { NextRequest, NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parsePagination, buildPaginatedResponse } from "@/lib/pagination";
import { serializeBigInt } from "@/lib/serialize";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const pagination = parsePagination(searchParams);

  const statusParam = searchParams.get("status");
  const search = searchParams.get("search")?.trim() ?? "";
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  // Validate status enum if provided
  const status =
    statusParam !== null && statusParam in OrderStatus
      ? (statusParam as OrderStatus)
      : undefined;

  const where = {
    ...(status !== undefined ? { status } : {}),
    ...(search.length > 0
      ? { customerName: { contains: search, mode: "insensitive" as const } }
      : {}),
    ...(dateFrom !== null || dateTo !== null
      ? {
          deliveryDate: {
            ...(dateFrom !== null ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo !== null ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.deliveryOrder.findMany({
      where,
      orderBy: { deliveryDate: "desc" },
      skip: pagination.skip,
      take: pagination.take,
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
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        _count: {
          select: { items: true },
        },
      },
    }),
    prisma.deliveryOrder.count({ where }),
  ]);

  const response = buildPaginatedResponse(orders, total, pagination);
  return NextResponse.json(serializeBigInt(response));
}
