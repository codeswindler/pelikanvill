import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/menus/[id]/activate
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token || !(await verifySession(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const menuId = parseInt(id, 10);
  if (isNaN(menuId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const menu = await prisma.menu.findUnique({ where: { id: menuId } });
    if (!menu) {
      return NextResponse.json({ error: "Menu not found" }, { status: 404 });
    }

    // Deactivate all, then activate the selected one
    await prisma.$transaction([
      prisma.menu.updateMany({ data: { isActive: false } }),
      prisma.menu.update({ where: { id: menuId }, data: { isActive: true } }),
    ]);

    return NextResponse.json({ message: "Menu activated" });
  } catch (error) {
    console.error(`Failed to activate menu ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to activate menu" },
      { status: 500 }
    );
  }
}
