export const permanentQrBaseUrl = "https://pelikan.theleasemaster.com";

// Physical QR codes are printed from these URLs. Changing them requires reprints.
export const qrUrls = {
  menu: `${permanentQrBaseUrl}/menu`,
  review: `${permanentQrBaseUrl}/review`,
} as const;

export type QrType = keyof typeof qrUrls;
