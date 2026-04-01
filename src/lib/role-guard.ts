import { getSession } from "@/lib/session";
import type { NextRequest } from "next/server";
import { unauthorized } from "@/lib/errors";

type AllowedRole = "ADMIN" | "VIEWER";

/**
 * 检查管理员角色权限。
 * 写操作（POST/PUT/DELETE）只允许 ADMIN 角色。
 * 读操作（GET）允许 ADMIN 和 VIEWER。
 *
 * 返回 null 表示通过，返回 NextResponse 表示需要直接返回该错误响应。
 */
export async function requireRole(
  _req: NextRequest,
  allowed?: AllowedRole[],
) {
  const session = await getSession();
  if (!session?.userId) {
    return unauthorized("未登录");
  }
  if (allowed && !allowed.includes(session.role as AllowedRole)) {
    return unauthorized("权限不足");
  }
  return null; // null = 通过
}
