import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySignToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { badRequest, notFound, serverError, unauthorized } from "@/lib/errors";
import { serializeBigInt } from "@/lib/serialize";
import {
  getSignatureImageKey,
  getPhotoKey,
  putObject,
  parseDataUrl,
  generateViewUrl,
} from "@/lib/oss";
import { notifySignComplete } from "@/lib/lark";

interface RouteContext {
  params: Promise<{ token: string }>;
}

const SubmitSchema = z.object({
  signerName: z.string().min(1, "签收人姓名不能为空").max(50),
  signerPhone: z.string().max(20).optional(),
  signatureDataUrl: z
    .string()
    .min(1, "签名图片不能为空")
    .refine(
      (v) => v.startsWith("data:image/"),
      "signatureDataUrl 必须是 data URL",
    ),
  photoDataUrls: z
    .array(
      z
        .string()
        .refine(
          (v) => v.startsWith("data:image/"),
          "每张照片必须是 data URL",
        ),
    )
    .max(10)
    .optional(),
  remark: z.string().max(500).optional(),
});

/**
 * POST /api/sign/[token]/submit
 *
 * Accept a completed signature submission:
 *  - Verifies sign token
 *  - Validates request body with zod
 *  - Uploads signature + optional photos to OSS
 *  - Creates a SignRecord and transitions order status → SIGNED
 *  - Sends a Feishu notification (best-effort)
 *
 * Body: { signerName, signerPhone?, signatureDataUrl, photoDataUrls?, remark? }
 *
 * Errors:
 *   400 — invalid token, expired, or bad body
 *   404 — order not found
 *   409 — order already signed / rejected / cancelled
 *   500 — OSS upload failed or DB error
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

  // Parse and validate request body
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("请求体格式错误");
  }

  const parsed = SubmitSchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest(parsed.error.errors.map((e) => e.message).join("; "));
  }

  const { signerName, signerPhone, signatureDataUrl, photoDataUrls, remark } =
    parsed.data;

  // Fetch order and verify state
  const order = await prisma.deliveryOrder.findFirst({
    where: {
      id: payload.orderId,
      signToken: token,
    },
  });

  if (!order) {
    return notFound("送货单不存在");
  }

  if (order.status === "SIGNED") {
    return NextResponse.json(
      { error: "ALREADY_SIGNED", message: "该送货单已完成签收" },
      { status: 409 },
    );
  }

  if (order.status === "REJECTED") {
    return NextResponse.json(
      { error: "ALREADY_REJECTED", message: "该送货单已被拒收" },
      { status: 409 },
    );
  }

  if (order.status === "CANCELLED") {
    return NextResponse.json(
      { error: "CANCELLED", message: "该送货单已取消" },
      { status: 409 },
    );
  }

  // Decode and upload signature image
  const sigParsed = parseDataUrl(signatureDataUrl);
  if (!sigParsed) {
    return badRequest("签名图片格式无效");
  }

  const signatureKey = getSignatureImageKey(order.id);
  try {
    await putObject(signatureKey, sigParsed.buffer, sigParsed.mimeType);
  } catch (err) {
    console.error("[sign/submit] OSS upload failed for signature:", err);
    return serverError("签名图片上传失败，请重试");
  }

  // Decode and upload photos
  const uploadedPhotoKeys: string[] = [];
  if (photoDataUrls && photoDataUrls.length > 0) {
    for (let i = 0; i < photoDataUrls.length; i++) {
      const photoParsed = parseDataUrl(photoDataUrls[i]);
      if (!photoParsed) {
        return badRequest(`第 ${i + 1} 张照片格式无效`);
      }
      const photoKey = getPhotoKey(order.id, i);
      try {
        await putObject(photoKey, photoParsed.buffer, photoParsed.mimeType);
        uploadedPhotoKeys.push(photoKey);
      } catch (err) {
        console.error(
          `[sign/submit] OSS upload failed for photo index=${i}:`,
          err,
        );
        return serverError(`第 ${i + 1} 张照片上传失败，请重试`);
      }
    }
  }

  // Get client metadata for audit
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined;
  const userAgent = request.headers.get("user-agent") ?? undefined;

  const signedAt = new Date();

  // Persist SignRecord and update order status in a single transaction
  const signRecord = await prisma.$transaction(async (tx) => {
    const record = await tx.signRecord.create({
      data: {
        orderId: order.id,
        signerName,
        signerPhone,
        signatureUrl: signatureKey,
        photoUrls: uploadedPhotoKeys,
        remark,
        signedAt,
        ipAddress,
        userAgent,
      },
    });

    await tx.deliveryOrder.update({
      where: { id: order.id },
      data: { status: "SIGNED" },
    });

    return record;
  });

  // Fire-and-forget Feishu notification
  void notifySignComplete({
    orderNo: order.orderNo,
    customerName: order.customerName,
    signerName,
    signedAt,
  });

  // Generate short-lived view URLs for the response
  const responseData = {
    id: signRecord.id,
    orderId: order.id,
    orderNo: order.orderNo,
    signerName: signRecord.signerName,
    signedAt: signRecord.signedAt.toISOString(),
    signatureUrl: generateViewUrl(signatureKey),
    photoUrls: uploadedPhotoKeys.map((k) => generateViewUrl(k)),
  };

  return NextResponse.json(serializeBigInt(responseData), { status: 201 });
}
