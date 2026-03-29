import { registerAs } from '@nestjs/config';

export const adminConfig = registerAs('admin', () => ({
  apiKey: process.env.ADMIN_API_KEY ?? '',
}));

export type AdminConfig = ReturnType<typeof adminConfig>;
