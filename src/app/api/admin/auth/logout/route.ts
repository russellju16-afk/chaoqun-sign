import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { serverError } from "@/lib/errors";

export async function POST(): Promise<NextResponse> {
  try {
    const session = await getSession();
    session.destroy();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[logout] unexpected error:", err);
    return serverError();
  }
}
