export const siteConfig = {
  restaurantName: process.env.NEXT_PUBLIC_RESTAURANT_NAME || "Pelikan Village",
  googleReviewUrl:
    process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL ||
    "https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID",
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
};
