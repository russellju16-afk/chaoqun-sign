import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";

export interface SessionData {
  userId: string;
  username: string;
  role: Role;
}

export const SESSION_COOKIE_NAME = "chaoqun_sign_session";

/** TTL in seconds: 8 hours */
const SESSION_TTL = 8 * 60 * 60;

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "",
  cookieName: SESSION_COOKIE_NAME,
  ttl: SESSION_TTL,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  },
};

/**
 * Get the iron-session for App Router route handlers and server components.
 * Uses next/headers cookies() store — works in Server Components, Route Handlers,
 * and Server Actions.
 */
export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
