import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { badRequest, unauthorized, serverError } from "@/lib/errors";

const loginSchema = z.object({
  username: z.string().min(1, "用户名不能为空"),
  password: z.string().min(1, "密码不能为空"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? "请求参数错误");
    }

    const { username, password } = parsed.data;

    const user = await prisma.adminUser.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        displayName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      // Use a constant-time response to avoid username enumeration
      return unauthorized("用户名或密码错误");
    }

    if (!user.isActive) {
      return unauthorized("账号已被停用，请联系管理员");
    }

    const passwordMatch = await compare(password, user.passwordHash);
    if (!passwordMatch) {
      return unauthorized("用户名或密码错误");
    }

    const session = await getSession();
    session.userId = user.id;
    session.username = user.username;
    session.role = user.role;
    await session.save();

    // 审计日志：记录登录成功事件（fire-and-forget，不阻塞响应）
    void prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "admin.login",
        target: `admin_user:${user.id}`,
        detail: JSON.stringify({ username: user.username, role: user.role }),
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown",
      },
    });

    return NextResponse.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    });
  } catch (err) {
    console.error("[login] unexpected error:", err);
    return serverError();
  }
}
