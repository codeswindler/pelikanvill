import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dispatchFeedbackAlert } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// GET /api/feedback - List all feedback (admin only)
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token || !(await verifySession(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const feedback = await prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("Failed to fetch feedback:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}

// POST /api/feedback - Submit feedback (public)
export async function POST(request: NextRequest) {
  try {
    const { name, message, rating } = await request.json();

    if (!message || !rating) {
      return NextResponse.json(
        { error: "Message and rating are required" },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Message must be under 2000 characters" },
        { status: 400 }
      );
    }

    const entry = await prisma.feedback.create({
      data: {
        name: (name || "Anonymous").trim(),
        message: message.trim(),
        rating,
      },
    });

    // Dispatch alerts (async, non-blocking)
    dispatchFeedbackAlert(entry.name, entry.rating, entry.message).catch(
      (err) => console.error("Alert dispatch error:", err)
    );

    return NextResponse.json({ feedback: entry }, { status: 201 });
  } catch (error) {
    console.error("Failed to submit feedback:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}

// PATCH /api/feedback - Mark all as read (admin only)
export async function PATCH(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token || !(await verifySession(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.feedback.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to mark all as read:", error);
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 }
    );
  }
}
