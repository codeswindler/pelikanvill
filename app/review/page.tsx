import { redirect } from "next/navigation";
import { siteConfig } from "@/lib/config";

export const metadata = {
  title: `Leave a Review – ${siteConfig.restaurantName}`,
};

export default function ReviewPage() {
  redirect(siteConfig.googleReviewUrl);
}
