import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateAndStoreCode } from "@/lib/verification-code";
import { sendVerificationCode } from "@/lib/sms";
import { badRequest, serverError } from "@/lib/errors";
import { smsRateLimit } from "@/lib/rate-limit";

const sendCodeSchema = z.object({
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "请输入有效的手机号码（11位，以1开头）"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();
    const parsed = sendCodeSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? "请求参数错误");
    }

    const { phone } = parsed.data;

    // Check the driver exists and is active
    const driver = await prisma.driver.findUnique({
      where: { phone },
      select: { id: true, isActive: true },
    });

    if (!driver || !driver.isActive) {
      return badRequest("未找到该司机，请联系管理员");
    }

    // SMS 频率限制：每个手机号每小时最多发送 5 条短信
    const rateLimitResult = await smsRateLimit(phone);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "TOO_MANY_REQUESTS", message: "发送短信过于频繁，请稍后再试" },
        { status: 429 },
      );
    }

    // Rate-limit check and code generation are handled inside generateAndStoreCode
    let code: string;
    try {
      code = await generateAndStoreCode(phone);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "验证码发送失败，请稍后重试";
      return badRequest(message);
    }

    // Send SMS — let unexpected failures surface so we can log them
    await sendVerificationCode(phone, code);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[driver/send-code] unexpected error:", err);
    return serverError();
  }
}
