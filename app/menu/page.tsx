"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const restaurantName =
  process.env.NEXT_PUBLIC_RESTAURANT_NAME || "Pelikan Village";

interface PdfViewport {
  width: number;
  height: number;
}

interface PdfRenderTask {
  promise: Promise<void>;
  cancel?: () => void;
}

interface PdfPageProxy {
  getViewport(options: { scale: number }): PdfViewport;
  render(options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }): PdfRenderTask;
}

interface PdfDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
  destroy(): Promise<void>;
}

function MenuCanvasPage({
  pdf,
  pageNumber,
}: {
  pdf: PdfDocumentProxy;
  pageNumber: number;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: PdfRenderTask | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    async function renderPage() {
      const frame = frameRef.current;
      const canvas = canvasRef.current;
      if (!frame || !canvas) return;

      setRendered(false);
      renderTask?.cancel?.();

      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(280, frame.clientWidth);
      const cssWidth = Math.min(availableWidth, baseViewport.width);
      const scale = cssWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, viewport.width, viewport.height);

      renderTask = page.render({
        canvasContext: context,
        viewport,
      });

      try {
        await renderTask.promise;
        if (!cancelled) setRendered(true);
      } catch {
        if (!cancelled) setRendered(true);
      }
    }

    renderPage();

    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderPage, 150);
    });

    if (frameRef.current) observer.observe(frameRef.current);

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
      observer.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [pageNumber, pdf]);

  return (
    <section
      ref={frameRef}
      className="w-full flex justify-center px-2 sm:px-4"
      aria-label={`Menu page ${pageNumber}`}
    >
      <div className="relative">
        {!rendered && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-cyan-300 text-xs">
            Loading page {pageNumber}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="block max-w-full bg-white shadow-2xl"
          onContextMenu={(event) => event.preventDefault()}
        />
      </div>
    </section>
  );
}

export default function MenuPage() {
  const router = useRouter();
  const [pdf, setPdf] = useState<PdfDocumentProxy | null>(null);
  const [pageNumbers, setPageNumbers] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let loadedPdf: PdfDocumentProxy | null = null;

    async function loadMenu() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const loadingTask = pdfjs.getDocument({
          url: "/api/menus/active",
          disableAutoFetch: false,
          disableStream: false,
        });
        const document = (await loadingTask.promise) as PdfDocumentProxy;
        loadedPdf = document;

        if (cancelled) {
          await document.destroy();
          return;
        }

        setPdf(document);
        setPageNumbers(
          Array.from({ length: document.numPages }, (_, index) => index + 1)
        );
        setError("");
      } catch {
        if (!cancelled) {
          setError("Our menu is being updated. Please check back shortly.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadMenu();

    return () => {
      cancelled = true;
      void loadedPdf?.destroy();
    };
  }, []);

  return (
    <main
      className="min-h-screen bg-gray-950 text-white select-none"
      onContextMenu={(event) => event.preventDefault()}
    >
      <header className="sticky top-0 z-40 bg-gray-900/95 border-b border-gray-800 shadow-lg backdrop-blur">
        <div className="max-w-6xl mx-auto px-2 sm:px-3 py-2 sm:py-2.5 flex items-center justify-between gap-2">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-xs sm:text-sm sm:gap-1.5 sm:text-base shrink-0"
            aria-label="Go back"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 justify-center">
            <div className="w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-white/30 bg-black animate-logo-spin-zoom shrink-0">
              <Image
                src="/pelikanvill.jpg"
                alt="Pelikan Village Logo"
                width={40}
                height={40}
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-sm sm:text-base md:text-xl font-bold truncate">
              {restaurantName}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Link
              href="/feedback"
              className="text-[10px] sm:text-xs md:text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              Feedback
            </Link>
            <Link
              href="/review"
              className="text-[10px] sm:text-xs md:text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Review
            </Link>
          </div>
        </div>
      </header>

      {isLoading && (
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-cyan-300 text-sm">Loading menu...</p>
          </div>
        </div>
      )}

      {!isLoading && error && (
        <div className="min-h-[70vh] flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-gray-900 border border-gray-800 p-8 text-center">
            <h2 className="text-lg sm:text-xl font-bold mb-2">
              Menu Coming Soon
            </h2>
            <p className="text-gray-400 text-sm sm:text-base">{error}</p>
          </div>
        </div>
      )}

      {!isLoading && pdf && (
        <div className="py-4 sm:py-6 space-y-4 sm:space-y-6">
          {pageNumbers.map((pageNumber) => (
            <MenuCanvasPage
              key={pageNumber}
              pdf={pdf}
              pageNumber={pageNumber}
            />
          ))}
        </div>
      )}
    </main>
  );
}
