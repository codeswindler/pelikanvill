import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

// GET /api/users - List all users (admin only)
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifySession(token);
  if (!session || !session.otpVerified || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        phone: true,
        role: true,
        otpEnabled: true,
        notificationsEnabled: true,
        createdAt: true,
        updatedAt: true,
        permissions: {
          select: { permission: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const formatted = users.map((u) => ({
      ...u,
      permissions: u.permissions.map((p) => p.permission),
    }));

    return NextResponse.json({ users: formatted });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user (admin only)
export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifySession(token);
  if (!session || !session.otpVerified || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { username, password, phone, role, permissions, otpEnabled, notificationsEnabled } =
      await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (role && !["admin", "manager"].includes(role)) {
      return NextResponse.json(
        { error: "Role must be 'admin' or 'manager'" },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existing = await prisma.user.findUnique({
      where: { username },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const validPermissions = (permissions || []).filter((p: string) =>
      ["view_feedback", "generate_qr"].includes(p)
    );

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        phone: phone || "",
        role: role || "manager",
        otpEnabled: otpEnabled || false,
        notificationsEnabled: notificationsEnabled !== false,
        permissions: {
          createMany: {
            data: validPermissions.map((p: string) => ({ permission: p })),
          },
        },
      },
      include: { permissions: true },
    });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          username: user.username,
          phone: user.phone,
          role: user.role,
          otpEnabled: user.otpEnabled,
          notificationsEnabled: user.notificationsEnabled,
          permissions: user.permissions.map((p) => p.permission),
          createdAt: user.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
