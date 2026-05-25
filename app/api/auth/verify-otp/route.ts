import { NextRequest, NextResponse } from "next/server";
import { verifySession, verifyOtp, createSession, destroySession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("admin_session")?.value;
    if (!token) {
      return NextResponse.json(
        { error: "No session found. Please login again." },
        { status: 401 }
      );
    }

    const session = await verifySession(token);
    if (!session) {
      return NextResponse.json(
        { error: "Session expired. Please login again." },
        { status: 401 }
      );
    }

    if (session.otpVerified) {
      return NextResponse.json({ success: true, message: "Already verified" });
    }

    const { code } = await request.json();
    if (!code) {
      return NextResponse.json(
        { error: "OTP code is required" },
        { status: 400 }
      );
    }

    const isValid = await verifyOtp(session.userId, code);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid or expired OTP code" },
        { status: 401 }
      );
    }

    // Destroy old partial session
    await destroySession(token);

    // Create new full session with otpVerified = true
    const newToken = await createSession({
      userId: session.userId,
      username: session.username,
      role: session.role,
      permissions: session.permissions,
      otpVerified: true,
    });

    const response = NextResponse.json({ success: true });

    response.cookies.set("admin_session", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 5 * 60, // 5 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("OTP verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
