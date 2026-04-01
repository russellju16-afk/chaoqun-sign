import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SignMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";

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

  return NextResponse.json(serializeBigInt(updated));
}
