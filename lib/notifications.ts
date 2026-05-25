import { prisma } from "./db";
import { sendFeedbackAlert } from "./sms";

/**
 * Dispatch feedback notifications to all eligible users.
 * Creates in-app notifications and sends SMS to users with notifications enabled.
 */
export async function dispatchFeedbackAlert(
  customerName: string,
  rating: number,
  feedbackPreview: string
): Promise<void> {
  try {
    // Find all users who should receive feedback alerts:
    // - Must have notificationsEnabled = true
    // - Must have 'view_feedback' permission OR be admin
    const eligibleUsers = await prisma.user.findMany({
      where: {
        OR: [
          {
            role: "admin",
          },
          {
            permissions: {
              some: { permission: "view_feedback" },
            },
          },
        ],
      },
    });

    const preview =
      feedbackPreview.length > 80
        ? feedbackPreview.slice(0, 80) + "..."
        : feedbackPreview;

    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
    const notifMessage = `New feedback from ${customerName} (${stars}): "${preview}"`;

    // Create in-app notifications for ALL eligible users
    await prisma.notification.createMany({
      data: eligibleUsers.map((user) => ({
        userId: user.id,
        type: "feedback_alert",
        message: notifMessage,
        isRead: false,
      })),
    });

    // Send SMS only to users with notificationsEnabled AND a valid phone
    const smsUsers = eligibleUsers.filter(
      (u) => u.notificationsEnabled && u.phone && u.phone.length > 5
    );

    // Fire SMS in parallel (don't await - best effort)
    for (const user of smsUsers) {
      sendFeedbackAlert(user.phone, customerName, rating).catch((err) => {
        console.error(
          `Failed to send feedback SMS to ${user.username}:`,
          err
        );
      });
    }
  } catch (error) {
    console.error("Error dispatching feedback alert:", error);
  }
}
