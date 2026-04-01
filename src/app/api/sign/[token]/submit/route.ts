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
      // 只允许安全的图片格式，防止 SVG XSS 攻击
      (v) =>
        v.startsWith("data:image/png;") ||
        v.startsWith("data:image/jpeg;") ||
        v.startsWith("data:image/webp;"),
      "仅支持 PNG/JPEG/WebP 格式",
    ),
  photoDataUrls: z
    .array(
      z.string().refine(
        // 只允许安全的图片格式，防止 SVG XSS 攻击
        (v) =>
          v.startsWith("data:image/png;") ||
          v.startsWith("data:image/jpeg;") ||
          v.startsWith("data:image/webp;"),
        "仅支持 PNG/JPEG/WebP 格式",
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

  // 先查询订单是否存在（仅做存在性校验，状态检查放到事务内）
  const order = await prisma.deliveryOrder.findFirst({
    where: {
      id: payload.orderId,
      signToken: token,
    },
  });

  if (!order) {
    return notFound("送货单不存在");
  }

  // 解析签名图 data URL（在上传前先校验格式，避免无效数据发到 OSS）
  const sigParsed = parseDataUrl(signatureDataUrl);
  if (!sigParsed) {
    return badRequest("签名图片格式无效");
  }

  // 解析所有照片 data URL（提前全部解析，格式错误立即返回）
  const parsedPhotos: Array<{ buffer: Buffer; mimeType: string; key: string }> =
    [];
  if (photoDataUrls && photoDataUrls.length > 0) {
    for (let i = 0; i < photoDataUrls.length; i++) {
      const photoParsed = parseDataUrl(photoDataUrls[i]);
      if (!photoParsed) {
        return badRequest(`第 ${i + 1} 张照片格式无效`);
      }
      parsedPhotos.push({
        ...photoParsed,
        key: getPhotoKey(order.id, i),
      });
    }
  }

  const signatureKey = getSignatureImageKey(order.id);

  // 签名图与所有照片并行上传到 OSS，减少总等待时间
  try {
    await Promise.all([
      putObject(signatureKey, sigParsed.buffer, sigParsed.mimeType),
      ...parsedPhotos.map(({ key, buffer, mimeType }) =>
        putObject(key, buffer, mimeType),
      ),
    ]);
  } catch (err) {
    console.error("[sign/submit] OSS upload failed:", err);
    return serverError("文件上传失败，请重试");
  }

  const uploadedPhotoKeys = parsedPhotos.map((p) => p.key);

  // Get client metadata for audit
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined;
  const userAgent = request.headers.get("user-agent") ?? undefined;

  const signedAt = new Date();

  // 在事务内做状态检查 + 写入，消除 TOCTOU 竞态：
  // 若两个请求同时通过了上面的存在性检查，事务内的 findFirst 只会让其中一个成功，
  // 另一个因查不到符合条件的行而返回 409。
  const signRecord = await prisma
    .$transaction(async (tx) => {
      // 在锁定范围内再次确认状态未被并发请求抢先处理
      const lockedOrder = await tx.deliveryOrder.findFirst({
        where: {
          id: order.id,
          status: { notIn: ["SIGNED", "REJECTED", "CANCELLED"] },
        },
      });

      if (!lockedOrder) {
        // 并发重复提交：订单已被处理，抛出特殊错误让外层捕获并返回 409
        const err = new Error("ORDER_ALREADY_PROCESSED");
        (err as Error & { code: string }).code = "ORDER_ALREADY_PROCESSED";
        throw err;
      }

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
    })
    .catch((err: unknown) => {
      // 将事务内抛出的"已处理"错误转换为 null，由外层统一返回 409
      if (
        err instanceof Error &&
        (err as Error & { code?: string }).code === "ORDER_ALREADY_PROCESSED"
      ) {
        return null;
      }
      throw err;
    });

  if (signRecord === null) {
    return NextResponse.json(
      { error: "ALREADY_PROCESSED", message: "该送货单已完成签收或已取消" },
      { status: 409 },
    );
  }

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
