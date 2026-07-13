import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting comprehensive seed...');

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
  // 4. USERS
  // ============================================
  const adminPass = await argon2.hash('Admin123!@#');
  const managerPass = await argon2.hash('Manager123!@#');
  const sellerPass = await argon2.hash('Seller123!@#');
  const userPass = await argon2.hash('User123!@#');

  const adminId = crypto.randomUUID();
  const managerId = crypto.randomUUID();
  const supervisorId = crypto.randomUUID();
  const sellerId = crypto.randomUUID();
  const buyerId = crypto.randomUUID();

  const users = [
    { id: adminId, fullName: 'System Admin', email: 'admin@oxtore.com', phone: '+212600000001', role: 'ADMIN', isVerified: true, metadata: { hashedPassword: adminPass } },
    { id: managerId, fullName: 'Youssef Bennani', email: 'manager@oxtore.com', phone: '+212600000002', role: 'MANAGER', isVerified: true, metadata: { hashedPassword: managerPass } },
    { id: supervisorId, fullName: 'Fatima Zahra', email: 'supervisor@oxtore.com', phone: '+212600000003', role: 'SUPERVISOR', isVerified: true, metadata: { hashedPassword: sellerPass } },
    { id: sellerId, fullName: 'Omar El Idrissi', email: 'seller@oxtore.com', phone: '+212600000004', role: 'SELLER', isVerified: true, metadata: { hashedPassword: sellerPass } },
    { id: buyerId, fullName: 'Sara Moussaoui', email: 'buyer@oxtore.com', phone: '+212600000005', role: 'USER', isVerified: true, metadata: { hashedPassword: userPass } },
  ];

  for (const u of users) {
    const existing = await prisma.profile.findUnique({ where: { email: u.email } });
    if (!existing) await prisma.profile.create({ data: u as any });
  }
  console.log(`Seeded ${users.length} users`);

  // ============================================
  // 5. USER SETTINGS
  // ============================================
  for (const u of users) {
    const existing = await prisma.userSettings.findUnique({ where: { userId: u.id } });
    if (!existing) {
      await prisma.userSettings.create({
        data: {
          userId: u.id,
          notifications: true,
          darkMode: false,
          language: 'en',
          currency: 'MAD',
        },
      });
    }
  }
  console.log(`Seeded user settings`);

  // ============================================
  // 6. BOUTIQUES
  // ============================================
  const boutique1Id = crypto.randomUUID();
  const boutique2Id = crypto.randomUUID();
  const boutique3Id = crypto.randomUUID();

  const boutiques = [
    {
      id: boutique1Id,
      name: 'TechWorld Casablanca',
      logo: 'https://images.pexels.com/photos/3184298/pexels-photo-3184298.jpeg',
      address: '123 Boulevard Mohammed V, Casablanca',
      phone: '+212522000001',
      description: 'Premium electronics retailer in the heart of Casablanca',
      managerId,
      status: 'active',
      language: 'en',
      currency: 'MAD',
      categories: ['electronics', 'home-garden'],
    },
    {
      id: boutique2Id,
      name: 'Mode Maison Rabat',
      logo: 'https://images.pexels.com/photos/4498526/pexels-photo-4498526.jpeg',
      address: '456 Avenue Hassan II, Rabat',
      phone: '+212537000002',
      description: 'Fashion and home decor boutique',
      managerId: supervisorId,
      status: 'active',
      language: 'fr',
      currency: 'MAD',
      categories: ['clothing', 'home-garden', 'beauty'],
    },
    {
      id: boutique3Id,
      name: 'AutoParts Marrakech',
      logo: 'https://images.pexels.com/photos/3806288/pexels-photo-3806288.jpeg',
      address: '789 Rue de la Koutoubia, Marrakech',
      phone: '+212524000003',
      description: 'Automotive parts and accessories',
      managerId: sellerId,
      status: 'active',
      language: 'en',
      currency: 'MAD',
      categories: ['automobile'],
    },
  ];

  for (const b of boutiques) {
    const existing = await prisma.boutique.findUnique({ where: { id: b.id } });
    if (!existing) await prisma.boutique.create({ data: b as any });
  }

  // Boutique owners
  for (const bId of [boutique1Id, boutique2Id, boutique3Id]) {
    const ownerKey = `${bId}_${adminId}`;
    const existing = await prisma.boutiqueOwner.findUnique({ where: { boutiqueId_userId: { boutiqueId: bId, userId: adminId } } });
    if (!existing) await prisma.boutiqueOwner.create({ data: { boutiqueId: bId, userId: adminId } });
  }
  console.log(`Seeded ${boutiques.length} boutiques with owners`);

  // ============================================
  // 7. BOUTIQUE RELATIONS & REQUESTS
  // ============================================
  const existingRel = await prisma.boutiqueRelation.findFirst({ where: { requesterId: boutique1Id, receiverId: boutique2Id } });
  if (!existingRel) {
    await prisma.boutiqueRelation.create({
      data: {
        requesterId: boutique1Id,
        receiverId: boutique2Id,
        type: 'RESELLER',
        status: 'ACTIVE',
        approvedAt: new Date(),
        approvedBy: adminId,
      },
    });
  }

  const existingReq = await prisma.boutiqueRequest.findFirst({ where: { requesterId: boutique2Id, receiverId: boutique3Id } });
  if (!existingReq) {
    await prisma.boutiqueRequest.create({
      data: {
        requesterId: boutique2Id,
        receiverId: boutique3Id,
        type: 'RESELLER',
        status: 'pending',
        message: 'We would like to partner for auto accessories',
      },
    });
  }
  console.log(`Seeded boutique relations and requests`);

  // ============================================
  // 8. EMPLOYEES
  // ============================================
  const employees = [
    { fullName: 'Karim Tazi', email: 'karim@techworld.ma', phone: '+212661000001', role: 'SELLER', boutiqueId: boutique1Id, status: 'active' },
    { fullName: 'Nadia Berrada', email: 'nadia@techworld.ma', phone: '+212661000002', role: 'SUPERVISOR', boutiqueId: boutique1Id, status: 'active' },
    { fullName: 'Hicham Alaoui', email: 'hicham@modemaison.ma', phone: '+212661000003', role: 'SELLER', boutiqueId: boutique2Id, status: 'active' },
    { fullName: 'Leila Fassi', email: 'leila@autoparts.ma', phone: '+212661000004', role: 'SELLER', boutiqueId: boutique3Id, status: 'pending' },
  ];
  for (const e of employees) {
    const existing = await prisma.employee.findFirst({ where: { email: e.email, boutiqueId: e.boutiqueId } });
    if (!existing) await prisma.employee.create({ data: e as any });
  }
  console.log(`Seeded ${employees.length} employees`);

  // ============================================
  // 9. PRODUCTS
  // ============================================
  const product1Id = crypto.randomUUID();
  const product2Id = crypto.randomUUID();
  const product3Id = crypto.randomUUID();
  const product4Id = crypto.randomUUID();
  const product5Id = crypto.randomUUID();

  const products = [
    {
      id: product1Id, name: 'iPhone 15 Pro Max', sku: 'TW-IP15PM-001', barcode: '194253123456',
      category: 'electronics', brand: 'Apple', description: 'Latest iPhone with titanium body and A17 Pro chip',
      ownerBoutiqueId: boutique1Id, createdBy: managerId,
      isPublic: true, visibility: 'public', published: true, publishedAt: new Date(),
      saleTypes: ['retail', 'wholesale'], wholesaleEnabled: true, consignmentEnabled: false,
      saleType: 'both', transactionMode: 'direct', condition: 'new',
      approvalStatus: 'approved', status: 'published',
      cost: 900, price: 1299, wholesalePrice: 1100, minWholesaleQty: 5, commission: 5,
      isActive: true,
      inventory: { quantity: 50, available: 45, safetyStock: 10, reorderLevel: 15, status: 'in_stock' },
      pricing: { purchasePrice: 900, sellingPrice: 1299, wholesalePrice: 1100 },
      images: ['https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg'],
    },
    {
      id: product2Id, name: 'Samsung Galaxy S24 Ultra', sku: 'TW-SGS24U-002', barcode: '887276987654',
      category: 'electronics', brand: 'Samsung', description: 'Galaxy AI features with S Pen and 200MP camera',
      ownerBoutiqueId: boutique1Id, createdBy: managerId,
      isPublic: true, visibility: 'public', published: true, publishedAt: new Date(),
      saleTypes: ['retail'], wholesaleEnabled: false, consignmentEnabled: false,
      saleType: 'retail', transactionMode: 'direct', condition: 'new',
      approvalStatus: 'approved', status: 'published',
      cost: 700, price: 1099, wholesalePrice: 0, minWholesaleQty: 0, commission: 3,
      isActive: true,
      inventory: { quantity: 30, available: 28, safetyStock: 5, reorderLevel: 10, status: 'in_stock' },
      pricing: { purchasePrice: 700, sellingPrice: 1099, wholesalePrice: 0 },
      images: ['https://images.pexels.com/photos/1647946/pexels-photo-1647946.jpeg'],
    },
    {
      id: product3Id, name: 'Designer Leather Jacket', sku: 'MM-DLJ-003', barcode: '123456789012',
      category: 'clothing', brand: 'Mode Maison', description: 'Handcrafted leather jacket, premium quality',
      ownerBoutiqueId: boutique2Id, createdBy: supervisorId,
      isPublic: true, visibility: 'public', published: true, publishedAt: new Date(),
      saleTypes: ['retail'], wholesaleEnabled: false, consignmentEnabled: true,
      saleType: 'retail', transactionMode: 'consignment', condition: 'new',
      approvalStatus: 'approved', status: 'published',
      cost: 200, price: 599, wholesalePrice: 0, minWholesaleQty: 0, commission: 10,
      isActive: true,
      inventory: { quantity: 15, available: 12, safetyStock: 3, reorderLevel: 5, status: 'in_stock' },
      pricing: { purchasePrice: 200, sellingPrice: 599, wholesalePrice: 0 },
      images: ['https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg'],
    },
    {
      id: product4Id, name: 'Car Floor Mats Set', sku: 'AP-CFM-004', barcode: '987654321098',
      category: 'automobile', brand: 'AutoParts Pro', description: 'Universal fit rubber floor mats, set of 4',
      ownerBoutiqueId: boutique3Id, createdBy: sellerId,
      isPublic: true, visibility: 'public', published: true, publishedAt: new Date(),
      saleTypes: ['retail', 'wholesale'], wholesaleEnabled: true, consignmentEnabled: false,
      saleType: 'both', transactionMode: 'direct', condition: 'new',
      approvalStatus: 'approved', status: 'published',
      cost: 25, price: 79, wholesalePrice: 55, minWholesaleQty: 10, commission: 5,
      isActive: true,
      inventory: { quantity: 100, available: 95, safetyStock: 20, reorderLevel: 30, status: 'in_stock' },
      pricing: { purchasePrice: 25, sellingPrice: 79, wholesalePrice: 55 },
      images: ['https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg'],
    },
    {
      id: product5Id, name: 'Wireless Charging Pad', sku: 'TW-WCP-005', barcode: '555123456789',
      category: 'electronics', brand: 'Anker', description: '15W fast wireless charging pad with LED indicator',
      ownerBoutiqueId: boutique1Id, createdBy: managerId,
      isPublic: false, visibility: 'private', published: false,
      saleTypes: ['retail'], wholesaleEnabled: false, consignmentEnabled: false,
      saleType: 'retail', transactionMode: 'direct', condition: 'new',
      approvalStatus: 'draft', status: 'draft',
      cost: 15, price: 39, wholesalePrice: 0, minWholesaleQty: 0, commission: 2,
      isActive: true,
      inventory: { quantity: 0, available: 0, safetyStock: 5, reorderLevel: 10, status: 'out_of_stock' },
      pricing: { purchasePrice: 15, sellingPrice: 39, wholesalePrice: 0 },
      images: ['https://images.pexels.com/photos/4526473/pexels-photo-4526473.jpeg'],
    },
  ];

  for (const p of products) {
    const existing = await prisma.product.findUnique({ where: { id: p.id } });
    if (!existing) await prisma.product.create({ data: p as any });
  }
  console.log(`Seeded ${products.length} products`);

  // ============================================
  // 10. WHOLESALE TIERS
  // ============================================
  const tiers = [
    { productId: product1Id, minQty: 5, unitPrice: 1100 },
    { productId: product1Id, minQty: 20, unitPrice: 1050 },
    { productId: product4Id, minQty: 10, unitPrice: 55 },
    { productId: product4Id, minQty: 50, unitPrice: 45 },
  ];
  for (const t of tiers) {
    const existing = await prisma.wholesaleTier.findFirst({ where: { productId: t.productId, minQty: t.minQty } });
    if (!existing) await prisma.wholesaleTier.create({ data: t });
  }
  console.log(`Seeded ${tiers.length} wholesale tiers`);

  // ============================================
  // 11. PRODUCT COMMISSIONS
  // ============================================
  const commissions = [
    { productId: product1Id, actor: 'seller', type: 'percentage', value: 2 },
    { productId: product1Id, actor: 'manager', type: 'percentage', value: 3 },
    { productId: product3Id, actor: 'seller', type: 'percentage', value: 5 },
    { productId: product3Id, actor: 'supervisor', type: 'fixed', value: 20 },
    { productId: product4Id, actor: 'seller', type: 'percentage', value: 3 },
  ];
  for (const c of commissions) {
    const existing = await prisma.productCommission.findFirst({ where: { productId: c.productId, actor: c.actor as any } });
    if (!existing) await prisma.productCommission.create({ data: c as any });
  }
  console.log(`Seeded ${commissions.length} product commissions`);

  // ============================================
  // 12. STOCK ITEMS
  // ============================================
  const stockItems = [
    { productId: product1Id, boutiqueId: boutique1Id, quantity: 50, available: 45, reserved: 5, minQuantity: 10, safetyStock: 10, reorderLevel: 15, status: 'in_stock' },
    { productId: product2Id, boutiqueId: boutique1Id, quantity: 30, available: 28, reserved: 2, minQuantity: 5, safetyStock: 5, reorderLevel: 10, status: 'in_stock' },
    { productId: product3Id, boutiqueId: boutique2Id, quantity: 15, available: 12, reserved: 3, minQuantity: 3, safetyStock: 3, reorderLevel: 5, status: 'in_stock' },
    { productId: product4Id, boutiqueId: boutique3Id, quantity: 100, available: 95, reserved: 5, minQuantity: 20, safetyStock: 20, reorderLevel: 30, status: 'in_stock' },
    { productId: product5Id, boutiqueId: boutique1Id, quantity: 0, available: 0, reserved: 0, minQuantity: 5, safetyStock: 5, reorderLevel: 10, status: 'out_of_stock' },
  ];
  for (const s of stockItems) {
    const existing = await prisma.stockItem.findFirst({ where: { productId: s.productId, boutiqueId: s.boutiqueId } });
    if (!existing) await prisma.stockItem.create({ data: s as any });
  }
  console.log(`Seeded ${stockItems.length} stock items`);

  // ============================================
  // 13. INVENTORY MOVEMENTS
  // ============================================
  const movements = [
    { productId: product1Id, boutiqueId: boutique1Id, type: 'in', reason: 'initial', quantity: 50, createdBy: managerId },
    { productId: product2Id, boutiqueId: boutique1Id, type: 'in', reason: 'initial', quantity: 30, createdBy: managerId },
    { productId: product3Id, boutiqueId: boutique2Id, type: 'in', reason: 'initial', quantity: 15, createdBy: supervisorId },
    { productId: product4Id, boutiqueId: boutique3Id, type: 'in', reason: 'initial', quantity: 100, createdBy: sellerId },
    { productId: product1Id, boutiqueId: boutique1Id, type: 'out', reason: 'sale', quantity: 5, createdBy: sellerId, note: 'Initial sales' },
    { productId: product4Id, boutiqueId: boutique3Id, type: 'adj', reason: 'adjustment', quantity: -3, createdBy: sellerId, note: 'Damaged units' },
  ];
  for (const m of movements) {
    await prisma.inventoryMovement.create({ data: m as any });
  }
  console.log(`Seeded ${movements.length} inventory movements`);

  // ============================================
  // 14. SALES
  // ============================================
  const sales = [
    {
      boutiqueId: boutique1Id, productId: product1Id, productName: 'iPhone 15 Pro Max',
      sellerId, sellerName: 'Omar El Idrissi', soldBy: sellerId,
      quantity: 2, unitPrice: 1299, totalAmount: 2598,
      commissions: [{ actor: 'seller', type: 'percentage', value: 2, amount: 51.96 }, { actor: 'manager', type: 'percentage', value: 3, amount: 77.94 }],
      netAmount: 2468.10,
      status: 'confirmed', paymentMethod: 'card',
    },
    {
      boutiqueId: boutique1Id, productId: product2Id, productName: 'Samsung Galaxy S24 Ultra',
      sellerId, sellerName: 'Omar El Idrissi', soldBy: sellerId,
      quantity: 1, unitPrice: 1099, totalAmount: 1099,
      commissions: [],
      netAmount: 1099,
      status: 'confirmed', paymentMethod: 'cash',
    },
    {
      boutiqueId: boutique2Id, productId: product3Id, productName: 'Designer Leather Jacket',
      sellerId: supervisorId, sellerName: 'Fatima Zahra', soldBy: supervisorId,
      quantity: 1, unitPrice: 599, totalAmount: 599,
      commissions: [{ actor: 'seller', type: 'percentage', value: 5, amount: 29.95 }, { actor: 'supervisor', type: 'fixed', value: 20, amount: 20 }],
      netAmount: 549.05,
      status: 'confirmed', paymentMethod: 'card',
    },
    {
      boutiqueId: boutique3Id, productId: product4Id, productName: 'Car Floor Mats Set',
      sellerId, sellerName: 'Omar El Idrissi', soldBy: sellerId,
      quantity: 3, unitPrice: 79, totalAmount: 237,
      commissions: [{ actor: 'seller', type: 'percentage', value: 3, amount: 7.11 }],
      netAmount: 229.89,
      status: 'pending', paymentMethod: 'cash',
    },
  ];
  for (const s of sales) {
    await prisma.sale.create({ data: s as any });
  }
  console.log(`Seeded ${sales.length} sales`);

  // ============================================
  // 15. STOCK REQUESTS
  // ============================================
  const stockRequests = [
    {
      productId: product1Id, requesterId: boutique2Id, receiverId: boutique1Id,
      quantity: 10, status: 'approved', createdBy: supervisorId,
      fromBoutiqueName: 'Mode Maison Rabat', toBoutiqueName: 'TechWorld Casablanca',
      productName: 'iPhone 15 Pro Max', unitPrice: 1100, totalAmount: 11000,
      respondedAt: new Date(), respondedBy: managerId,
    },
    {
      productId: product4Id, requesterId: boutique1Id, receiverId: boutique3Id,
      quantity: 20, status: 'pending', createdBy: managerId,
      fromBoutiqueName: 'TechWorld Casablanca', toBoutiqueName: 'AutoParts Marrakech',
      productName: 'Car Floor Mats Set', unitPrice: 55, totalAmount: 1100,
      note: 'Need stock for upcoming promotion',
    },
  ];
  for (const sr of stockRequests) {
    await prisma.stockRequest.create({ data: sr as any });
  }
  console.log(`Seeded ${stockRequests.length} stock requests`);

  // ============================================
  // 16. WALLETS & TRANSACTIONS
  // ============================================
  for (const u of users) {
    const existing = await prisma.wallet.findUnique({ where: { userId: u.id } });
    if (!existing) {
      const balance = u.role === 'ADMIN' ? 50000 : u.role === 'MANAGER' ? 15000 : u.role === 'USER' ? 2500 : 5000;
      await prisma.wallet.create({
        data: {
          userId: u.id,
          balance,
          total: balance,
          available: balance,
          margin: balance * 0.15,
          blocked: 0,
          monthlyGain: balance * 0.05,
          monthlyGainPercent: 5,
          currency: 'MAD',
        },
      });
    }
  }

  const walletTxData = [
    { walletUserId: sellerId, type: 'deposit', typeV2: 'deposit', amount: 2000, note: 'Monthly salary deposit' },
    { walletUserId: sellerId, type: 'sale_credit', typeV2: 'profit', amount: 51.96, note: 'Commission from iPhone sale' },
    { walletUserId: buyerId, type: 'deposit', typeV2: 'deposit', amount: 1000, note: 'Wallet top-up' },
    { walletUserId: buyerId, type: 'order_payment', typeV2: 'fee', amount: -599, note: 'Leather jacket purchase' },
  ];
  for (const tx of walletTxData) {
    const wallet = await prisma.wallet.findUnique({ where: { userId: tx.walletUserId } });
    if (wallet) {
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: tx.type as any,
          typeV2: tx.typeV2 as any,
          amount: tx.amount,
          balanceAfter: wallet.balance,
          note: tx.note,
        },
      });
    }
  }
  console.log(`Seeded wallets and transactions`);

  // ============================================
  // 17. ORDERS
  // ============================================
  const orders = [
    {
      userId: buyerId,
      items: [{ productId: product3Id, name: 'Designer Leather Jacket', price: 599, image: 'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg', quantity: 1, condition: 'new', saleType: 'retail' }],
      subtotal: 599, discount: 0, tax: 0, shipping: 30, total: 629,
      status: 'delivered', paymentMethod: 'wallet', paymentStatus: 'paid',
      shippingAddress: '123 Rue de la Liberté, Casablanca',
      customerName: 'Sara Moussaoui', customerPhone: '+212600000005',
    },
    {
      userId: buyerId,
      items: [{ productId: product1Id, name: 'iPhone 15 Pro Max', price: 1299, image: 'https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg', quantity: 1, condition: 'new', saleType: 'retail' }],
      subtotal: 1299, discount: 100, tax: 130, shipping: 0, total: 1329,
      status: 'shipped', paymentMethod: 'card', paymentStatus: 'paid',
      shippingAddress: '123 Rue de la Liberté, Casablanca',
      customerName: 'Sara Moussaoui', customerPhone: '+212600000005',
    },
  ];
  for (const o of orders) {
    await prisma.order.create({ data: o as any });
  }
  console.log(`Seeded ${orders.length} orders`);

  // ============================================
  // 18. NOTIFICATIONS
  // ============================================
  const notifs = [
    { userId: managerId, type: 'sale', typeV2: 'sale', title: 'New Sale Recorded', message: 'iPhone 15 Pro Max sold (2 units)', body: 'A new sale of 2598 MAD was recorded', icon: 'cart', data: { saleId: 'seed' } },
    { userId: managerId, type: 'stock_request', typeV2: 'stock_request', title: 'Stock Request Received', message: 'Mode Maison requests 10 units of iPhone', body: 'A stock request has been received', icon: 'inventory', data: {} },
    { userId: supervisorId, type: 'boutique_request', typeV2: 'network', title: 'Partnership Request', message: 'AutoParts Marrakech wants to partner', body: 'A new partnership request has been received', icon: 'handshake', data: {} },
    { userId: sellerId, type: 'system', typeV2: 'system', title: 'Low Stock Alert', message: 'Wireless Charging Pad is out of stock', body: 'Product WCP-005 needs restocking', icon: 'warning', data: { productId: product5Id } },
    { userId: buyerId, type: 'order', typeV2: 'system', title: 'Order Delivered', message: 'Your order has been delivered', body: 'Designer Leather Jacket delivered successfully', icon: 'checkmark', data: {} },
    { userId: sellerId, type: 'wallet', typeV2: 'system', title: 'Wallet Credit', message: 'Commission credited to wallet', body: '51.96 MAD commission from iPhone sale', icon: 'wallet', data: {} },
  ];
  for (const n of notifs) {
    await prisma.notification.create({ data: n as any });
  }
  console.log(`Seeded ${notifs.length} notifications`);

  // ============================================
  // 19. FEED LIKES
  // ============================================
  const likes = [
    { userId: buyerId, productId: product1Id },
    { userId: buyerId, productId: product3Id },
    { userId: buyerId, productId: product4Id },
    { userId: sellerId, productId: product2Id },
  ];
  for (const l of likes) {
    const existing = await prisma.feedLike.findUnique({ where: { userId_productId: { userId: l.userId, productId: l.productId } } });
    if (!existing) await prisma.feedLike.create({ data: l });
  }
  console.log(`Seeded ${likes.length} feed likes`);

  console.log('\n========================================');
  console.log('Seed completed successfully!');
  console.log('========================================');
  console.log('\nTest Accounts:');
  console.log('  Admin:     admin@oxtore.com / Admin123!@#');
  console.log('  Manager:   manager@oxtore.com / Manager123!@#');
  console.log('  Supervisor: supervisor@oxtore.com / Seller123!@#');
  console.log('  Seller:    seller@oxtore.com / Seller123!@#');
  console.log('  Buyer:     buyer@oxtore.com / User123!@#');
  console.log('\nBoutiques:');
  console.log(`  TechWorld Casablanca: ${boutique1Id}`);
  console.log(`  Mode Maison Rabat:    ${boutique2Id}`);
  console.log(`  AutoParts Marrakech:   ${boutique3Id}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
