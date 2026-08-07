import { PrismaClient } from '@prisma/client';
import { UserRole } from '@transit-logistic/shared';
import * as bcrypt from 'bcrypt';

import { seedOmanGeography } from './seed-geography';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

type DemoRole = 'admin' | 'fleet' | 'driver' | 'customer';

const DEMO_ACCOUNTS: Record<
  DemoRole,
  { email: string; role: UserRole; phone?: string }
> = {
  admin: { email: 'admin@transit.dev', role: UserRole.ADMIN },
  fleet: { email: 'fleet@transit.dev', role: UserRole.FLEET_OWNER, phone: '+96890000001' },
  driver: { email: 'driver@transit.dev', role: UserRole.DRIVER, phone: '+96890000002' },
  customer: { email: 'customer@transit.dev', role: UserRole.CUSTOMER, phone: '+96890000003' },
};

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function isTruthy(value: string | undefined) {
  return value === '1' || value?.toLowerCase() === 'true';
}

function shouldSeedDemoAccounts() {
  if (!isProduction()) return true;
  return isTruthy(process.env.SEED_DEMO_ACCOUNTS);
}

function resolveDemoPassword(role: DemoRole): string | null {
  const fromEnv =
    process.env[`SEED_${role.toUpperCase()}_PASSWORD`] ?? process.env.SEED_DEMO_PASSWORD;
  if (fromEnv) return fromEnv;

  if (!isProduction()) {
    const devDefaults: Record<DemoRole, string> = {
      admin: 'Admin1234',
      fleet: 'Fleet1234',
      driver: 'Driver1234',
      customer: 'Customer1234',
    };
    return devDefaults[role];
  }

  return null;
}

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
  await seedOmanGeography(prisma);

  const seededAccounts: string[] = [];

  if (shouldSeedDemoAccounts()) {
    for (const [role, account] of Object.entries(DEMO_ACCOUNTS) as [DemoRole, (typeof DEMO_ACCOUNTS)[DemoRole]][]) {
      const password = resolveDemoPassword(role);
      if (!password) {
        console.warn(
          `Skipping demo account ${account.email}: set SEED_DEMO_ACCOUNTS=true and SEED_${role.toUpperCase()}_PASSWORD (or SEED_DEMO_PASSWORD) in production.`,
        );
        continue;
      }

      const user = await upsertUser({
        email: account.email,
        password,
        role: account.role,
        phone: account.phone,
      });

      if (role === 'customer') {
        await prisma.customerProfile.upsert({
          where: { userId: user.id },
          create: { userId: user.id, fullName: 'Demo Customer' },
          update: { fullName: 'Demo Customer' },
        });
      }

      seededAccounts.push(`${account.email} (${role})`);
    }
  } else {
    console.log('Demo accounts skipped (SEED_DEMO_ACCOUNTS not enabled in production).');
  }

  const fleetUser = await prisma.user.findUnique({ where: { email: DEMO_ACCOUNTS.fleet.email } });
  const fleetOwner = fleetUser
    ? await prisma.fleetOwner.upsert({
        where: { userId: fleetUser.id },
        create: {
          userId: fleetUser.id,
          companyName: 'Gulf Transport LLC',
          taxId: 'OM-FLEET-001',
        },
        update: {
          companyName: 'Gulf Transport LLC',
        },
      })
    : null;

  const driverUser = await prisma.user.findUnique({ where: { email: DEMO_ACCOUNTS.driver.email } });

  if (fleetOwner && driverUser) {
    await prisma.driverProfile.upsert({
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

    const vehicle = await prisma.vehicle.upsert({
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

    await prisma.truckListing.upsert({
      where: { slug: 'volvo-fh16-flatbed-demo' },
      create: {
        fleetOwnerId: fleetOwner.id,
        vehicleId: vehicle.id,
        slug: 'volvo-fh16-flatbed-demo',
        name: 'Volvo FH16 Flatbed',
        brand: 'Volvo',
        model: 'FH16',
        year: 2022,
        vehicleCategory: 'heavy_truck',
        vehicleType: 'flatbed',
        capacityKg: 25000,
        capacityCbm: 45,
        crossBorderSupport: true,
        refrigeratedSupport: false,
        insuranceCoverage: true,
        operatingCountries: ['OM', 'AE', 'SA'],
        description: 'Heavy-duty flatbed truck for cross-border freight across the GCC.',
        coverImageUrl: '/uploads/demo/truck-volvo.jpg',
        listingStatus: 'approved',
        isFeatured: true,
        isListingEnabled: true,
        pricePerKm: 2.5,
        dailyRentalPrice: 85,
        weeklyRentalPrice: 520,
        monthlyRentalPrice: 1800,
        withDriverAvailable: true,
        withoutDriverAvailable: true,
        minRentalDays: 1,
        approvedAt: new Date(),
        completedDeliveries: 128,
        avgRating: 4.7,
        reviewCount: 24,
      },
      update: {
        listingStatus: 'approved',
        isFeatured: true,
        isListingEnabled: true,
      },
    });
  }

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

  console.log('Seed complete.');
  if (seededAccounts.length > 0) {
    console.log('Demo accounts (passwords from SEED_* env — never logged):');
    for (const line of seededAccounts) {
      console.log(`  ${line}`);
    }
  }
  if (isProduction() && !shouldSeedDemoAccounts()) {
    console.log('Production: geography and platform settings seeded; demo users require SEED_DEMO_ACCOUNTS=true.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
