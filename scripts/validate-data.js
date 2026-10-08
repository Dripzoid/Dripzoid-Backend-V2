import 'dotenv/config';
import fs from 'fs';
import readline from 'readline';
import prisma from '../src/lib/prisma.js';

async function countSourceDump(filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const counts = {};
  let currentTable = null;

  for await (const line of rl) {
    if (line.startsWith('COPY ')) {
      const match = line.match(/COPY (?:public\.)?"?([a-zA-Z0-9_]+)"?\s*\(/i);
      if (match) {
        currentTable = match[1];
        counts[currentTable] = 0;
      }
    } else if (line === '\\.') {
      currentTable = null;
    } else if (currentTable) {
      counts[currentTable]++;
    }
  }

  return counts;
}

async function validateData() {
  console.log('🔍 Starting comprehensive data validation...\n');
  const dumpPath = process.env.SQL_DUMP_PATH ||
    (fs.existsSync('dripzoid-backup-2026-10-08.sql') ? 'dripzoid-backup-2026-10-08.sql' : 'C:\\Users\\yuvat\\Downloads\\dripzoid-backup-2026-10-08.sql');
  const sourceCounts = await countSourceDump(dumpPath);

  const modelMap = [
    { table: 'User', model: prisma.user },
    { table: 'Address', model: prisma.address },
    { table: 'Product', model: prisma.product },
    { table: 'ProductSize', model: prisma.productSize },
    { table: 'Category', model: prisma.category },
    { table: 'CartItem', model: prisma.cartItem },
    { table: 'WishlistItem', model: prisma.wishlistItem },
    { table: 'Order', model: prisma.order },
    { table: 'OrderItem', model: prisma.orderItem },
    { table: 'Review', model: prisma.review },
    { table: 'Question', model: prisma.question },
    { table: 'Answer', model: prisma.answer },
    { table: 'Vote', model: prisma.vote },
    { table: 'Sale', model: prisma.sale },
    { table: 'SaleProduct', model: prisma.saleProduct },
    { table: 'Coupon', model: prisma.coupon },
    { table: 'CouponTarget', model: prisma.couponTarget },
    { table: 'CouponUsage', model: prisma.couponUsage },
    { table: 'CouponAuditLog', model: prisma.couponAuditLog },
    { table: 'Job', model: prisma.job },
    { table: 'Application', model: prisma.application },
    { table: 'Certificate', model: prisma.certificate },
    { table: 'Slide', model: prisma.slide },
    { table: 'UserNotification', model: prisma.userNotification },
    { table: 'UserSecurity', model: prisma.userSecurity },
    { table: 'UserSession', model: prisma.userSession },
    { table: 'UserActivity', model: prisma.userActivity },
    { table: 'OtpData', model: prisma.otpData },
    { table: 'AuditLog', model: prisma.auditLog },
    { table: 'Conversation', model: prisma.conversation },
    { table: 'Message', model: prisma.message },
    { table: 'SavedConversation', model: prisma.savedConversation },
    { table: 'AiUsage', model: prisma.aiUsage },
    { table: 'UserPreference', model: prisma.userPreference },
    { table: 'product_vectors', model: prisma.productVector },
    { table: 'kb_vectors', model: prisma.kBVector },
    { table: 'automation_events', model: prisma.automationEvent },
    { table: 'email_logs', model: prisma.emailLog },
    { table: 'scheduled_tasks', model: prisma.scheduledTask },
    { table: 'automation_logs', model: prisma.automationLog },
    { table: 'automation_configs', model: prisma.automationConfig },
    { table: 'automation_templates', model: prisma.automationTemplate },
    { table: 'Courier', model: prisma.courier },
    { table: 'Shipment', model: prisma.shipment },
    { table: 'ShipmentTracking', model: prisma.shipmentTracking },
    { table: 'ServiceabilityCheck', model: prisma.serviceabilityCheck },
    { table: 'ShipmentWebhookEvent', model: prisma.shipmentWebhookEvent },
  ];

  console.log('--------------------------------------------------------------------------------------');
  console.log('TABLE/COLLECTION'.padEnd(25) + ' | ' + 'SOURCE COUNT'.padStart(12) + ' | ' + 'MONGODB COUNT'.padStart(13) + ' | ' + 'STATUS');
  console.log('--------------------------------------------------------------------------------------');

  let allMatch = true;

  for (const item of modelMap) {
    const src = sourceCounts[item.table] || 0;
    const mongo = await item.model.count();
    const matches = src === mongo;
    if (!matches) allMatch = false;
    const status = matches ? 'MATCH' : 'MISMATCH ❌';
    console.log(`${item.table.padEnd(25)} | ${String(src).padStart(12)} | ${String(mongo).padStart(13)} | ${status}`);
  }

  console.log('--------------------------------------------------------------------------------------');

  console.log('\n🔗 Checking relational integrity and orphan references...');
  let orphanErrors = 0;

  // 1. Order -> User & Address
  const orders = await prisma.order.findMany();
  for (const o of orders) {
    const user = await prisma.user.findUnique({ where: { id: o.userId } });
    if (!user) {
      console.error(`❌ Orphan Order: ${o.id} references non-existent userId ${o.userId}`);
      orphanErrors++;
    }
    if (o.addressId) {
      const addr = await prisma.address.findUnique({ where: { id: o.addressId } });
      if (!addr) {
        console.error(`❌ Orphan Order: ${o.id} references non-existent addressId ${o.addressId}`);
        orphanErrors++;
      }
    }
  }

  // 2. OrderItem -> Order & Product
  const orderItems = await prisma.orderItem.findMany();
  for (const oi of orderItems) {
    const order = await prisma.order.findUnique({ where: { id: oi.orderId } });
    if (!order) {
      console.error(`❌ Orphan OrderItem: ${oi.id} references non-existent orderId ${oi.orderId}`);
      orphanErrors++;
    }
    const product = await prisma.product.findUnique({ where: { id: oi.productId } });
    if (!product) {
      console.error(`❌ Orphan OrderItem: ${oi.id} references non-existent productId ${oi.productId}`);
      orphanErrors++;
    }
  }

  // 3. CartItem -> User & Product
  const cartItems = await prisma.cartItem.findMany();
  for (const ci of cartItems) {
    const user = await prisma.user.findUnique({ where: { id: ci.userId } });
    if (!user) {
      console.error(`❌ Orphan CartItem: ${ci.id} references non-existent userId ${ci.userId}`);
      orphanErrors++;
    }
    const prod = await prisma.product.findUnique({ where: { id: ci.productId } });
    if (!prod) {
      console.error(`❌ Orphan CartItem: ${ci.id} references non-existent productId ${ci.productId}`);
      orphanErrors++;
    }
  }

  // 4. WishlistItem -> User & Product
  const wishlistItems = await prisma.wishlistItem.findMany();
  for (const wi of wishlistItems) {
    const user = await prisma.user.findUnique({ where: { id: wi.userId } });
    if (!user) {
      console.error(`❌ Orphan WishlistItem: ${wi.id} references non-existent userId ${wi.userId}`);
      orphanErrors++;
    }
    const prod = await prisma.product.findUnique({ where: { id: wi.productId } });
    if (!prod) {
      console.error(`❌ Orphan WishlistItem: ${wi.id} references non-existent productId ${wi.productId}`);
      orphanErrors++;
    }
  }

  // 5. Shipment -> Order
  const shipments = await prisma.shipment.findMany();
  for (const s of shipments) {
    const order = await prisma.order.findUnique({ where: { id: s.orderId } });
    if (!order) {
      console.error(`❌ Orphan Shipment: ${s.id} references non-existent orderId ${s.orderId}`);
      orphanErrors++;
    }
  }

  // 6. ShipmentTracking -> Shipment
  const trackings = await prisma.shipmentTracking.findMany();
  for (const t of trackings) {
    const shipment = await prisma.shipment.findUnique({ where: { id: t.shipmentId } });
    if (!shipment) {
      console.error(`❌ Orphan Tracking: ${t.id} references non-existent shipmentId ${t.shipmentId}`);
      orphanErrors++;
    }
  }

  // 7. Message -> Conversation
  const messages = await prisma.message.findMany({ take: 20 });
  for (const m of messages) {
    const conv = await prisma.conversation.findUnique({ where: { id: m.conversationId } });
    if (!conv) {
      console.error(`❌ Orphan Message: ${m.id} references non-existent conversationId ${m.conversationId}`);
      orphanErrors++;
    }
  }

  // 8. ProductSize -> Product
  const sizes = await prisma.productSize.findMany({ take: 20 });
  for (const sz of sizes) {
    const prod = await prisma.product.findUnique({ where: { id: sz.productId } });
    if (!prod) {
      console.error(`❌ Orphan ProductSize: ${sz.id} references non-existent productId ${sz.productId}`);
      orphanErrors++;
    }
  }

  // 9. ProductVector -> Product
  const pvecs = await prisma.productVector.findMany();
  for (const pv of pvecs) {
    const prod = await prisma.product.findUnique({ where: { id: pv.productId } });
    if (!prod) {
      console.error(`❌ Orphan ProductVector: ${pv.productId} references non-existent product`);
      orphanErrors++;
    }
  }

  if (orphanErrors === 0) {
    console.log('✅ Relational integrity test passed: 0 orphaned references found.');
  } else {
    console.error(`❌ Relational integrity issues found: ${orphanErrors} errors.`);
  }

  console.log('\n📊 Sample Data Integrity Check:');
  const sampleUser = await prisma.user.findFirst({ where: { isAdmin: true } });
  console.log(`- Admin User Verified: ${sampleUser?.email} (Admin: ${sampleUser?.isAdmin})`);

  const sampleOrder = await prisma.order.findFirst({ include: { items: true, address: true, shipment: true } });
  console.log(`- Order Verified: ${sampleOrder?.orderNumber} with ${sampleOrder?.items?.length} items, Address: ${sampleOrder?.address?.city || 'N/A'}, Shipment: ${sampleOrder?.shipment?.shiprocketOrderId || 'N/A'}`);

  const sampleProduct = await prisma.product.findFirst({ include: { category: true, sizes: true } });
  console.log(`- Product Verified: "${sampleProduct?.name}" (Price: ₹${sampleProduct?.price}, Sizes: ${sampleProduct?.sizes?.length}, Category: ${sampleProduct?.category?.category})`);

  const sampleKB = await prisma.kBVector.findFirst();
  console.log(`- KB Vector Verified: Route "${sampleKB?.route}", Embedding dimension: ${sampleKB?.embedding?.length}`);

  const sampleProductVec = await prisma.productVector.findFirst();
  console.log(`- Product Vector Verified: Product ID "${sampleProductVec?.productId}", Embedding dimension: ${sampleProductVec?.embedding?.length}`);
}

validateData()
  .catch((err) => {
    console.error('Validation error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
