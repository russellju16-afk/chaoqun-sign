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

/**
 * Resolve the session secret at first use rather than at module evaluation
 * time.  This allows the middleware to import SESSION_COOKIE_NAME and
 * SessionData (types) without crashing during the edge-runtime cold start when
 * SESSION_SECRET has not yet been injected into the process environment.
 *
 * At actual request time the secret must be present — a missing secret means
 * every session cookie can be forged, so we throw clearly rather than
 * silently falling back to an empty key.
 */
function requireSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "[session] SESSION_SECRET environment variable is not set. " +
        "Set it to a strong random string (32+ chars) before starting the server.",
    );
  }
  return secret;
}

export function getSessionOptions(): SessionOptions {
  return {
    password: requireSessionSecret(),
    cookieName: SESSION_COOKIE_NAME,
    ttl: SESSION_TTL,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

// Keep a named export for callers that read sessionOptions directly
// (e.g. any future direct use outside getSession).
export const sessionOptions: SessionOptions = {
  // This is evaluated at module load in Node.js route handlers where the env
  // is always fully populated; edge-only paths import only SESSION_COOKIE_NAME.
  get password(): string {
    return requireSessionSecret();
  },
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
