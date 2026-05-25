import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || "default-secret-change-me-in-production"
);

const SESSION_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export interface SessionPayload {
  userId: number;
  username: string;
  role: string;
  permissions: string[];
  otpVerified: boolean;
}

// Authenticate credentials against the DB
export async function authenticate(
  username: string,
  password: string
): Promise<{
  success: boolean;
  user?: { id: number; username: string; role: string; otpEnabled: boolean; phone: string };
  permissions?: string[];
}> {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { permissions: true },
  });

  if (!user) return { success: false };

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) return { success: false };

  const permissions = user.permissions.map((p) => p.permission);

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      otpEnabled: user.otpEnabled,
      phone: user.phone,
    },
    permissions,
  };
}

// Create a JWT session token and store in DB
export async function createSession(
  payload: SessionPayload
): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const token = await new SignJWT({
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
    permissions: payload.permissions,
    otpVerified: payload.otpVerified,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresAt)
    .setIssuedAt()
    .sign(SECRET_KEY);

  // Store session in DB
  await prisma.session.create({
    data: {
      userId: payload.userId,
      token,
      expiresAt,
    },
  });

  return token;
}

// Verify token and return payload. Also extends session (sliding window).
export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);

    // Check session exists in DB and not expired
    const dbSession = await prisma.session.findUnique({
      where: { token },
    });

    if (!dbSession || dbSession.expiresAt < new Date()) {
      // Clean up expired session
      if (dbSession) {
        await prisma.session.delete({ where: { id: dbSession.id } }).catch(() => {});
      }
      return null;
    }

    // Sliding window: extend session expiry on each valid request
    const newExpiry = new Date(Date.now() + SESSION_DURATION_MS);
    await prisma.session.update({
      where: { id: dbSession.id },
      data: { expiresAt: newExpiry },
    });

    return {
      userId: payload.userId as number,
      username: payload.username as string,
      role: payload.role as string,
      permissions: payload.permissions as string[],
      otpVerified: payload.otpVerified as boolean,
    };
  } catch {
    return null;
  }
}

// Verify password for a given user (used for QR password confirmation)
export async function verifyPassword(
  userId: number,
  password: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  return bcrypt.compare(password, user.passwordHash);
}

// Destroy a session
export async function destroySession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

// Destroy all sessions for a user
export async function destroyAllUserSessions(userId: number): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

// Clean up expired sessions (call periodically)
export async function cleanupExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

// Generate OTP and store in DB
export async function generateOtp(userId: number): Promise<string> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Invalidate previous unused OTPs for this user
  await prisma.otpCode.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });

  await prisma.otpCode.create({
    data: {
      userId,
      code,
      expiresAt,
      used: false,
    },
  });

  return code;
}

// Verify OTP
export async function verifyOtp(
  userId: number,
  code: string
): Promise<boolean> {
  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      userId,
      code,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) return false;

  // Mark as used
  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { used: true },
  });

  return true;
}
