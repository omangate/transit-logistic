/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { ForbiddenException, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import type { User } from '@prisma/client';
import type { Server, Socket } from 'socket.io';

import { ShipmentAccessService } from '../shipments/shipment-access.service';

import { TrackingAuthService } from './tracking-auth.service';
import type { LiveTrackingPosition } from './tracking-live.types';

interface TrackingSocketData {
  user: User;
}

@WebSocketGateway({
  namespace: '/tracking',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TrackingGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly trackingAuth: TrackingAuthService,
    private readonly access: ShipmentAccessService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const user = await this.trackingAuth.authenticateSocket(client);
      (client.data as TrackingSocketData).user = user;
      client.emit('authenticated', { userId: user.id });
    } catch {
      this.logger.warn(`Rejected tracking socket ${client.id}`);
      client.emit('error', {
        code: 'UNAUTHORIZED',
        message_en: 'Authentication failed.',
        message_ar: 'فشل المصادقة.',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Tracking socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { shipmentId?: string },
  ) {
    const user = this.getSocketUser(client);
    const shipmentId = payload?.shipmentId;

    if (!shipmentId) {
      return {
        event: 'error',
        data: {
          code: 'INVALID_SUBSCRIPTION',
          message_en: 'shipmentId is required.',
          message_ar: 'معرف الشحنة مطلوب.',
        },
      };
    }

    try {
      await this.access.assertCanView(user, shipmentId);
    } catch (error) {
      const response =
        error instanceof ForbiddenException
          ? {
              code: 'SHIPMENT_ACCESS_DENIED',
              message_en: 'You do not have access to this shipment.',
              message_ar: 'ليس لديك صلاحية للوصول إلى هذه الشحنة.',
            }
          : {
              code: 'SUBSCRIPTION_FAILED',
              message_en: 'Unable to subscribe to shipment tracking.',
              message_ar: 'تعذر الاشتراك في تتبع الشحنة.',
            };

      return { event: 'error', data: response };
    }

    await client.join(this.buildRoom(shipmentId));

    return {
      event: 'subscribed',
      data: { shipmentId },
    };
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { shipmentId?: string },
  ) {
    const shipmentId = payload?.shipmentId;

    if (!shipmentId) {
      return {
        event: 'error',
        data: {
          code: 'INVALID_SUBSCRIPTION',
          message_en: 'shipmentId is required.',
          message_ar: 'معرف الشحنة مطلوب.',
        },
      };
    }

    await client.leave(this.buildRoom(shipmentId));

    return {
      event: 'unsubscribed',
      data: { shipmentId },
    };
  }

  publishPosition(shipmentId: string, position: LiveTrackingPosition) {
    if (!this.server) {
      return;
    }

    this.server.to(this.buildRoom(shipmentId)).emit('position', position);
  }

  private getSocketUser(client: Socket): User {
    return (client.data as TrackingSocketData).user;
  }

  private buildRoom(shipmentId: string): string {
    return `shipment:${shipmentId}`;
  }
}
