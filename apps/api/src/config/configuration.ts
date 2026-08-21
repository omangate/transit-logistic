function readPort(): number {
  for (const key of ['PORT', 'API_PORT'] as const) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const port = Number.parseInt(raw, 10);
    if (!Number.isNaN(port) && port > 0) return port;
  }
  return 3001;
}

export const configuration = () => ({
  app: {
    port: readPort(),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    corsOrigin:
      process.env.CORS_ORIGIN ??
      'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3003,http://localhost:3005,http://127.0.0.1:3005',
    webUrl: process.env.WEB_APP_URL ?? 'http://127.0.0.1:3000',
    uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER ?? 'local',
    s3: {
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION ?? 'auto',
      endpoint: process.env.S3_ENDPOINT,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    },
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? 'redis_secret',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  tracking: {
    geofenceRadiusMeters: parseInt(process.env.TRACKING_GEOFENCE_RADIUS_M ?? '500', 10),
    liveCacheTtlSeconds: parseInt(process.env.TRACKING_LIVE_CACHE_TTL_S ?? '86400', 10),
    deviationThresholdM: parseInt(process.env.TRACKING_DEVIATION_THRESHOLD_M ?? '3000', 10),
  },
  email: {
    provider: process.env.EMAIL_PROVIDER ?? 'resend',
    resendApiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM ?? 'Transit Logistic <noreply@transit-logistic.dev>',
    replyTo: process.env.EMAIL_REPLY_TO,
    resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET,
    adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL?.trim().toLowerCase() || undefined,
  },
  ai: {
    provider: process.env.AI_PROVIDER ?? 'mock',
    openaiApiKey: process.env.OPENAI_API_KEY,
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
  },
  payment: {
    provider: process.env.PAYMENT_PROVIDER ?? 'thawani',
    thawani: {
      secretKey: process.env.THAWANI_SECRET_KEY,
      publishableKey: process.env.THAWANI_PUBLISHABLE_KEY,
      webhookSecret: process.env.THAWANI_WEBHOOK_SECRET,
      baseUrl: process.env.THAWANI_BASE_URL ?? 'https://uatcheckout.thawani.om/api/v1',
    },
    myfatoorah: {
      apiKey: process.env.MYFATOORAH_API_KEY,
      baseUrl: process.env.MYFATOORAH_BASE_URL ?? 'https://apitest.myfatoorah.com',
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
  },
  oceanCarriers: {
    defaultCarrier: process.env.OCEAN_DEFAULT_CARRIER ?? 'maersk',
  },
});
