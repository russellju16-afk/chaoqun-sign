import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface DriverSessionData {
  driverId: string;
  driverName: string;
  phone: string;
}

export const DRIVER_SESSION_COOKIE_NAME = "chaoqun_sign_driver_session";

/** TTL in seconds: 7 days */
const DRIVER_SESSION_TTL = 7 * 24 * 60 * 60;

export const driverSessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "",
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
