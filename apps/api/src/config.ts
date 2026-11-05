import { z } from 'zod';

export function configuration(env = process.env) {
  const config = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().startsWith('postgresql://'),
    APP_URL: z.string().url(),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    AUTH_ISSUER: z.string().url(), AUTH_DOMAIN: z.string().url(), AUTH_CLIENT_ID: z.string().min(1),
    AWS_REGION: z.string().default('af-south-1'), S3_BUCKET: z.string().default(''),
    CLAMAV_HOST: z.string().default('127.0.0.1'), CLAMAV_PORT: z.coerce.number().default(3310),
    AI_ENABLED: z.enum(['true', 'false']).default('false'),
    AI_PROVIDER: z.enum(['openai-compatible', 'anthropic']).default('openai-compatible'),
    AI_ENDPOINT: z.string().default(''), AI_MODEL: z.string().default(''), AI_API_KEY: z.string().default(''),
    AI_DAILY_LIMIT: z.coerce.number().int().min(1).max(100).default(10)
  }).parse(env);
  if (new URL(config.AUTH_DOMAIN).protocol !== 'https:' || new URL(config.AUTH_ISSUER).protocol !== 'https:') throw new Error('Identity endpoints must use HTTPS.');
  if (config.NODE_ENV === 'production' && new URL(config.APP_URL).protocol !== 'https:') throw new Error('Production requires HTTPS.');
  if (config.AI_ENABLED === 'true' && (!config.AI_API_KEY || !config.AI_MODEL || !config.AI_ENDPOINT.startsWith('https://'))) throw new Error('Enabled AI requires an HTTPS endpoint, key and model.');
  return config;
}
export type Config = ReturnType<typeof configuration>;
