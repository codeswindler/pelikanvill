import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import path from "path";
import { promises as fs } from "fs";
import { createReadStream, statSync } from "fs";
import { Readable } from "stream";

export const dynamic = "force-dynamic";

function createPdfStream(
  filePath: string,
  options?: Parameters<typeof createReadStream>[1]
) {
  return Readable.toWeb(createReadStream(filePath, options)) as ReadableStream;
}

// HEAD /api/menus/active - Check if an active menu exists (public)
export async function HEAD() {
  try {
    const activeMenu = await prisma.menu.findFirst({
      where: { isActive: true },
    });

    if (!activeMenu) {
      return new NextResponse(null, { status: 404 });
    }

    const filePath = path.join(
      process.cwd(),
      "uploads",
      "menus",
      activeMenu.filename
    );
    const stats = await fs.stat(filePath);
    const etag = `"${activeMenu.filename}-${stats.mtime.getTime()}"`;

    return new NextResponse(null, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "ETag": etag,
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}

// GET /api/menus/active - Serve the active menu PDF (public)
export async function GET(request: NextRequest) {
  try {
    const activeMenu = await prisma.menu.findFirst({
      where: { isActive: true },
    });

    if (!activeMenu) {
      return new NextResponse("No active menu found", { status: 404 });
    }

    const filePath = path.join(
      process.cwd(),
      "uploads",
      "menus",
      activeMenu.filename
    );

    // Get file stats
    const stats = statSync(filePath);
    const fileSize = stats.size;
    const etag = `"${activeMenu.filename}-${stats.mtime.getTime()}"`;
    
    // Check ETag for cache validation
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "ETag": etag,
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      });
    }

    // Support range requests for large files (streaming) - CRITICAL for smooth scrolling
    const range = request.headers.get("range");
    
    if (range) {
      // Parse range header
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Limit chunk size to prevent loading too much at once (max 2MB chunks)
      const maxChunkSize = 2 * 1024 * 1024;
      const actualEnd = Math.min(end, start + maxChunkSize - 1);
      const actualChunkSize = actualEnd - start + 1;

      // Create read stream for the range
      const stream = createPdfStream(filePath, { start, end: actualEnd });
      
      return new NextResponse(stream, {
        status: 206, // Partial Content
        headers: {
          "Content-Range": `bytes ${start}-${actualEnd}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": actualChunkSize.toString(),
          "Content-Type": "application/pdf",
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          "ETag": etag,
        },
      });
    }

    // For large files, ALWAYS use streaming with range support
    // This ensures smooth scrolling - browser loads only what's needed
    if (fileSize > 10 * 1024 * 1024) {
      // Stream large files - browser will use range requests automatically
      const stream = createPdfStream(filePath);
      
      return new NextResponse(stream, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${activeMenu.originalName}"`,
          "Content-Length": fileSize.toString(),
          "Accept-Ranges": "bytes", // Critical: enables range requests for smooth scrolling
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          "ETag": etag,
        },
      });
    }

    // For smaller files, read into buffer (faster for small files)
    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${activeMenu.originalName}"`,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "ETag": etag,
        "Accept-Ranges": "bytes",
        "Content-Length": fileSize.toString(),
      },
    });
  } catch (error) {
    console.error("Failed to serve active menu:", error);
    return new NextResponse("Failed to retrieve menu", { status: 500 });
  }
}
