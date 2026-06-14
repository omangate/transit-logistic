export const configuration = () => ({
  app: {
    port: parseInt(process.env.API_PORT ?? '3001', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    corsOrigin:
      process.env.CORS_ORIGIN ??
      'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3003,http://localhost:3005,http://127.0.0.1:3005',
    webUrl: process.env.WEB_APP_URL ?? 'http://127.0.0.1:3000',
    uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
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
    resendApiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM ?? 'Transit Logistic <noreply@transit-logistic.dev>',
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
});
