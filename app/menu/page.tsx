"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const restaurantName =
  process.env.NEXT_PUBLIC_RESTAURANT_NAME || "Pelikan Village";

export default function MenuPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [hasMenu, setHasMenu] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pdfUrl = "/api/menus/active";

  useEffect(() => {
    // Detect mobile/touch devices
    const checkMobile = () => {
      const mobile =
        /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
          navigator.userAgent
        ) || window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    // Simple check if menu exists
    const checkMenu = async () => {
      try {
        const response = await fetch("/api/menus/active", { method: "HEAD" });
        if (!response.ok) {
          setHasMenu(false);
        }
        // Hide loading after a short delay - let browser handle PDF loading
        setTimeout(() => setIsLoading(false), 500);
      } catch (error) {
        console.error("Failed to check menu:", error);
        setHasMenu(false);
        setIsLoading(false);
      }
    };

    checkMenu();

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  return (
    <main className="min-h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 shadow-lg border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-2 sm:px-3 py-2 sm:py-2.5 flex items-center justify-between gap-2">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-xs sm:text-sm sm:gap-1.5 sm:text-base shrink-0"
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
            <h1 className="text-sm sm:text-base md:text-xl font-bold text-white truncate">
              {restaurantName}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Link
              href="/feedback"
              className="text-[10px] sm:text-xs md:text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              <span className="hidden sm:inline">💬 </span>Feedback
            </Link>
            <Link
              href="/review"
              className="text-[10px] sm:text-xs md:text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <span className="hidden sm:inline">⭐ </span>Review
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center relative">
        {/* Simple Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-950/95 backdrop-blur-sm">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-cyan-400 text-sm">Loading menu...</p>
            </div>
          </div>
        )}

        {/* PDF Content - Optimized for Smooth Scrolling */}
        {hasMenu && (
          <div 
            ref={containerRef}
            className={`w-full flex-1 ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          >
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH&zoom=page-width`}
              className="w-full flex-1 border-0"
              style={{ 
                height: isMobile ? "calc(100vh - 48px)" : "calc(100vh - 56px)",
                minHeight: "100%",
                display: "block"
              }}
              title="Restaurant Menu"
              allow="fullscreen"
              loading="lazy"
              onLoad={() => {
                setIsLoading(false);
                // Preload next section for smoother scrolling
                if (containerRef.current) {
                  containerRef.current.style.willChange = "scroll-position";
                }
              }}
            />
          </div>
        )}
        
        {/* No menu message */}
        {!hasMenu && !isLoading && (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-gray-900 rounded-2xl shadow-lg border border-gray-800 p-8 sm:p-12 text-center">
              <svg
                className="w-12 h-12 sm:w-16 sm:h-16 text-gray-700 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
                Menu Coming Soon
              </h2>
              <p className="text-gray-500 text-sm sm:text-base">
                Our menu is being updated. Please check back shortly!
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
