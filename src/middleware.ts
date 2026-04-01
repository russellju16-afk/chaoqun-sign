import { NextRequest, NextResponse } from "next/server";
import { unsealData } from "iron-session";
import { SESSION_COOKIE_NAME, type SessionData } from "@/lib/session";

// ---------------------------------------------------------------------------
// Route classification helpers
// ---------------------------------------------------------------------------

/** Public admin paths that never need a session check. */
const ADMIN_PUBLIC_PATHS: readonly string[] = ["/admin/login"];

/** API prefixes that are always public (driver / sign flows). */
const PUBLIC_API_PREFIXES: readonly string[] = [
  "/api/admin/auth/", // login, logout, me — handled below with finer logic
  "/api/sign/",
  "/api/driver/",
];

/**
 * Returns true when the path is one of the auth endpoints that should be
 * reachable without a session (login) or exist purely to manage session state
 * (logout, me — also public-enough to be reached unauthenticated for a 401).
 */
function isAdminAuthPath(pathname: string): boolean {
  return pathname.startsWith("/api/admin/auth/");
}

function isAdminApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/admin/") && !isAdminAuthPath(pathname);
}

function isAdminUiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/admin/") &&
    !ADMIN_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p))
  );
}

// ---------------------------------------------------------------------------
// Session extraction (Edge-compatible — no next/headers)
// ---------------------------------------------------------------------------

async function getSessionData(
  req: NextRequest,
): Promise<SessionData | null> {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME);
  if (!cookie?.value) return null;

  const password = process.env.SESSION_SECRET;
  if (!password) return null;

  try {
    const data = await unsealData<Partial<SessionData>>(cookie.value, {
      password,
    });

    // Validate that the decoded object has the expected shape
    if (
      typeof data.userId === "string" &&
      typeof data.username === "string" &&
      typeof data.role === "string"
    ) {
      return data as SessionData;
    }
    return null;
  } catch {
    // Corrupted or tampered cookie — treat as no session
    return null;
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Non-admin and explicitly public paths pass through immediately
  if (
    PUBLIC_API_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix),
    )
  ) {
    return NextResponse.next();
  }

  // Static / sign / driver UI paths pass through
  if (
    pathname.startsWith("/sign/") ||
    pathname.startsWith("/driver/") ||
    pathname === "/" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Protected /api/admin/* (excluding /api/admin/auth/*)
  if (isAdminApiPath(pathname)) {
    const session = await getSessionData(req);
    if (!session) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "未登录或会话已过期" },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // Protected /admin/* UI routes (excluding /admin/login)
  if (isAdminUiPath(pathname)) {
    const session = await getSessionData(req);
    if (!session) {
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and Next.js internals that never
     * need middleware processing.
     */
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
};
