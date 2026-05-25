import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

// PATCH /api/users/[id] - Update user (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifySession(token);
  if (!session || !session.otpVerified || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { phone, role, password, otpEnabled, notificationsEnabled, permissions } = body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined && ["admin", "manager"].includes(role)) updateData.role = role;
    if (otpEnabled !== undefined) updateData.otpEnabled = otpEnabled;
    if (notificationsEnabled !== undefined) updateData.notificationsEnabled = notificationsEnabled;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Update permissions if provided
    if (permissions !== undefined) {
      const validPermissions = (permissions as string[]).filter((p) =>
        ["view_feedback", "generate_qr"].includes(p)
      );

      // Delete existing permissions
      await prisma.userPermission.deleteMany({ where: { userId } });

      // Re-create
      if (validPermissions.length > 0) {
        await prisma.userPermission.createMany({
          data: validPermissions.map((p) => ({
            userId,
            permission: p,
          })),
        });
      }
    }

    // Fetch updated user
    const updated = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        phone: true,
        role: true,
        otpEnabled: true,
        notificationsEnabled: true,
        permissions: { select: { permission: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      user: {
        ...updated,
        permissions: updated?.permissions.map((p) => p.permission) || [],
      },
    });
  } catch (error) {
    console.error(`Failed to update user ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifySession(token);
  if (!session || !session.otpVerified || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  // Prevent self-deletion
  if (userId === session.userId) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    );
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }
}
