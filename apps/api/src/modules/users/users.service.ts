/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

export interface UserMeResponse {
  id: string;
  email: string;
  phone: string | null;
  role: string;
  locale: string;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  profile: {
    type: 'customer' | 'fleet_owner' | 'driver';
    fullName?: string;
    company?: string | null;
    companyName?: string;
    taxId?: string | null;
    kycStatus?: string;
    licenseNumber?: string;
  } | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<UserMeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        customerProfile: true,
        fleetOwner: true,
        driverProfile: true,
      },
    });

    return this.toMeResponse(user);
  }

  private toMeResponse(
    user: User & {
      customerProfile: { fullName: string; company: string | null } | null;
      fleetOwner: { companyName: string; taxId: string | null; kycStatus: string } | null;
      driverProfile: { licenseNumber: string } | null;
    },
  ): UserMeResponse {
    let profile: UserMeResponse['profile'] = null;

    if (user.customerProfile) {
      profile = {
        type: 'customer',
        fullName: user.customerProfile.fullName,
        company: user.customerProfile.company,
      };
    } else if (user.fleetOwner) {
      profile = {
        type: 'fleet_owner',
        companyName: user.fleetOwner.companyName,
        taxId: user.fleetOwner.taxId,
        kycStatus: user.fleetOwner.kycStatus,
      };
    } else if (user.driverProfile) {
      profile = {
        type: 'driver',
        licenseNumber: user.driverProfile.licenseNumber,
      };
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      locale: user.locale,
      isActive: user.isActive,
      isVerified: user.isVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      profile,
    };
  }
}
