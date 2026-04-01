import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySignToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";
import {
  generateUploadUrl,
  generateViewUrl,
  getSignatureImageKey,
  getPhotoKey,
} from "@/lib/oss";

interface RouteContext {
  params: Promise<{ token: string }>;
}

const UploadSchema = z.object({
  type: z.enum(["signature", "photo"]),
  // Required when type === "photo"; 0-based index
  index: z.number().int().min(0).max(9).optional(),
});

/**
 * POST /api/sign/[token]/upload
 *
 * Return a pre-signed OSS PUT URL so the client can upload images directly
 * to OSS without routing binary data through the Next.js server.
 *
 * This is the preferred path for large photos. The submit route also accepts
 * base64 data URLs as a fallback for simpler clients.
 *
 * Body: { type: "signature" | "photo", index?: number }
 *
 * Response:
 *   { uploadUrl, key, viewUrl }
 *   - uploadUrl: short-lived PUT URL (5 min)
 *   - key: the OSS object key (pass back in the submit call if needed)
 *   - viewUrl: short-lived GET URL (15 min) — for immediate preview after upload
 *
 * Errors:
 *   400 — invalid token / body
 *   404 — order not found
 *   409 — order already in a terminal state
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { token } = await context.params;

  if (!token) {
    return badRequest("缺少签收凭证");
  }

  const payload = verifySignToken(token);
  if (!payload) {
    return badRequest("签收链接无效或已过期");
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("请求体格式错误");
  }

  const parsed = UploadSchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest(parsed.error.errors.map((e) => e.message).join("; "));
  }

  const { type, index } = parsed.data;

  if (type === "photo" && index === undefined) {
    return badRequest("上传照片时必须提供 index 字段");
  }

  // Verify order exists and is not already in a terminal state
  const order = await prisma.deliveryOrder.findFirst({
    where: {
      id: payload.orderId,
      signToken: token,
    },
    select: { id: true, status: true },
  });

  if (!order) {
    return notFound("送货单不存在");
  }

  if (
    order.status === "SIGNED" ||
    order.status === "REJECTED" ||
    order.status === "CANCELLED"
  ) {
    return NextResponse.json(
      { error: "ORDER_CLOSED", message: "该送货单已结束，无法上传" },
      { status: 409 },
    );
  }

  const key =
    type === "signature"
      ? getSignatureImageKey(order.id)
      : getPhotoKey(order.id, index!);

  const contentType = type === "signature" ? "image/png" : "image/jpeg";
  const uploadUrl = generateUploadUrl(key, contentType);
  const viewUrl = generateViewUrl(key);

  return NextResponse.json({ uploadUrl, key, viewUrl, contentType });
}
