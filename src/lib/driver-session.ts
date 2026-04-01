import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export interface DriverSessionData {
  driverId: string;
  driverName: string;
  phone: string;
}

export const DRIVER_SESSION_COOKIE_NAME = "chaoqun_sign_driver_session";

/** TTL in seconds: 7 days */
const DRIVER_SESSION_TTL = 7 * 24 * 60 * 60;

/**
 * Resolve the session secret lazily so this module can be imported without
 * crashing during edge-runtime cold starts.  Throws clearly at request time
 * if SESSION_SECRET is absent — an empty key allows cookie forgery.
 */
function requireSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "[driver-session] SESSION_SECRET environment variable is not set. " +
        "Set it to a strong random string (32+ chars) before starting the server.",
    );
  }
  return secret;
}

export const driverSessionOptions: SessionOptions = {
  get password(): string {
    return requireSessionSecret();
  },
  cookieName: DRIVER_SESSION_COOKIE_NAME,
  ttl: DRIVER_SESSION_TTL,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  },
};

/**
 * Get the iron-session for driver authentication.
 * Uses a separate cookie ("chaoqun_sign_driver_session") from the admin session
 * so the two auth contexts never interfere.
 */
export async function getDriverSession() {
  const cookieStore = await cookies();
  return getIronSession<DriverSessionData>(cookieStore, driverSessionOptions);
}

/**
 * 验证司机 session 并检查数据库中的 isActive 状态。
 * 若司机已被停用，销毁 session 并返回 null。
 * 返回 null 表示鉴权失败，需要返回 401。
 */
export async function validateDriverSession() {
  const session = await getDriverSession();
  if (!session?.driverId) return null;

  // 查询数据库确认司机仍处于激活状态
  const driver = await prisma.driver.findUnique({
    where: { id: session.driverId },
    select: { isActive: true },
  });

  if (!driver?.isActive) {
    // 司机已被停用，销毁 session 阻止继续使用
    await session.destroy();
    return null;
  }

  return session;
}
