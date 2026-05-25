import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("admin_session")?.value;
    if (token) {
      await destroySession(token);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete("admin_session");
    return response;
  } catch {
    const response = NextResponse.json({ success: true });
    response.cookies.delete("admin_session");
    return response;
  }
}
