/**
 * SMS integration with sms.wicaalinvestments.com
 * API Docs: https://wicaalinvestments.com/tech/communication-services/view-docs
 */

const SMS_API_URL =
  process.env.SMS_API_URL || "https://sms.wicaalinvestments.com";
const SMS_PARTNER_ID = process.env.SMS_PARTNER_ID || "8174";
const SMS_API_KEY =
  process.env.SMS_API_KEY || "831a84c5f19df85cc3796eebdea6bf5e";
const SMS_SHORTCODE = process.env.SMS_SHORTCODE || "PELIKANVILL";

interface SmsResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Send an SMS message via the Wicaali API
 */
export async function sendSms(
  phone: string,
  message: string
): Promise<SmsResponse> {
  try {
    const response = await fetch(`${SMS_API_URL}/api/v3/sms/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        partnerId: SMS_PARTNER_ID,
        apikey: SMS_API_KEY,
        shortcode: SMS_SHORTCODE,
        mobile: phone,
        message,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, message: data.message || "SMS sent" };
    } else {
      console.error("SMS API error:", data);
      return {
        success: false,
        error: data.message || "Failed to send SMS",
      };
    }
  } catch (error) {
    console.error("SMS send error:", error);
    return { success: false, error: "Network error sending SMS" };
  }
}

/**
 * Send OTP code via SMS
 */
export async function sendOtp(phone: string, code: string): Promise<SmsResponse> {
  const message = `Your Pelikan Village verification code is: ${code}. Valid for 5 minutes. Do not share this code.`;
  return sendSms(phone, message);
}

/**
 * Send feedback alert via SMS
 */
export async function sendFeedbackAlert(
  phone: string,
  customerName: string,
  rating: number
): Promise<SmsResponse> {
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const message = `Pelikan Village: New feedback from ${customerName} (${stars}). Check your dashboard for details.`;
  return sendSms(phone, message);
}
