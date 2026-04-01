import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SignMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parsePagination, buildPaginatedResponse } from "@/lib/pagination";
import { serializeBigInt } from "@/lib/serialize";
import { requireRole } from "@/lib/role-guard";
import { getSession } from "@/lib/session";

const createCustomerSchema = z.object({
  kdCustomerId: z.string().min(1, "金蝶客户 ID 不能为空"),
  customerName: z.string().min(1, "客户名称不能为空"),
  signMode: z.nativeEnum(SignMode).optional(),
  contactPhone: z.string().optional(),
  contactName: z.string().optional(),
  requirePhoto: z.boolean().optional(),
  autoPrint: z.boolean().optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const pagination = parsePagination(searchParams);

  const [customers, total] = await Promise.all([
    prisma.customerConfig.findMany({
      orderBy: { customerName: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.customerConfig.count(),
  ]);

  const response = buildPaginatedResponse(customers, total, pagination);
  return NextResponse.json(serializeBigInt(response));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 写操作仅允许 ADMIN 角色
  const roleError = await requireRole(request, ["ADMIN"]);
  if (roleError) return roleError;

  // 获取当前登录用户（用于审计日志，requireRole 已保证此处 session 有效）
  const adminSession = await getSession();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const existing = await prisma.customerConfig.findUnique({
    where: { kdCustomerId: parsed.data.kdCustomerId },
  });
  if (existing !== null) {
    return NextResponse.json(
      { error: "Customer with this kdCustomerId already exists" },
      { status: 409 },
    );
  }

  const customer = await prisma.customerConfig.create({
    data: {
      kdCustomerId: parsed.data.kdCustomerId,
      customerName: parsed.data.customerName,
      ...(parsed.data.signMode !== undefined
        ? { signMode: parsed.data.signMode }
        : {}),
      ...(parsed.data.contactPhone !== undefined
        ? { contactPhone: parsed.data.contactPhone }
        : {}),
      ...(parsed.data.contactName !== undefined
        ? { contactName: parsed.data.contactName }
        : {}),
      ...(parsed.data.requirePhoto !== undefined
        ? { requirePhoto: parsed.data.requirePhoto }
        : {}),
      ...(parsed.data.autoPrint !== undefined
        ? { autoPrint: parsed.data.autoPrint }
        : {}),
    },
  });

  // 审计日志：记录客户创建（fire-and-forget，不阻塞响应）
  void prisma.auditLog.create({
    data: {
      userId: adminSession.userId,
      action: "customer.create",
      target: `customer_config:${customer.id}`,
      detail: JSON.stringify({
        kdCustomerId: customer.kdCustomerId,
        customerName: customer.customerName,
      }),
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown",
    },
  });

  return NextResponse.json(serializeBigInt(customer), { status: 201 });
}
