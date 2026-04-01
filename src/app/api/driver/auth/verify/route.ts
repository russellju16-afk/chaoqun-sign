import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyCode } from "@/lib/verification-code";
import { getDriverSession } from "@/lib/driver-session";
import { badRequest, unauthorized, serverError } from "@/lib/errors";
import { getRedis } from "@/lib/redis";

const verifySchema = z.object({
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "请输入有效的手机号码（11位，以1开头）"),
  code: z
    .string()
    .length(6, "验证码为6位数字")
    .regex(/^\d{6}$/, "验证码必须为6位数字"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? "请求参数错误");
    }

    const { phone, code } = parsed.data;

    // 暴力破解防护：每个手机号每个验证码最多允许 5 次尝试，TTL 与验证码同周期（5 分钟）
    const redis = getRedis();
    const attemptsKey = `verify_attempts:${phone}`;
    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) {
      // 第一次计数时设置 5 分钟 TTL，与验证码生命周期保持一致
      await redis.expire(attemptsKey, 5 * 60);
    }
    if (attempts > 5) {
      return NextResponse.json(
        {
          error: "TOO_MANY_ATTEMPTS",
          message: "验证次数过多，请重新获取验证码",
        },
        { status: 429 },
      );
    }

    // Verify the code from Redis first
    const codeValid = await verifyCode(phone, code);
    if (!codeValid) {
      return unauthorized("验证码错误或已过期");
    }

    // 验证成功后删除计数器
    await redis.del(attemptsKey);

    // Fetch the driver after code verification
    const driver = await prisma.driver.findUnique({
      where: { phone },
      select: { id: true, name: true, phone: true, isActive: true },
    });

    if (!driver || !driver.isActive) {
      return unauthorized("账号不存在或已被停用，请联系管理员");
    }

    // Establish the driver session
    const session = await getDriverSession();
    session.driverId = driver.id;
    session.driverName = driver.name;
    session.phone = driver.phone;
    await session.save();

    return NextResponse.json({
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
    });
  } catch (err) {
    console.error("[driver/verify] unexpected error:", err);
    return serverError();
  }
}
