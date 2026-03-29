import { registerAs } from '@nestjs/config';

const normalizePrivateKey = (
  privateKey: string | undefined,
): string | undefined => privateKey?.replace(/\\n/g, '\n');

export const firebaseConfig = registerAs('firebase', () => ({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
}));

export type FirebaseConfig = ReturnType<typeof firebaseConfig>;
