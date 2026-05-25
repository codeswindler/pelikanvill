import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// PATCH /api/feedback/[id] - Mark as read (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token || !(await verifySession(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const feedbackId = parseInt(id, 10);
  if (isNaN(feedbackId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    await prisma.feedback.update({
      where: { id: feedbackId },
      data: { isRead: true },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Feedback not found" },
      { status: 404 }
    );
  }
}

// DELETE /api/feedback/[id] - Delete feedback (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token || !(await verifySession(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const feedbackId = parseInt(id, 10);
  if (isNaN(feedbackId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    await prisma.feedback.delete({ where: { id: feedbackId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Feedback not found" },
      { status: 404 }
    );
  }
}
