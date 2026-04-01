import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { unauthorized, serverError } from "@/lib/errors";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (!session.userId) {
      return unauthorized();
    }

    const user = await prisma.adminUser.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      // Session exists but user was deleted or deactivated — clear it
      session.destroy();
      return unauthorized("账号不存在或已被停用");
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    });
  } catch (err) {
    console.error("[me] unexpected error:", err);
    return serverError();
  }
}
