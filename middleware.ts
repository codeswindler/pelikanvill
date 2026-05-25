import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || "default-secret-change-me-in-production"
);

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin/dashboard")) {
    const token = request.cookies.get("admin_session")?.value;

    if (!token) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    try {
      // Only verify the JWT signature + expiry (no DB call — edge runtime can't use Prisma)
      const { payload } = await jwtVerify(token, SECRET_KEY);

      // If OTP not verified yet, redirect to login (OTP step)
      if (!payload.otpVerified) {
        return NextResponse.redirect(new URL("/admin?otp=pending", request.url));
      }
    } catch {
      // Token invalid or expired — clear cookie and redirect
      const response = NextResponse.redirect(new URL("/admin", request.url));
      response.cookies.delete("admin_session");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/dashboard/:path*"],
};
