import { BadRequestException, Injectable } from '@nestjs/common';
import type { User } from '@/types/user';

import { PrismaService } from '../../database/prisma.service';

import { LogisticsAccessService } from './logistics-access.service';
import { LogisticsAuditService } from './logistics-audit.service';

type VehicleInput = {
  logisticsOrderId?: string;
  customsRequestId?: string;
  vin?: string;
  chassisNumber?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  weightKg?: number;
  origin?: string;
  destination?: string;
  containerNumber?: string;
  blNumber?: string;
  customsStatus?: string;
  notes?: string;
};

@Injectable()
export class LogisticsVehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LogisticsAccessService,
    private readonly audit: LogisticsAuditService,
  ) {}

  async list(user: User, input: { logisticsOrderId?: string; customsRequestId?: string }) {
    await this.assertContextAccess(user, input);
    return this.prisma.vehicleShipmentRecord.findMany({
      where: input,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(user: User, id: string) {
    const record = await this.prisma.vehicleShipmentRecord.findUniqueOrThrow({ where: { id } });
    await this.assertContextAccess(user, {
      logisticsOrderId: record.logisticsOrderId ?? undefined,
      customsRequestId: record.customsRequestId ?? undefined,
    });
    return record;
  }

  async create(user: User, input: VehicleInput) {
    await this.assertContextAccess(user, input);
    if (!input.logisticsOrderId && !input.customsRequestId) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message_en: 'Link vehicle to a logistics order or customs request.',
        message_ar: 'اربط المركبة بطلب لوجستي أو تخليص.',
      });
    }

    const record = await this.prisma.vehicleShipmentRecord.create({
      data: {
        logisticsOrderId: input.logisticsOrderId,
        customsRequestId: input.customsRequestId,
        vin: input.vin?.trim().toUpperCase(),
        chassisNumber: input.chassisNumber?.trim().toUpperCase(),
        make: input.make,
        model: input.model,
        year: input.year,
        color: input.color,
        weightKg: input.weightKg,
        origin: input.origin,
        destination: input.destination,
        containerNumber: input.containerNumber,
        blNumber: input.blNumber,
        customsStatus: input.customsStatus,
        notes: input.notes,
      },
    });

    await this.audit.auditLog({
      actorId: user.id,
      action: 'vehicle_shipment.created',
      entityType: 'vehicle_shipment_record',
      entityId: record.id,
      metadata: { vin: record.vin, chassisNumber: record.chassisNumber },
    });

    return record;
  }

  async update(user: User, id: string, input: VehicleInput) {
    await this.get(user, id);
    const record = await this.prisma.vehicleShipmentRecord.update({
      where: { id },
      data: {
        vin: input.vin?.trim().toUpperCase(),
        chassisNumber: input.chassisNumber?.trim().toUpperCase(),
        make: input.make,
        model: input.model,
        year: input.year,
        color: input.color,
        weightKg: input.weightKg,
        origin: input.origin,
        destination: input.destination,
        containerNumber: input.containerNumber,
        blNumber: input.blNumber,
        customsStatus: input.customsStatus,
        notes: input.notes,
      },
    });

    await this.audit.auditLog({
      actorId: user.id,
      action: 'vehicle_shipment.updated',
      entityType: 'vehicle_shipment_record',
      entityId: id,
    });

    return record;
  }

  async remove(user: User, id: string) {
    await this.get(user, id);
    await this.prisma.vehicleShipmentRecord.delete({ where: { id } });
    await this.audit.auditLog({
      actorId: user.id,
      action: 'vehicle_shipment.deleted',
      entityType: 'vehicle_shipment_record',
      entityId: id,
    });
    return { ok: true };
  }

  async previewImport(user: User, logisticsOrderId: string, rows: Array<Record<string, string>>) {
    await this.access.assertOrderAccess(user, logisticsOrderId);
    const existing = await this.prisma.vehicleShipmentRecord.findMany({
      where: { logisticsOrderId },
      select: { vin: true, chassisNumber: true },
    });
    const existingKeys = new Set(
      existing.flatMap((r) => [r.vin?.toUpperCase(), r.chassisNumber?.toUpperCase()].filter(Boolean) as string[]),
    );

    return rows.map((row, index) => {
      const vin = (row.vin ?? row.VIN ?? '').trim().toUpperCase();
      const chassis = (row.chassisNumber ?? row.chassis ?? row['Chassis Number'] ?? '').trim().toUpperCase();
      const errors: string[] = [];
      if (!vin && !chassis) errors.push('VIN or chassis number required');
      if (vin && existingKeys.has(vin)) errors.push('Duplicate VIN in order');
      if (chassis && existingKeys.has(chassis)) errors.push('Duplicate chassis in order');
      return { row: index + 1, data: row, errors, valid: errors.length === 0 };
    });
  }

  async commitImport(
    user: User,
    logisticsOrderId: string,
    rows: VehicleInput[],
    options: { skipInvalid?: boolean } = {},
  ) {
    await this.access.assertOrderAccess(user, logisticsOrderId);
    const preview = await this.previewImport(
      user,
      logisticsOrderId,
      rows.map((r) => ({
        vin: r.vin ?? '',
        chassisNumber: r.chassisNumber ?? '',
        make: r.make ?? '',
        model: r.model ?? '',
      })),
    );

    const created = [];
    const failed = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const check = preview[i];
      if (!check?.valid) {
        failed.push({ row: i + 1, errors: check?.errors ?? ['Invalid row'] });
        if (!options.skipInvalid) continue;
        continue;
      }
      try {
        created.push(await this.create(user, { ...row, logisticsOrderId }));
      } catch (err) {
        failed.push({ row: i + 1, errors: [err instanceof Error ? err.message : 'Failed'] });
      }
    }

    return { createdCount: created.length, failed, created };
  }

  private async assertContextAccess(user: User, input: { logisticsOrderId?: string; customsRequestId?: string }) {
    if (input.customsRequestId) await this.access.assertCustomsAccess(user, input.customsRequestId);
    if (input.logisticsOrderId) await this.access.assertOrderAccess(user, input.logisticsOrderId);
    if (!input.customsRequestId && !input.logisticsOrderId) {
      this.access.assertAdmin(user);
    }
  }
}
