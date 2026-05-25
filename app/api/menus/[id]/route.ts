import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { promises as fs } from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "menus");

// DELETE /api/menus/[id]
export async function DELETE(
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

    if (menu.isActive) {
      return NextResponse.json(
        { error: "Cannot delete the active menu. Activate another menu first." },
        { status: 400 }
      );
    }

    await prisma.menu.delete({ where: { id: menuId } });

    // Delete file from disk
    const filePath = path.join(UPLOADS_DIR, menu.filename);
    await fs.unlink(filePath).catch(() => {});

    return NextResponse.json({ message: "Menu deleted" });
  } catch (error) {
    console.error(`Failed to delete menu ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to delete menu" },
      { status: 500 }
    );
  }
}
