import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Create default admin user
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const existingAdmin = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  if (!existingAdmin) {
    const admin = await prisma.user.create({
      data: {
        username: adminUsername,
        passwordHash,
        phone: "",
        role: "admin",
        otpEnabled: false,
        notificationsEnabled: true,
        permissions: {
          createMany: {
            data: [
              { permission: "view_feedback" },
              { permission: "generate_qr" },
            ],
          },
        },
      },
    });
    console.log(`✅ Created admin user: ${admin.username} (id: ${admin.id})`);
  } else {
    console.log(`ℹ️  Admin user "${adminUsername}" already exists, skipping.`);
  }

  // 2. Migrate menus from JSON
  const menusJsonPath = path.join(
    process.cwd(),
    "uploads",
    "menus",
    "menus.json"
  );
  if (fs.existsSync(menusJsonPath)) {
    try {
      const menusData = JSON.parse(fs.readFileSync(menusJsonPath, "utf-8"));
      let migratedMenus = 0;
      for (const menu of menusData) {
        const exists = await prisma.menu.findFirst({
          where: { filename: menu.filename },
        });
        if (!exists) {
          await prisma.menu.create({
            data: {
              filename: menu.filename,
              originalName: menu.originalName,
              isActive: menu.isActive || false,
              uploadedAt: new Date(menu.uploadedAt),
            },
          });
          migratedMenus++;
        }
      }
      console.log(`✅ Migrated ${migratedMenus} menus from JSON.`);
    } catch (err) {
      console.log(`⚠️  Could not migrate menus: ${err}`);
    }
  } else {
    console.log("ℹ️  No menus.json found, skipping menu migration.");
  }

  // 3. Migrate feedback from JSON
  const feedbackJsonPath = path.join(process.cwd(), "uploads", "feedback.json");
  if (fs.existsSync(feedbackJsonPath)) {
    try {
      const feedbackData = JSON.parse(
        fs.readFileSync(feedbackJsonPath, "utf-8")
      );
      let migratedFeedback = 0;
      for (const fb of feedbackData) {
        const exists = await prisma.feedback.findFirst({
          where: {
            name: fb.name,
            createdAt: new Date(fb.createdAt),
          },
        });
        if (!exists) {
          await prisma.feedback.create({
            data: {
              name: fb.name,
              message: fb.message,
              rating: fb.rating,
              isRead: fb.read || false,
              createdAt: new Date(fb.createdAt),
            },
          });
          migratedFeedback++;
        }
      }
      console.log(`✅ Migrated ${migratedFeedback} feedback entries from JSON.`);
    } catch (err) {
      console.log(`⚠️  Could not migrate feedback: ${err}`);
    }
  } else {
    console.log("ℹ️  No feedback.json found, skipping feedback migration.");
  }

  console.log("🌱 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
