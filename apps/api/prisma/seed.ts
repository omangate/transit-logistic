import { PrismaClient } from '@prisma/client';
import { UserRole } from '@transit-logistic/shared';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function upsertUser(input: {
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
}) {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  return prisma.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      passwordHash,
      role: input.role,
      phone: input.phone,
      isVerified: true,
      isActive: true,
    },
    update: {
      passwordHash,
      role: input.role,
      isVerified: true,
      isActive: true,
    },
  });
}

async function main() {
  const admin = await upsertUser({
    email: 'admin@transit.dev',
    password: 'Admin1234',
    role: UserRole.ADMIN,
  });

  const fleetUser = await upsertUser({
    email: 'fleet@transit.dev',
    password: 'Fleet1234',
    role: UserRole.FLEET_OWNER,
    phone: '+96890000001',
  });

  const fleetOwner = await prisma.fleetOwner.upsert({
    where: { userId: fleetUser.id },
    create: {
      userId: fleetUser.id,
      companyName: 'Gulf Transport LLC',
      taxId: 'OM-FLEET-001',
    },
    update: {
      companyName: 'Gulf Transport LLC',
    },
  });

  const driverUser = await upsertUser({
    email: 'driver@transit.dev',
    password: 'Driver1234',
    role: UserRole.DRIVER,
    phone: '+96890000002',
  });

  const driverProfile = await prisma.driverProfile.upsert({
    where: { userId: driverUser.id },
    create: {
      userId: driverUser.id,
      fleetOwnerId: fleetOwner.id,
      licenseNumber: 'OM-DRIVER-001',
      isAvailable: true,
    },
    update: {
      fleetOwnerId: fleetOwner.id,
      isAvailable: true,
    },
  });

  await prisma.vehicle.upsert({
    where: {
      fleetOwnerId_plateNumber: {
        fleetOwnerId: fleetOwner.id,
        plateNumber: 'OM-1234',
      },
    },
    create: {
      fleetOwnerId: fleetOwner.id,
      plateNumber: 'OM-1234',
      vehicleType: 'flatbed',
      capacityKg: 5000,
      isActive: true,
    },
    update: {
      isActive: true,
    },
  });

  const settings = [
    {
      key: 'company',
      value: {
        nameEn: 'Transit Logistic',
        nameAr: 'ترانزيت لوجستك',
        email: 'support@transit-logistic.dev',
        phone: '+968 9000 0000',
        address: 'Muscat, Oman',
      },
    },
    {
      key: 'branding',
      value: {
        primaryColor: '#1D4ED8',
        accentColor: '#FDE68A',
        logoUrl: '/logo.svg',
      },
    },
    {
      key: 'email',
      value: {
        provider: 'resend',
        fromAddress: 'Transit Logistic <noreply@transit-logistic.dev>',
        enabled: false,
      },
    },
    {
      key: 'payment',
      value: {
        provider: 'mock',
        currency: 'OMR',
      },
    },
    {
      key: 'notifications',
      value: {
        inApp: true,
        email: true,
        push: false,
      },
    },
  ];

  for (const setting of settings) {
    await prisma.platformSetting.upsert({
      where: { key: setting.key },
      create: setting,
      update: { value: setting.value },
    });
  }

  console.log('Seed complete:');
  console.log(`  Admin:  admin@transit.dev / Admin1234 (id: ${admin.id})`);
  console.log(`  Fleet:  fleet@transit.dev / Fleet1234 (fleetOwnerId: ${fleetOwner.id})`);
  console.log(`  Driver: driver@transit.dev / Driver1234 (driverProfileId: ${driverProfile.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
