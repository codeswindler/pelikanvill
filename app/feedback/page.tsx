"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const restaurantName =
  process.env.NEXT_PUBLIC_RESTAURANT_NAME || "Pelikan Village";

export default function FeedbackPage() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message, rating }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to submit feedback");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen flex flex-col bg-gray-950">
        <header className="bg-gray-900 shadow-lg border-b border-gray-800">
          <div className="max-w-4xl mx-auto px-3 py-2.5 sm:py-3 flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm sm:text-base"
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
              Back
            </button>
            <h1 className="text-base sm:text-xl font-bold text-white">
              {restaurantName}
            </h1>
            <div className="w-12" />
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-600/20 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Thank You!
            </h2>
            <p className="text-gray-400 mb-8">
              Your feedback has been submitted to our management team. We
              appreciate you taking the time to share your experience.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => router.back()}
                className="py-3 px-6 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors"
              >
                Go Back
              </button>
              <Link
                href="/review"
                className="py-3 px-6 bg-gray-800 text-white font-semibold rounded-xl border border-gray-700 hover:bg-gray-700 transition-colors"
              >
                ⭐ Leave a Google Review
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 shadow-lg border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-3 py-2.5 sm:py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm sm:text-base"
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
            Back
          </button>
          <h1 className="text-base sm:text-xl font-bold text-white">
            {restaurantName}
          </h1>
          <div className="w-12" />
        </div>
      </header>

      {/* Form */}
      <div className="flex-1 flex items-start justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
              💬 Leave Feedback
            </h2>
            <p className="text-gray-500 text-sm">
              Share your experience with our management team
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-gray-900 rounded-2xl shadow-lg border border-gray-800 p-5 sm:p-6 space-y-5"
          >
            {error && (
              <div className="bg-red-900/30 text-red-400 text-sm px-4 py-3 rounded-xl border border-red-800/50">
                {error}
              </div>
            )}

            {/* Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                How was your experience?
              </label>
              <div className="flex gap-1 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <svg
                      className={`w-9 h-9 sm:w-10 sm:h-10 transition-colors ${
                        star <= (hoveredRating || rating)
                          ? "text-amber-400"
                          : "text-gray-700"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-gray-600 mt-1">
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very Good"}
                {rating === 5 && "Excellent"}
              </p>
            </div>

            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
                Your Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                className="w-full px-4 py-3 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-colors bg-gray-800 text-white placeholder-gray-500"
                placeholder="Enter your name"
              />
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
                Your Feedback
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                maxLength={2000}
                rows={4}
                className="w-full px-4 py-3 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-colors bg-gray-800 text-white placeholder-gray-500 resize-none"
                placeholder="Tell us about your experience..."
              />
              <p className="text-xs text-gray-600 mt-1 text-right">
                {message.length}/2000
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              {loading ? "Submitting..." : "Submit Feedback"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
