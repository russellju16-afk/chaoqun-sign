import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDriverSession } from "@/lib/driver-session";
import { unauthorized, serverError } from "@/lib/errors";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getDriverSession();

    if (!session.driverId) {
      return unauthorized();
    }

    const driver = await prisma.driver.findUnique({
      where: { id: session.driverId },
      select: { id: true, name: true, phone: true, isActive: true },
    });

    if (!driver || !driver.isActive) {
      // Session exists but driver was deleted or deactivated — clear it
      session.destroy();
      return unauthorized("账号不存在或已被停用");
    }

    return NextResponse.json({
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
    });
  } catch (err) {
    console.error("[driver/me] unexpected error:", err);
    return serverError();
  }
}
