import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SignMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";
import { requireRole } from "@/lib/role-guard";
import { getSession } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateCustomerSchema = z.object({
  signMode: z.nativeEnum(SignMode).optional(),
  contactPhone: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  requirePhoto: z.boolean().optional(),
  autoPrint: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { id } = await params;

  const customer = await prisma.customerConfig.findUnique({ where: { id } });

  if (customer === null) {
    return NextResponse.json(
      { error: "Customer config not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(serializeBigInt(customer));
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  // 写操作仅允许 ADMIN 角色
  const roleError = await requireRole(request, ["ADMIN"]);
  if (roleError) return roleError;

  // 获取当前登录用户（用于审计日志）
  const adminSession = await getSession();

  const { id } = await params;

  const existing = await prisma.customerConfig.findUnique({ where: { id } });
  if (existing === null) {
    return NextResponse.json(
      { error: "Customer config not found" },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await prisma.customerConfig.update({
    where: { id },
    data: {
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

  // 审计日志：记录客户配置修改（fire-and-forget，不阻塞响应）
  void prisma.auditLog.create({
    data: {
      userId: adminSession.userId,
      action: "customer.update",
      target: `customer_config:${id}`,
      detail: JSON.stringify({
        customerName: existing.customerName,
        changes: parsed.data,
      }),
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown",
    },
  });

  return NextResponse.json(serializeBigInt(updated));
}
