import { NextResponse } from "next/server";
import { getDriverSession } from "@/lib/driver-session";
import { serverError } from "@/lib/errors";

export async function POST(): Promise<NextResponse> {
  try {
    const session = await getDriverSession();
    session.destroy();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[driver/logout] unexpected error:", err);
    return serverError();
  }
}
