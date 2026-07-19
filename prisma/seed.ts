import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // ============================================
  // 1. CURRENCIES
  // ============================================
  const currencies = [
    { code: 'USD', name: 'US Dollar', label: 'US Dollar', symbol: '$', exchangeRate: 1, deliveryFee: 5.99 },
    { code: 'EUR', name: 'Euro', label: 'Euro', symbol: '€', exchangeRate: 0.92, deliveryFee: 4.99 },
    { code: 'GBP', name: 'British Pound', label: 'British Pound', symbol: '£', exchangeRate: 0.79, deliveryFee: 3.99 },
    { code: 'MAD', name: 'Moroccan Dirham', label: 'Moroccan Dirham', symbol: 'DH', exchangeRate: 10.0, deliveryFee: 30 },
    { code: 'AED', name: 'UAE Dirham', label: 'UAE Dirham', symbol: 'AED', exchangeRate: 3.67, deliveryFee: 15 },
  ];
  for (const c of currencies) {
    await prisma.currency.upsert({ where: { code: c.code }, update: c, create: c });
  }
  console.log(`Seeded ${currencies.length} currencies`);

  // ============================================
  // 2. COUNTRIES
  // ============================================
  const countries = [
    { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1', pattern: '^[2-9]\\d{9}$', currency: 'USD', language: 'en' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44', pattern: '^7\\d{9}$', currency: 'GBP', language: 'en' },
    { code: 'FR', name: 'France', flag: '🇫🇷', dialCode: '+33', pattern: '^[67]\\d{8}$', currency: 'EUR', language: 'fr' },
    { code: 'MA', name: 'Morocco', flag: '🇲🇦', dialCode: '+212', pattern: '^[6-7]\\d{8}$', currency: 'MAD', language: 'ar' },
    { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', dialCode: '+971', pattern: '^5\\d{8}$', currency: 'AED', language: 'ar' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪', dialCode: '+49', pattern: '^1[5-9]\\d{8}$', currency: 'EUR', language: 'en' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸', dialCode: '+34', pattern: '^[6-9]\\d{8}$', currency: 'EUR', language: 'en' },
    { code: 'IT', name: 'Italy', flag: '🇮🇹', dialCode: '+39', pattern: '^3\\d{8,9}$', currency: 'EUR', language: 'en' },
  ];
  for (const c of countries) {
    await prisma.country.upsert({ where: { code: c.code }, update: c, create: c });
  }
  console.log(`Seeded ${countries.length} countries`);

  // ============================================
  // 3. CATEGORIES
  // ============================================
  const categoryData = [
    { name: 'Electronics', slug: 'electronics', icon: 'devices' },
    { name: 'Clothing', slug: 'clothing', icon: 'shirt' },
    { name: 'Automobile', slug: 'automobile', icon: 'car' },
    { name: 'Home & Garden', slug: 'home-garden', icon: 'home' },
    { name: 'Beauty', slug: 'beauty', icon: 'sparkles' },
    { name: 'Sports', slug: 'sports', icon: 'fitness' },
    { name: 'Toys', slug: 'toys', icon: 'toy' },
    { name: 'Food & Beverage', slug: 'food-beverage', icon: 'restaurant' },
  ];
  for (const c of categoryData) {
    const existing = await prisma.category.findUnique({ where: { slug: c.slug } });
    if (!existing) await prisma.category.create({ data: c });
  }
  console.log(`Seeded ${categoryData.length} categories`);

  // ============================================
  // 4. ADMIN USER (only account seeded)
  // ============================================
  const adminPass = await argon2.hash('mooz55678252');
  const adminEmail = 'admin@oxtore.com';

  let admin = await prisma.profile.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.profile.create({
      data: {
        id: crypto.randomUUID(),
        fullName: 'System Admin',
        email: adminEmail,
        phone: '+212600000001',
        role: 'ADMIN',
        isVerified: true,
        metadata: { hashedPassword: adminPass } as any,
      },
    });
  }
  console.log(`Seeded admin user: ${admin.email}`);

  const existingSettings = await prisma.userSettings.findUnique({ where: { userId: admin.id } });
  if (!existingSettings) {
    await prisma.userSettings.create({
      data: {
        userId: admin.id,
        notifications: true,
        darkMode: false,
        language: 'en',
        currency: 'MAD',
      },
    });
  }

  const existingWallet = await prisma.wallet.findUnique({ where: { userId: admin.id } });
  if (!existingWallet) {
    await prisma.wallet.create({
      data: {
        userId: admin.id,
        balance: 0,
        total: 0,
        available: 0,
        margin: 0,
        blocked: 0,
        monthlyGain: 0,
        monthlyGainPercent: 0,
        currency: 'MAD',
      },
    });
  }
  console.log('Seeded admin user settings and wallet');

  console.log('\n========================================');
  console.log('Seed completed successfully!');
  console.log('========================================');
  console.log('\nAccounts:');
  console.log('  Admin: admin@oxtore.com / mooz55678252');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
