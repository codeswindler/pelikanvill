"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

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

export default function AdminLoginPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <AdminLoginPage />
    </Suspense>
  );
}

function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"login" | "otp">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [otpCountdown, setOtpCountdown] = useState(300); // 5 min in seconds
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % dishes.length);
  }, []);

  useEffect(() => {
    const interval = setInterval(nextSlide, 6000);
    return () => clearInterval(interval);
  }, [nextSlide]);

  // Check if we were redirected for pending OTP
  useEffect(() => {
    if (searchParams.get("otp") === "pending") {
      setStep("otp");
    }
  }, [searchParams]);

  // OTP countdown timer
  useEffect(() => {
    if (step !== "otp") return;
    if (otpCountdown <= 0) return;

    const interval = setInterval(() => {
      setOtpCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [step, otpCountdown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.requiresOtp) {
          setStep("otp");
          setOtpCountdown(300);
        } else {
          router.push("/admin/dashboard");
        }
      } else {
        setError(data.error || "Invalid username or password");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpCode }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/admin/dashboard");
      } else {
        setError(data.error || "Invalid OTP code");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

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
      <div className="absolute inset-0 bg-black/50" style={{ zIndex: 2 }} />

      {/* Content */}
      <div
        className="relative min-h-screen flex items-center justify-center px-4"
        style={{ zIndex: 3 }}
      >
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-52 h-52 mx-auto mb-4 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl bg-black animate-logo-spin-zoom">
              <Image
                src="/pelikanvill.jpg"
                alt="Pelikan Village Logo"
                width={208}
                height={208}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">
              {step === "login" ? "Admin Login" : "Verify OTP"}
            </h1>
            <p className="text-white/70 mt-1 text-sm">
              {step === "login"
                ? "Sign in to access the admin dashboard"
                : "Enter the code sent to your phone"}
            </p>
          </div>

          {/* Login Form */}
          {step === "login" && (
            <form
              onSubmit={handleLogin}
              className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-6 space-y-5 border border-white/20"
            >
              {error && (
                <div className="bg-red-500/20 text-red-200 text-sm px-4 py-3 rounded-xl border border-red-400/30">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-white/80 mb-1.5"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/60 transition-colors bg-white/10 text-white placeholder-white/40"
                  placeholder="Enter username"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-white/80 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 pr-12 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/60 transition-colors bg-white/10 text-white placeholder-white/40"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          {/* OTP Form */}
          {step === "otp" && (
            <form
              onSubmit={handleOtpVerify}
              className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-6 space-y-5 border border-white/20"
            >
              {error && (
                <div className="bg-red-500/20 text-red-200 text-sm px-4 py-3 rounded-xl border border-red-400/30">
                  {error}
                </div>
              )}

              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-600/20 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-amber-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <p className="text-white/60 text-sm mb-1">
                  A 6-digit code has been sent to your phone
                </p>
                {otpCountdown > 0 ? (
                  <p className="text-amber-400 text-xs font-mono">
                    Expires in {formatTime(otpCountdown)}
                  </p>
                ) : (
                  <p className="text-red-400 text-xs">
                    OTP expired. Please login again.
                  </p>
                )}
              </div>

              <div>
                <input
                  id="otp"
                  type="text"
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                  maxLength={6}
                  className="w-full px-4 py-4 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/60 transition-colors bg-white/10 text-white placeholder-white/40 text-center text-2xl tracking-[0.5em] font-mono"
                  placeholder="000000"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6 || otpCountdown <= 0}
                className="w-full py-3 px-4 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("login");
                  setError("");
                  setOtpCode("");
                }}
                className="w-full py-2 text-white/50 hover:text-white/80 text-sm transition-colors"
              >
                ← Back to Login
              </button>
            </form>
          )}

          <div className="text-center mt-6">
            <Link
              href="/"
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
