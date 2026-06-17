import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test } from '@nestjs/testing';
import { ShipmentStatus } from '@prisma/client';
import { io, type Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';

import { configuration } from '../src/config/configuration';
import { PrismaService } from '../src/database/prisma.service';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/roles.guard';
import { NotificationDeliveryService } from '../src/modules/notifications/notification-delivery.service';
import { ShipmentAccessService } from '../src/modules/shipments/shipment-access.service';
import { DriverTrackingController } from '../src/modules/tracking/driver-tracking.controller';
import { TrackingAuthService } from '../src/modules/tracking/tracking-auth.service';
import { TrackingCacheService } from '../src/modules/tracking/tracking-cache.service';
import { TrackingController } from '../src/modules/tracking/tracking.controller';
import { TrackingGateway } from '../src/modules/tracking/tracking.gateway';
import { TrackingService } from '../src/modules/tracking/tracking.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';

const decimal = (value: number) => ({
  toString: () => value.toFixed(7),
});

describe('Tracking E2E', () => {
  jest.setTimeout(30_000);

  const shipmentId = '11111111-1111-1111-1111-111111111111';
  const driver = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'driver@example.com',
    phone: null,
    passwordHash: 'hash',
    role: 'driver',
    locale: 'en',
    isActive: true,
    isVerified: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const customer = {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'customer@example.com',
    phone: null,
    passwordHash: 'hash',
    role: 'customer',
    locale: 'en',
    isActive: true,
    isVerified: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let app: INestApplication;
  let accessToken: string;
  let redisStore = new Map<string, string>();
  let socketClient: ClientSocket;

  const tx = {
    trackingPoint: {
      create: jest.fn(),
    },
    shipmentStop: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    geofenceEvent: {
      create: jest.fn(),
    },
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    trackingPoint: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    geofenceEvent: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const access = {
    assertCanView: jest.fn(),
    isAdmin: jest.fn().mockReturnValue(false),
  };

  const notificationDelivery = {
    safeNotifyTrackingAlert: jest.fn(),
  };

  const redis = {
    set: jest.fn(async (key: string, value: string) => {
      redisStore.set(key, value);
      return 'OK';
    }),
    get: jest.fn(async (key: string) => redisStore.get(key) ?? null),
    del: jest.fn(async (key: string) => {
      redisStore.delete(key);
      return 1;
    }),
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '15m' },
        }),
      ],
      controllers: [TrackingController, DriverTrackingController],
      providers: [
        TrackingService,
        TrackingCacheService,
        TrackingGateway,
        TrackingAuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: ShipmentAccessService, useValue: access },
        { provide: NotificationDeliveryService, useValue: notificationDelivery },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
          const request = context.switchToHttp().getRequest();
          request.user = driver;
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    await app.listen(0);

    const signer = moduleRef.get(JwtService);
    accessToken = signer.sign({ sub: driver.id, email: driver.email, role: driver.role });

    prisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === driver.id) {
        return driver;
      }
      if (where.id === customer.id) {
        return customer;
      }
      return null;
    });

    access.assertCanView.mockResolvedValue({
      id: shipmentId,
      customerId: customer.id,
      driverId: driver.id,
      status: ShipmentStatus.in_transit,
    });

    tx.trackingPoint.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: BigInt(42),
      shipmentId: data.shipmentId,
      latitude: decimal(Number(data.latitude)),
      longitude: decimal(Number(data.longitude)),
      speed: data.speed ? decimal(Number(data.speed)) : null,
      heading: data.heading ? decimal(Number(data.heading)) : null,
      recordedAt: data.recordedAt ?? new Date(),
      createdAt: new Date(),
    }));

    tx.shipmentStop.findMany.mockResolvedValue([
      {
        id: '44444444-4444-4444-4444-444444444444',
        shipmentId,
        sequence: 1,
        address: 'Pickup',
        city: 'Riyadh',
        latitude: '24.7136000',
        longitude: '46.6753000',
        stopType: 'pickup',
        arrivedAt: null,
        createdAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    if (socketClient?.connected) {
      socketClient.disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    redisStore = new Map();
    jest.clearAllMocks();
    access.assertCanView.mockResolvedValue({
      id: shipmentId,
      customerId: customer.id,
      driverId: driver.id,
      status: ShipmentStatus.in_transit,
    });
  });

  it('records a tracking point and serves the cached live position over HTTP', async () => {
    const server = app.getHttpServer();

    const recordResponse = await request(server)
      .post(`/api/v1/driver/shipments/${shipmentId}/tracking`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        latitude: 24.7136,
        longitude: 46.6753,
        speed: 35,
      })
      .expect(201);

    expect(recordResponse.body.shipmentId).toBe(shipmentId);
    expect(tx.shipmentStop.update).toHaveBeenCalled();

    const liveResponse = await request(server)
      .get(`/api/v1/shipments/${shipmentId}/tracking/live`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(liveResponse.body.latitude).toBe('24.7136000');
    expect(liveResponse.body.longitude).toBe('46.6753000');
    expect(redis.get).toHaveBeenCalledWith(`tracking:live:${shipmentId}`);
  });

  it('streams live positions over WebSocket after subscription', async () => {
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const authenticated = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Socket authentication timeout')), 10_000);

      socketClient = io(`http://127.0.0.1:${port}/tracking`, {
        auth: { token: accessToken },
        transports: ['polling', 'websocket'],
        forceNew: true,
        reconnection: false,
      });

      socketClient.once('authenticated', () => {
        clearTimeout(timeout);
        resolve();
      });

      socketClient.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      socketClient.once('error', () => {
        clearTimeout(timeout);
        reject(new Error('Socket authentication failed'));
      });
    });

    await authenticated;

    const positionReceived = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Position event timeout')), 10_000);
      socketClient.once('position', (payload) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });

    socketClient.emit('subscribe', { shipmentId });
    await new Promise((resolve) => setTimeout(resolve, 300));

    await request(app.getHttpServer())
      .post(`/api/v1/driver/shipments/${shipmentId}/tracking`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        latitude: 24.714,
        longitude: 46.676,
        speed: 42,
      })
      .expect(201);

    const payload = await positionReceived;

    expect(payload.shipmentId).toBe(shipmentId);
    expect(payload.latitude).toBe('24.7140000');
  });
});
