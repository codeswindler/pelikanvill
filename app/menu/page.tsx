import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function MenuPage() {
  redirect("/api/menus/active");
}
