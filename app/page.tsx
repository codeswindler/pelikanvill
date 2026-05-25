"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";

const dishes = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=80",
  "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=1920&q=80",
  "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=1920&q=80",
  "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=1920&q=80",
  "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=1920&q=80", // Cocktails
  "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=1920&q=80",
  "https://images.unsplash.com/photo-1544025162-d76694265947?w=1920&q=80",
  "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=1920&q=80", // Whiskey
  "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1920&q=80", // Bar drinks
];

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % dishes.length);
  }, []);

  useEffect(() => {
    const interval = setInterval(nextSlide, 6000);
    return () => clearInterval(interval);
  }, [nextSlide]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Background Carousel with Blur */}
      {dishes.map((url, index) => (
        <div
          key={index}
          className="absolute inset-0"
          style={{
            opacity: currentSlide === index ? 1 : 0,
            transition: "opacity 2s ease-in-out",
            zIndex: currentSlide === index ? 1 : 0,
          }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center scale-110"
            style={{
              backgroundImage: `url(${url})`,
              filter: "blur(14px)",
            }}
          />
        </div>
      ))}

      {/* Dark Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        style={{ zIndex: 2 }}
      />

      {/* Content */}
      <div
        className="relative min-h-screen flex flex-col items-center justify-center px-4"
        style={{ zIndex: 3 }}
      >
        <div
          className="text-center max-w-lg mx-auto transition-all duration-1000 opacity-100 translate-y-0"
        >
          {/* Logo */}
          <div className="mb-8 sm:mb-10">
            <div className="w-48 h-48 sm:w-72 sm:h-72 mx-auto mb-4 sm:mb-6 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl bg-black animate-logo-spin-zoom">
              <Image
                src="/pelikanvill.jpg"
                alt="Pelikan Village Logo"
                width={288}
                height={288}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <p className="text-white/80 text-base sm:text-lg drop-shadow-md px-4">
              Welcome! Explore our menu or share your experience.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:gap-4 w-full max-w-xs mx-auto px-4">
            <Link
              href="/menu"
              className="w-full py-3.5 sm:py-4 px-6 bg-amber-600 text-white font-semibold text-base sm:text-lg rounded-xl shadow-lg hover:bg-amber-700 transition-all duration-200 hover:shadow-xl hover:scale-[1.02] text-center backdrop-blur-sm"
            >
              📖 View Our Menu
            </Link>

            <Link
              href="/review"
              className="w-full py-3.5 sm:py-4 px-6 bg-white/15 backdrop-blur-sm text-white font-semibold text-base sm:text-lg rounded-xl shadow-lg border border-white/25 hover:bg-white/25 transition-all duration-200 hover:shadow-xl hover:scale-[1.02] text-center"
            >
              ⭐ Leave a Review
            </Link>

            <Link
              href="/feedback"
              className="w-full py-3.5 sm:py-4 px-6 bg-white/10 backdrop-blur-sm text-white/80 font-semibold text-base sm:text-lg rounded-xl shadow-lg border border-white/15 hover:bg-white/20 transition-all duration-200 hover:shadow-xl hover:scale-[1.02] text-center"
            >
              💬 Feedback to Management
            </Link>
          </div>

          {/* Footer */}
          <p className="mt-8 sm:mt-12 text-white/40 text-xs sm:text-sm">
            Thank you for dining with us
          </p>
        </div>
      </div>
    </main>
  );
}
