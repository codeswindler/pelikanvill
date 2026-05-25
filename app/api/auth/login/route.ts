import { NextRequest, NextResponse } from "next/server";
import { authenticate, createSession, generateOtp } from "@/lib/auth";
import { sendOtp } from "@/lib/sms";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    const result = await authenticate(username, password);

    if (!result.success || !result.user || !result.permissions) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const { user, permissions } = result;

    // If OTP is enabled (production only), create a partial session and send OTP
    const otpRequired =
      user.otpEnabled && user.phone && process.env.NODE_ENV === "production";

    if (otpRequired) {
      // Create partial session (otpVerified = false)
      const token = await createSession({
        userId: user.id,
        username: user.username,
        role: user.role,
        permissions,
        otpVerified: false,
      });

      // Generate and send OTP
      const otpCode = await generateOtp(user.id);
      await sendOtp(user.phone, otpCode);

      const response = NextResponse.json({
        requiresOtp: true,
        message: "OTP sent to your registered phone number",
      });

      response.cookies.set("admin_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 5 * 60, // 5 minutes
        path: "/",
      });

      return response;
    }

    // No OTP required - create full session
    const token = await createSession({
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions,
      otpVerified: true,
    });

    const response = NextResponse.json({ success: true });

    response.cookies.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 5 * 60, // 5 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
