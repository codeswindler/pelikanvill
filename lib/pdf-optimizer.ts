import { PDFDocument } from "pdf-lib";
import { promises as fs } from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Compression thresholds (in MB)
const COMPRESSION_THRESHOLDS = {
  // Always compress small files - fast and effective
  ALWAYS_COMPRESS: 10,
  // Compress medium files with timeout - usually worth it
  COMPRESS_WITH_TIMEOUT: 30,
  // Large files - longer timeout
  LARGE: 50,
  // Very large files - extended timeout but still attempt
  VERY_LARGE: 100,
};

// Timeout limits (in milliseconds)
const COMPRESSION_TIMEOUTS = {
  SMALL: 5000,      // 5 seconds for <10MB
  MEDIUM: 10000,    // 10 seconds for 10-30MB
  LARGE: 20000,     // 20 seconds for 30-50MB
  VERY_LARGE: 45000, // 45 seconds for 50-100MB (still attempt compression)
};

// Minimum reduction percentage to keep compressed version
const MIN_REDUCTION_PERCENT = 2; // If compression saves <2%, use original (lowered for better compression)

/**
 * Check if Ghostscript is available on the system
 */
async function isGhostscriptAvailable(): Promise<boolean> {
  try {
    await execAsync("gs --version");
    return true;
  } catch {
    return false;
  }
}

/**
 * Compress PDF using Ghostscript (more aggressive compression)
 */
async function compressWithGhostscript(
  inputPath: string,
  outputPath: string,
  quality: "screen" | "ebook" | "printer" | "prepress" = "ebook"
): Promise<number> {
  // Ghostscript quality presets:
  // screen: 72 dpi, low quality (smallest)
  // ebook: 150 dpi, medium quality (good balance)
  // printer: 300 dpi, high quality (larger)
  // prepress: 300 dpi, highest quality (largest)
  
  const dpi = quality === "screen" ? 72 : quality === "ebook" ? 150 : 300;
  
  const command = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/${quality} -dNOPAUSE -dQUIET -dBATCH -dDetectDuplicateImages=true -dCompressFonts=true -r${dpi} -sOutputFile="${outputPath}" "${inputPath}"`;
  
  try {
    await execAsync(command);
    const stats = await fs.stat(outputPath);
    return stats.size;
  } catch (error) {
    throw new Error(`Ghostscript compression failed: ${error}`);
  }
}

/**
 * Optimize PDF structure using pdf-lib (removes unused objects, optimizes structure)
 */
async function optimizePDFStructure(
  inputPath: string,
  outputPath: string
): Promise<number> {
  const originalBuffer = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(originalBuffer, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  // Remove all metadata
  pdfDoc.setTitle("");
  pdfDoc.setAuthor("");
  pdfDoc.setSubject("");
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer("");
  pdfDoc.setCreator("");
  pdfDoc.setCreationDate(new Date());
  pdfDoc.setModificationDate(new Date());

  // Save with optimization options
  const compressedBytes = await pdfDoc.save({
    useObjectStreams: false, // Disable object streams for better compatibility
    addDefaultPage: false,
  });

  await fs.writeFile(outputPath, compressedBytes);
  return compressedBytes.length;
}

/**
 * Compress PDF with timeout and smart threshold logic
 * Returns compression result with metadata about the process
 */
export async function compressPDF(
  inputPath: string,
  outputPath: string
): Promise<{ 
  originalSize: number; 
  compressedSize: number; 
  reduction: number;
  skipped: boolean;
  reason?: string;
}> {
  try {
    const stats = await fs.stat(inputPath);
    const originalSize = stats.size;
    const sizeMB = originalSize / (1024 * 1024);

    // Determine compression strategy based on file size
    let timeout = COMPRESSION_TIMEOUTS.SMALL;
    if (sizeMB > COMPRESSION_THRESHOLDS.VERY_LARGE) {
      // Files over 100MB: Still attempt but with very long timeout
      timeout = COMPRESSION_TIMEOUTS.VERY_LARGE * 2; // 90 seconds
    } else if (sizeMB > COMPRESSION_THRESHOLDS.LARGE) {
      // Large files (50-100MB): Extended timeout
      timeout = COMPRESSION_TIMEOUTS.VERY_LARGE;
    } else if (sizeMB > COMPRESSION_THRESHOLDS.COMPRESS_WITH_TIMEOUT) {
      // Medium-large files (30-50MB): Longer timeout
      timeout = COMPRESSION_TIMEOUTS.LARGE;
    } else if (sizeMB > COMPRESSION_THRESHOLDS.ALWAYS_COMPRESS) {
      // Medium files (10-30MB): Medium timeout
      timeout = COMPRESSION_TIMEOUTS.MEDIUM;
    }
    // Small files (<10MB): Fast compression with short timeout

    // Multi-stage compression strategy
    const compressionPromise = (async () => {
      let bestSize = originalSize;
      let bestPath = inputPath;
      const tempPaths: string[] = [];

      try {
        // Stage 1: Optimize PDF structure (fast, safe)
        const stage1Path = outputPath + ".stage1";
        tempPaths.push(stage1Path);
        const stage1Size = await optimizePDFStructure(inputPath, stage1Path);
        if (stage1Size < bestSize) {
          bestSize = stage1Size;
          bestPath = stage1Path;
        }

        // Stage 2: Try Ghostscript if available (more aggressive, may affect quality slightly)
        const hasGhostscript = await isGhostscriptAvailable();
        if (hasGhostscript && sizeMB > 10) {
          // Only use Ghostscript for files >10MB (smaller files don't need it)
          try {
            const stage2Path = outputPath + ".stage2";
            tempPaths.push(stage2Path);
            
            // Use "ebook" quality for good balance (150 dpi)
            // For very large files, use "screen" quality (72 dpi) for maximum compression
            const quality = sizeMB > 50 ? "screen" : "ebook";
            const stage2Size = await compressWithGhostscript(bestPath, stage2Path, quality);
            
            if (stage2Size < bestSize) {
              // Clean up previous best
              if (bestPath !== inputPath && bestPath !== stage1Path) {
                try { await fs.unlink(bestPath); } catch {}
              }
              bestSize = stage2Size;
              bestPath = stage2Path;
            } else {
              // Ghostscript didn't help, remove it
              try { await fs.unlink(stage2Path); } catch {}
            }
          } catch (gsError) {
            console.log("Ghostscript compression failed, using structure optimization:", gsError);
            // Continue with stage 1 result
          }
        }

        // Copy best result to output
        if (bestPath !== outputPath) {
          await fs.copyFile(bestPath, outputPath);
        }

        // Clean up temp files
        for (const tempPath of tempPaths) {
          try {
            if (tempPath !== bestPath) {
              await fs.unlink(tempPath);
            }
          } catch {}
        }

        return bestSize;
      } catch (error) {
        // Clean up on error
        for (const tempPath of tempPaths) {
          try { await fs.unlink(tempPath); } catch {}
        }
        throw error;
      }
    })();

    // Race compression against timeout
    const timeoutPromise = new Promise<number>((_, reject) => {
      setTimeout(() => reject(new Error("Compression timeout")), timeout);
    });

    let compressedSize: number;
    try {
      compressedSize = await Promise.race([compressionPromise, timeoutPromise]);
    } catch (error) {
      // Timeout or error - use original
      console.log(`Compression ${error instanceof Error && error.message === "Compression timeout" ? "timed out" : "failed"}, using original file`);
      await fs.copyFile(inputPath, outputPath);
      return {
        originalSize,
        compressedSize: originalSize,
        reduction: 0,
        skipped: true,
        reason: error instanceof Error && error.message === "Compression timeout" 
          ? `Compression timed out after ${timeout/1000}s` 
          : "Compression failed",
      };
    }

    const reduction = ((originalSize - compressedSize) / originalSize) * 100;

    // If compression didn't help much, use original
    if (reduction < MIN_REDUCTION_PERCENT) {
      console.log(`Compression only saved ${reduction.toFixed(1)}% (<${MIN_REDUCTION_PERCENT}%), using original`);
      await fs.copyFile(inputPath, outputPath);
      return {
        originalSize,
        compressedSize: originalSize,
        reduction: 0,
        skipped: true,
        reason: `Compression saved only ${reduction.toFixed(1)}% - using original`,
      };
    }

    // Log compression success
    const hasGS = await isGhostscriptAvailable();
    const compressionMethod = hasGS && sizeMB > 10 
      ? "Ghostscript + Structure Optimization" 
      : "Structure Optimization";
    
    console.log(`Compression successful: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${reduction.toFixed(1)}% reduction) using ${compressionMethod}`);
    
    return { 
      originalSize, 
      compressedSize, 
      reduction,
      skipped: false,
    };
  } catch (error) {
    console.error("PDF compression error:", error);
    // If compression fails, copy original
    await fs.copyFile(inputPath, outputPath);
    const stats = await fs.stat(inputPath);
    return {
      originalSize: stats.size,
      compressedSize: stats.size,
      reduction: 0,
      skipped: true,
      reason: "Compression error occurred",
    };
  }
}

/**
 * Convert PDF pages to optimized images for faster web viewing
 * Returns array of image file paths
 */
export async function convertPDFToImages(
  pdfPath: string,
  outputDir: string
): Promise<string[]> {
  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // For now, we'll use a simpler approach
    // In production, you might want to use pdf-poppler or pdf2pic
    // This is a placeholder that indicates the structure
    
    // Note: Full PDF to image conversion requires additional setup
    // For now, we'll focus on compression and streaming
    
    return [];
  } catch (error) {
    console.error("PDF to image conversion failed:", error);
    return [];
  }
}

/**
 * Get PDF file size in MB
 */
export async function getPDFSize(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  return stats.size / (1024 * 1024); // Convert to MB
}
