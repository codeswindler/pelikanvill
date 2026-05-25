import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { qrUrls } from "@/lib/qr";

// POST /api/qr-history - Log QR generation
export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifySession(token);
  if (!session || !session.otpVerified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { qrType } = (await request.json()) as { qrType?: string };

    if (qrType !== "menu" && qrType !== "review") {
      return NextResponse.json(
        { error: "Valid qrType is required" },
        { status: 400 }
      );
    }

    const entry = await prisma.qrHistory.create({
      data: {
        generatedByUserId: session.userId,
        qrType,
        url: qrUrls[qrType],
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Failed to log QR generation:", error);
    return NextResponse.json(
      { error: "Failed to log QR generation" },
      { status: 500 }
    );
  }
}

// DELETE /api/qr-history - Undo QR generation (delete last entry)
export async function DELETE(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifySession(token);
  if (!session || !session.otpVerified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prisma.qrHistory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Entry not found" },
      { status: 404 }
    );
  }
}
