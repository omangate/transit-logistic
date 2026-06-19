import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'apps/api');

const prismaEnumToShared = {
  'PayoutRequestStatus.pending': 'PayoutRequestStatus.PENDING',
  'PayoutRequestStatus.approved': 'PayoutRequestStatus.APPROVED',
  'PayoutRequestStatus.rejected': 'PayoutRequestStatus.REJECTED',
  'PayoutRequestStatus.processed': 'PayoutRequestStatus.PROCESSED',
  'PaymentStatus.requires_payment_method': 'PaymentStatus.REQUIRES_PAYMENT_METHOD',
  'PaymentStatus.requires_confirmation': 'PaymentStatus.REQUIRES_CONFIRMATION',
  'PaymentStatus.processing': 'PaymentStatus.PROCESSING',
  'PaymentStatus.succeeded': 'PaymentStatus.SUCCEEDED',
  'PaymentStatus.failed': 'PaymentStatus.FAILED',
  'PaymentStatus.cancelled': 'PaymentStatus.CANCELLED',
  'PaymentStatus.refunded': 'PaymentStatus.REFUNDED',
  'NotificationChannel.in_app': 'NotificationChannel.IN_APP',
  'NotificationChannel.push': 'NotificationChannel.PUSH',
  'NotificationChannel.email': 'NotificationChannel.EMAIL',
  'ShipmentStatus.draft': 'ShipmentStatus.DRAFT',
  'ShipmentStatus.pending_assignment': 'ShipmentStatus.PENDING_ASSIGNMENT',
  'ShipmentStatus.assigned': 'ShipmentStatus.ASSIGNED',
  'ShipmentStatus.picked_up': 'ShipmentStatus.PICKED_UP',
  'ShipmentStatus.in_transit': 'ShipmentStatus.IN_TRANSIT',
  'ShipmentStatus.delivered': 'ShipmentStatus.DELIVERED',
  'ShipmentStatus.completed': 'ShipmentStatus.COMPLETED',
  'ShipmentStatus.cancelled': 'ShipmentStatus.CANCELLED',
  'UserRole.admin': 'UserRole.ADMIN',
  'UserRole.fleet_owner': 'UserRole.FLEET_OWNER',
  'UserRole.driver': 'UserRole.DRIVER',
  'UserRole.customer': 'UserRole.CUSTOMER',
};

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.ts')) files.push(full);
  }
  return files;
}

const files = walk(path.join(root, 'src')).concat(walk(path.join(root, 'prisma')));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  for (const [from, to] of Object.entries(prismaEnumToShared)) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }

  if (content.includes("import { Reflector } from '@nestjs/core';import type { User }")) {
    content = content.replace(
      "import { Reflector } from '@nestjs/core';import type { User } from '@/types/user';",
      "import { Reflector } from '@nestjs/core';\n\nimport type { User } from '@/types/user';",
    );
    changed = true;
  }

  if (changed) fs.writeFileSync(file, content);
}

console.log('Enum member replacements done');
