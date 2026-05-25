import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { compressPDF, getPDFSize } from "@/lib/pdf-optimizer";
import type { Menu } from "@prisma/client";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "menus");

export const dynamic = "force-dynamic";

// Max file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

type NumericLike = number | string | bigint;

interface RawMenuRow {
  id: NumericLike;
  filename: string;
  originalName: string;
  fileSizeMB: NumericLike | null;
  originalSizeMB: NumericLike | null;
  isActive: boolean | NumericLike;
  uploadedAt: Date | string;
}

interface MenuUploadOptimization {
  originalSizeMB: string;
  compressedSizeMB: string;
  reductionPercent: string;
  optimized: boolean;
  note?: string;
}

interface MenuUploadResponse {
  menu: Menu;
  optimization?: MenuUploadOptimization;
}

function isMissingFileSizeFieldsError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("fileSizeMB") ||
      error.message.includes("Unknown argument"))
  );
}

// GET /api/menus - List all menus (admin only)
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token || !(await verifySession(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Use raw query to get file size fields even if Prisma client doesn't support them
    const menus = await prisma.$queryRaw<RawMenuRow[]>`
      SELECT id, filename, originalName, fileSizeMB, originalSizeMB, isActive, uploadedAt
      FROM menus
      ORDER BY uploadedAt DESC
    `;
    
    // Convert to proper format
    const formattedMenus = menus.map((m) => ({
      id: Number(m.id),
      filename: m.filename,
      originalName: m.originalName,
      fileSizeMB: m.fileSizeMB ? Number(m.fileSizeMB) : null,
      originalSizeMB: m.originalSizeMB ? Number(m.originalSizeMB) : null,
      isActive: Boolean(m.isActive),
      uploadedAt: m.uploadedAt,
    }));
    
    return NextResponse.json({ menus: formattedMenus });
  } catch (error) {
    console.error("Failed to fetch menus:", error);
    // Fallback to regular Prisma query if raw query fails
    try {
      const menus = await prisma.menu.findMany({
        orderBy: { uploadedAt: "desc" },
      });
      return NextResponse.json({ menus });
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch menus" },
        { status: 500 }
      );
    }
  }
}

// POST /api/menus - Upload new menu (admin only)
export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token || !(await verifySession(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` },
        { status: 400 }
      );
    }

    // Ensure uploads dir exists
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    const id = randomUUID();
    const filename = `${id}.pdf`;
    const tempPath = path.join(UPLOADS_DIR, `temp_${filename}`);
    const filePath = path.join(UPLOADS_DIR, filename);
    
    // Write original file first
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempPath, buffer);

    // Get original size
    const originalSizeMB = await getPDFSize(tempPath);
    
    // Compress PDF (maintains quality, reduces size)
    let compressionResult;
    try {
      compressionResult = await compressPDF(tempPath, filePath);
      // Remove temp file
      await fs.unlink(tempPath).catch(() => {});
    } catch (error) {
      // If compression fails, use original
      console.error("Compression error, using original:", error);
      await fs.rename(tempPath, filePath);
      compressionResult = {
        originalSize: file.size,
        compressedSize: file.size,
        reduction: 0,
        skipped: true,
        reason: "Compression process failed",
      };
    }

    const compressedSizeMB = compressionResult.compressedSize / (1024 * 1024);

    // Check if this is the first menu
    const existingCount = await prisma.menu.count();

    // Create menu - use try/catch to handle schema differences
    let menu: Menu;
    try {
      // Try with new fields first
      menu = await prisma.menu.create({
        data: {
          filename,
          originalName: file.name,
          fileSizeMB: compressedSizeMB,
          originalSizeMB: originalSizeMB,
          isActive: existingCount === 0,
        },
      });
    } catch (error) {
      // If new fields don't exist, create without them (backward compatible)
      if (isMissingFileSizeFieldsError(error)) {
        console.log("Creating menu without file size fields (schema not updated)");
        menu = await prisma.menu.create({
          data: {
            filename,
            originalName: file.name,
            isActive: existingCount === 0,
          },
        });
        
        // Try to update with file size using raw SQL (database has columns, Prisma client just not regenerated)
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE menus SET fileSizeMB = ?, originalSizeMB = ? WHERE id = ?`,
            compressedSizeMB,
            originalSizeMB,
            menu.id
          );
          // Manually add the fields to the menu object for the response
          menu.fileSizeMB = compressedSizeMB;
          menu.originalSizeMB = originalSizeMB;
          console.log("File size updated via raw SQL:", { id: menu.id, fileSizeMB: compressedSizeMB, originalSizeMB });
        } catch (updateError) {
          console.log("Could not update file size (columns may not exist):", updateError);
        }
      } else {
        throw error; // Re-throw if it's a different error
      }
    }

    // Build response with optimization info
    const response: MenuUploadResponse = { menu };
    
    if (compressionResult.reduction > 0) {
      response.optimization = {
        originalSizeMB: originalSizeMB.toFixed(2),
        compressedSizeMB: compressedSizeMB.toFixed(2),
        reductionPercent: compressionResult.reduction.toFixed(1),
        optimized: true,
      };
    } else if (compressionResult.skipped && compressionResult.reason) {
      // Compression was skipped
      response.optimization = {
        originalSizeMB: originalSizeMB.toFixed(2),
        compressedSizeMB: compressedSizeMB.toFixed(2),
        reductionPercent: "0.0",
        note: compressionResult.reason,
        optimized: false,
      };
    } else {
      response.optimization = {
        originalSizeMB: originalSizeMB.toFixed(2),
        compressedSizeMB: compressedSizeMB.toFixed(2),
        reductionPercent: compressionResult.reduction.toFixed(1),
        optimized: false,
      };
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Failed to upload menu:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to upload menu: ${errorMessage}` },
      { status: 500 }
    );
  }
}
