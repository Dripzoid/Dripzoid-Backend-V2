import 'dotenv/config';
import fs from 'fs';
import readline from 'readline';
import prisma from '../src/lib/prisma.js';

function parsePostgresCopyLine(line) {
  const rawFields = line.split('\t');
  return rawFields.map((field) => {
    if (field === '\\N') {
      return null;
    }
    return field.replace(/\\(.)/g, (match, char) => {
      switch (char) {
        case 'n': return '\n';
        case 'r': return '\r';
        case 't': return '\t';
        case 'b': return '\b';
        case 'f': return '\f';
        case '\\': return '\\';
        default: return char;
      }
    });
  });
}

function toBool(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return val;
  return val === 't' || val === 'true' || val === '1';
}

function toDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function toInt(val, defaultVal = 0) {
  if (val === null || val === undefined) return defaultVal;
  const n = parseInt(val, 10);
  return isNaN(n) ? defaultVal : n;
}

function toNullableInt(val) {
  if (val === null || val === undefined) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function toFloat(val, defaultVal = 0.0) {
  if (val === null || val === undefined) return defaultVal;
  const n = parseFloat(val);
  return isNaN(n) ? defaultVal : n;
}

function toNullableFloat(val) {
  if (val === null || val === undefined) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function toJson(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

function toVector(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(Number);
  try {
    const cleaned = val.trim().replace(/^\[|\]$/g, '');
    if (!cleaned) return [];
    return cleaned.split(',').map((n) => parseFloat(n.trim()));
  } catch {
    return [];
  }
}

async function parseDumpFile(filePath) {
  console.log(`📂 Reading SQL dump from: ${filePath}`);
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const tableData = {};
  let currentTable = null;
  let currentCols = [];

  for await (const line of rl) {
    if (line.startsWith('COPY ')) {
      const match = line.match(/COPY (?:public\.)?"?([a-zA-Z0-9_]+)"?\s*\(([^)]+)\)/i);
      if (match) {
        currentTable = match[1];
        currentCols = match[2].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        tableData[currentTable] = { columns: currentCols, rows: [] };
      }
    } else if (line === '\\.') {
      currentTable = null;
    } else if (currentTable) {
      const fields = parsePostgresCopyLine(line);
      const row = {};
      currentCols.forEach((col, idx) => {
        row[col] = fields[idx];
      });
      tableData[currentTable].rows.push(row);
    }
  }

  return tableData;
}

async function migrateAll() {
  const dumpPath = process.env.SQL_DUMP_PATH ||
    (fs.existsSync('dripzoid-backup-2026-10-08.sql') ? 'dripzoid-backup-2026-10-08.sql' : 'C:\\Users\\yuvat\\Downloads\\dripzoid-backup-2026-10-08.sql');
  if (!fs.existsSync(dumpPath)) {
    throw new Error(`Dump file not found at: ${dumpPath}`);
  }

  const dump = await parseDumpFile(dumpPath);
  console.log('✅ SQL dump successfully parsed into memory.');

  const stats = {};
  const failedRecords = [];

  async function migrateTable(tableName, rows, transformFn, upsertFn) {
    const count = rows ? rows.length : 0;
    stats[tableName] = { source: count, migrated: 0, failed: 0 };
    if (!count) return;

    console.log(`\n⏳ Migrating [${tableName}] (${count} records)...`);
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      try {
        const transformed = transformFn(raw);
        await upsertFn(transformed);
        stats[tableName].migrated++;
      } catch (err) {
        stats[tableName].failed++;
        const recordId = raw.id || raw.email || raw.productId || raw.product_id || raw.userId || raw.code || raw.name || `row-${i}`;
        failedRecords.push({
          table: tableName,
          recordId: String(recordId),
          reason: err.message,
        });
        console.error(`❌ Error in ${tableName} [ID: ${recordId}]:`, err.message);
      }
    }
    console.log(`✅ [${tableName}] Completed: ${stats[tableName].migrated}/${count} migrated, ${stats[tableName].failed} failed`);
  }

  // 1. User
  await migrateTable('User', dump['User']?.rows, (r) => ({
    id: r.id,
    name: r.name,
    email: r.email.toLowerCase().trim(),
    phone: r.phone,
    password: r.password,
    gender: r.gender,
    dob: toDate(r.dob),
    avatar: r.avatar,
    isAdmin: toBool(r.isAdmin),
    createdAt: toDate(r.createdAt) || new Date(),
    updatedAt: toDate(r.updatedAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.user.upsert({ where: { id }, update: rest, create: data });
  });

  // 2. Category
  await migrateTable('Category', dump['Category']?.rows, (r) => ({
    id: r.id,
    category: r.category,
    subcategory: r.subcategory,
    slug: r.slug,
    status: r.status,
    sortOrder: toInt(r.sortOrder, 0),
    parentId: r.parentId,
    metadata: toJson(r.metadata),
    isDeleted: toBool(r.isDeleted),
    createdAt: toDate(r.createdAt) || new Date(),
    updatedAt: toDate(r.updatedAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.category.upsert({ where: { id }, update: rest, create: data });
  });

  // 3. Product
  await migrateTable('Product', dump['Product']?.rows, (r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    categoryId: r.categoryId,
    subcategory: r.subcategory,
    description: r.description,
    price: toFloat(r.price),
    originalPrice: toNullableFloat(r.originalPrice),
    actualPrice: toNullableFloat(r.actualPrice),
    rating: toNullableFloat(r.rating),
    stock: toInt(r.stock, 0),
    sold: toInt(r.sold, 0),
    featured: toBool(r.featured),
    images: toJson(r.images),
    colors: toJson(r.colors),
    createdAt: toDate(r.createdAt) || new Date(),
    updatedAt: toDate(r.updatedAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.product.upsert({ where: { id }, update: rest, create: data });
  });

  // 4. ProductSize
  await migrateTable('ProductSize', dump['ProductSize']?.rows, (r) => ({
    id: r.id,
    productId: r.productId,
    size: r.size,
    stock: toInt(r.stock, 0),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.productSize.upsert({ where: { id }, update: rest, create: data });
  });

  // 5. Address
  await migrateTable('Address', dump['Address']?.rows, (r) => ({
    id: r.id,
    userId: r.userId,
    label: r.label,
    name: r.name,
    phone: r.phone,
    line1: r.line1,
    line2: r.line2,
    city: r.city,
    state: r.state,
    pincode: r.pincode,
    country: r.country || 'India',
    isDefault: toBool(r.isDefault),
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.address.upsert({ where: { id }, update: rest, create: data });
  });

  // 6. Order
  await migrateTable('Order', dump['Order']?.rows, (r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    userId: r.userId,
    addressId: r.addressId,
    totalAmount: toFloat(r.totalAmount),
    paymentMethod: r.paymentMethod,
    status: r.status || 'Pending',
    paymentDetails: toJson(r.paymentDetails),
    shippingAddress: toJson(r.shippingAddress),
    deliveryDate: toDate(r.deliveryDate),
    razorpayOrderId: r.razorpayOrderId,
    razorpayPaymentId: r.razorpayPaymentId,
    razorpayAmount: toNullableInt(r.razorpayAmount),
    createdAt: toDate(r.createdAt) || new Date(),
    updatedAt: toDate(r.updatedAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.order.upsert({ where: { id }, update: rest, create: data });
  });

  // 7. OrderItem
  await migrateTable('OrderItem', dump['OrderItem']?.rows, (r) => ({
    id: r.id,
    orderId: r.orderId,
    productId: r.productId,
    quantity: toInt(r.quantity, 1),
    unitPrice: toFloat(r.unitPrice),
    price: toNullableFloat(r.price),
    selectedColor: r.selectedColor,
    selectedSize: r.selectedSize,
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.orderItem.upsert({ where: { id }, update: rest, create: data });
  });

  // 8. CartItem
  await migrateTable('CartItem', dump['CartItem']?.rows, (r) => ({
    id: r.id,
    userId: r.userId,
    productId: r.productId,
    size: r.size,
    color: r.color,
    quantity: toInt(r.quantity, 1),
    addedAt: toDate(r.addedAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.cartItem.upsert({ where: { id }, update: rest, create: data });
  });

  // 9. WishlistItem
  await migrateTable('WishlistItem', dump['WishlistItem']?.rows, (r) => ({
    id: r.id,
    userId: r.userId,
    productId: r.productId,
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.wishlistItem.upsert({ where: { id }, update: rest, create: data });
  });

  // 10. Review
  await migrateTable('Review', dump['Review']?.rows, (r) => ({
    id: r.id,
    productId: r.productId,
    userId: r.userId,
    rating: toInt(r.rating, 5),
    text: r.text,
    imageUrl: r.imageUrl,
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.review.upsert({ where: { id }, update: rest, create: data });
  });

  // 11. Question
  await migrateTable('Question', dump['Question']?.rows, (r) => ({
    id: r.id,
    productId: r.productId,
    userId: r.userId,
    text: r.text,
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.question.upsert({ where: { id }, update: rest, create: data });
  });

  // 12. Answer
  await migrateTable('Answer', dump['Answer']?.rows, (r) => ({
    id: r.id,
    questionId: r.questionId,
    userId: r.userId,
    text: r.text,
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.answer.upsert({ where: { id }, update: rest, create: data });
  });

  // 13. Vote
  await migrateTable('Vote', dump['Vote']?.rows, (r) => ({
    id: r.id,
    entityId: r.entityId,
    entityType: r.entityType,
    userId: r.userId,
    reviewId: r.reviewId,
    vote: r.vote,
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.vote.upsert({ where: { id }, update: rest, create: data });
  });

  // 14. Sale
  await migrateTable('Sale', dump['Sale']?.rows, (r) => ({
    id: r.id,
    name: r.name,
    enabled: toBool(r.enabled),
    isDeleted: toBool(r.isDeleted),
    createdAt: toDate(r.createdAt) || new Date(),
    updatedAt: toDate(r.updatedAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.sale.upsert({ where: { id }, update: rest, create: data });
  });

  // 15. SaleProduct
  await migrateTable('SaleProduct', dump['SaleProduct']?.rows, (r) => ({
    id: r.id,
    saleId: r.saleId,
    productId: r.productId,
    position: toInt(r.position, 0),
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.saleProduct.upsert({ where: { id }, update: rest, create: data });
  });

  // 16. Coupon
  await migrateTable('Coupon', dump['Coupon']?.rows, (r) => ({
    id: r.id,
    code: r.code,
    type: r.type,
    amount: toFloat(r.amount),
    minPurchase: toFloat(r.minPurchase, 0),
    usageLimit: toInt(r.usageLimit, 0),
    used: toInt(r.used, 0),
    startsAt: toDate(r.startsAt),
    endsAt: toDate(r.endsAt),
    active: toBool(r.active),
    appliesTo: r.appliesTo || 'all',
    description: r.description,
    createdAt: toDate(r.createdAt) || new Date(),
    updatedAt: toDate(r.updatedAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.coupon.upsert({ where: { id }, update: rest, create: data });
  });

  // 17. CouponTarget
  await migrateTable('CouponTarget', dump['CouponTarget']?.rows, (r) => ({
    id: r.id,
    couponId: r.couponId,
    targetType: r.targetType,
    targetId: r.targetId,
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.couponTarget.upsert({ where: { id }, update: rest, create: data });
  });

  // 18. CouponUsage
  await migrateTable('CouponUsage', dump['CouponUsage']?.rows, (r) => ({
    id: r.id,
    couponId: r.couponId,
    orderId: r.orderId,
    userId: r.userId,
    discountAmount: toFloat(r.discountAmount),
    usedAt: toDate(r.usedAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.couponUsage.upsert({ where: { id }, update: rest, create: data });
  });

  // 19. CouponAuditLog
  await migrateTable('CouponAuditLog', dump['CouponAuditLog']?.rows, (r) => ({
    id: r.id,
    couponId: r.couponId,
    action: r.action,
    message: r.message,
    actor: r.actor || 'system',
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.couponAuditLog.upsert({ where: { id }, update: rest, create: data });
  });

  // 20. Job
  await migrateTable('Job', dump['Job']?.rows, (r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    type: r.type,
    location: r.location,
    department: r.department,
    duration: r.duration,
    stipend: r.stipend,
    status: r.status || 'Open',
    description: r.description,
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.job.upsert({ where: { id }, update: rest, create: data });
  });

  // 21. Application
  await migrateTable('Application', dump['Application']?.rows, (r) => ({
    id: r.id,
    jobId: r.jobId,
    userId: r.userId,
    name: r.name,
    email: r.email,
    phone: r.phone,
    portfolio: r.portfolio,
    cover: r.cover,
    resumeUrl: r.resumeUrl,
    status: r.status || 'Applied',
    certificateGenerated: toBool(r.certificateGenerated),
    appliedAt: toDate(r.appliedAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.application.upsert({ where: { id }, update: rest, create: data });
  });

  // 22. Certificate
  await migrateTable('Certificate', dump['Certificate']?.rows, (r) => ({
    id: r.id,
    applicationId: r.applicationId,
    certificateId: r.certificateId,
    internName: r.internName,
    role: r.role,
    startDate: toDate(r.startDate),
    endDate: toDate(r.endDate),
    issueDate: toDate(r.issueDate),
    certificateUrl: r.certificateUrl,
    qrUrl: r.qrUrl,
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.certificate.upsert({ where: { id }, update: rest, create: data });
  });

  // 23. Slide
  await migrateTable('Slide', dump['Slide']?.rows, (r) => ({
    id: r.id,
    name: r.name,
    imageUrl: r.imageUrl,
    link: r.link,
    orderIndex: toInt(r.orderIndex, 0),
    isDeleted: toBool(r.isDeleted),
    createdAt: toDate(r.createdAt) || new Date(),
    updatedAt: toDate(r.updatedAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.slide.upsert({ where: { id }, update: rest, create: data });
  });

  // 24. UserNotification
  await migrateTable('UserNotification', dump['UserNotification']?.rows, (r) => ({
    userId: r.userId,
    email: toBool(r.email),
    sms: toBool(r.sms),
    push: toBool(r.push),
    marketing: toBool(r.marketing),
    orderUpdates: toBool(r.orderUpdates),
  }), (data) => {
    const { userId, ...rest } = data;
    return prisma.userNotification.upsert({ where: { userId }, update: rest, create: data });
  });

  // 25. UserSecurity
  await migrateTable('UserSecurity', dump['UserSecurity']?.rows, (r) => ({
    userId: r.userId,
    twoFaEnabled: toBool(r.twoFaEnabled),
    backupCodes: toJson(r.backupCodes),
  }), (data) => {
    const { userId, ...rest } = data;
    return prisma.userSecurity.upsert({ where: { userId }, update: rest, create: data });
  });

  // 26. UserSession
  await migrateTable('UserSession', dump['UserSession']?.rows, (r) => ({
    id: r.id,
    userId: r.userId,
    device: r.device,
    ip: r.ip,
    lastActive: toDate(r.lastActive),
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.userSession.upsert({ where: { id }, update: rest, create: data });
  });

  // 27. UserActivity
  await migrateTable('UserActivity', dump['UserActivity']?.rows, (r) => ({
    id: r.id,
    userId: r.userId,
    action: r.action,
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.userActivity.upsert({ where: { id }, update: rest, create: data });
  });

  // 28. OtpData
  await migrateTable('OtpData', dump['OtpData']?.rows, (r) => ({
    email: r.email,
    otpHash: r.otpHash,
    otpCreatedAt: BigInt(r.otpCreatedAt || '0'),
    attempts: toInt(r.attempts, 0),
  }), (data) => {
    const { email, ...rest } = data;
    return prisma.otpData.upsert({ where: { email }, update: rest, create: data });
  });

  // 29. AuditLog
  await migrateTable('AuditLog', dump['AuditLog']?.rows, (r) => ({
    id: r.id,
    adminId: r.adminId,
    actionType: r.actionType,
    entityType: r.entityType,
    entityId: r.entityId,
    details: toJson(r.details),
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.auditLog.upsert({ where: { id }, update: rest, create: data });
  });

  // 30. Conversation
  await migrateTable('Conversation', dump['Conversation']?.rows, (r) => ({
    id: r.id,
    userId: r.userId,
    title: r.title,
    createdAt: toDate(r.createdAt) || new Date(),
    updatedAt: toDate(r.updatedAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.conversation.upsert({ where: { id }, update: rest, create: data });
  });

  // 31. Message
  await migrateTable('Message', dump['Message']?.rows, (r) => ({
    id: r.id,
    conversationId: r.conversationId,
    role: r.role,
    content: r.content,
    model: r.model,
    tokenCount: toNullableInt(r.tokenCount),
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.message.upsert({ where: { id }, update: rest, create: data });
  });

  // 32. SavedConversation
  await migrateTable('SavedConversation', dump['SavedConversation']?.rows, (r) => ({
    id: r.id,
    userId: r.userId,
    conversationId: r.conversationId,
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.savedConversation.upsert({ where: { id }, update: rest, create: data });
  });

  // 33. AiUsage
  await migrateTable('AiUsage', dump['AiUsage']?.rows, (r) => ({
    id: r.id,
    userId: r.userId,
    conversationId: r.conversationId,
    model: r.model,
    promptTokens: toInt(r.promptTokens, 0),
    completionTokens: toInt(r.completionTokens, 0),
    totalTokens: toInt(r.totalTokens, 0),
    estimatedCost: toFloat(r.estimatedCost, 0),
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.aiUsage.upsert({ where: { id }, update: rest, create: data });
  });

  // 34. UserPreference
  await migrateTable('UserPreference', dump['UserPreference']?.rows, (r) => ({
    userId: r.userId,
    preferredModel: r.preferredModel,
    systemPrompt: r.systemPrompt,
    temperature: toNullableFloat(r.temperature),
    createdAt: toDate(r.createdAt) || new Date(),
    updatedAt: toDate(r.updatedAt) || new Date(),
  }), (data) => {
    const { userId, ...rest } = data;
    return prisma.userPreference.upsert({ where: { userId }, update: rest, create: data });
  });

  // 35. ProductVector
  await migrateTable('product_vectors', dump['product_vectors']?.rows, (r) => ({
    productId: r.product_id,
    embedding: toVector(r.embedding),
    createdAt: toDate(r.created_at) || new Date(),
    updatedAt: toDate(r.updated_at) || new Date(),
  }), (data) => {
    const { productId, ...rest } = data;
    return prisma.productVector.upsert({ where: { productId }, update: rest, create: data });
  });

  // 36. KBVector
  await migrateTable('kb_vectors', dump['kb_vectors']?.rows, (r) => ({
    id: r.id,
    route: r.route,
    factText: r.fact_text,
    embedding: toVector(r.embedding),
    createdAt: toDate(r.created_at) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.kBVector.upsert({ where: { id }, update: rest, create: data });
  });

  // 37. AutomationEvent
  await migrateTable('automation_events', dump['automation_events']?.rows, (r) => ({
    id: r.id,
    eventType: r.eventType,
    payload: toJson(r.payload),
    source: r.source || 'dripzoid-backend',
    status: r.status || 'pending',
    retryCount: toInt(r.retryCount, 0),
    lastError: r.lastError,
    processedAt: toDate(r.processedAt),
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.automationEvent.upsert({ where: { id }, update: rest, create: data });
  });

  // 38. EmailLog
  await migrateTable('email_logs', dump['email_logs']?.rows, (r) => ({
    id: r.id,
    recipientEmail: r.recipientEmail,
    subject: r.subject,
    templateName: r.templateName,
    eventType: r.eventType,
    provider: r.provider || 'msg91',
    providerMessageId: r.providerMessageId,
    status: r.status,
    errorMessage: r.errorMessage,
    sentAt: toDate(r.sentAt),
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.emailLog.upsert({ where: { id }, update: rest, create: data });
  });

  // 39. ScheduledTask
  await migrateTable('scheduled_tasks', dump['scheduled_tasks']?.rows, (r) => ({
    id: r.id,
    taskType: r.taskType,
    payload: toJson(r.payload),
    executeAt: toDate(r.executeAt) || new Date(),
    status: r.status || 'pending',
    executedAt: toDate(r.executedAt),
    retryCount: toInt(r.retryCount, 0),
    lastError: r.lastError,
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.scheduledTask.upsert({ where: { id }, update: rest, create: data });
  });

  // 40. AutomationLog
  await migrateTable('automation_logs', dump['automation_logs']?.rows, (r) => ({
    id: r.id,
    level: r.level,
    service: r.service,
    message: r.message,
    metadata: toJson(r.metadata),
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.automationLog.upsert({ where: { id }, update: rest, create: data });
  });

  // 41. AutomationConfig
  await migrateTable('automation_configs', dump['automation_configs']?.rows, (r) => ({
    id: r.id,
    configKey: r.configKey,
    configValue: r.configValue,
    updatedAt: toDate(r.updatedAt) || new Date(),
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.automationConfig.upsert({ where: { id }, update: rest, create: data });
  });

  // 42. AutomationTemplate
  await migrateTable('automation_templates', dump['automation_templates']?.rows, (r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    subject: r.subject,
    content: r.content,
    isActive: toBool(r.isActive),
    version: toInt(r.version, 1),
    createdAt: toDate(r.createdAt) || new Date(),
    updatedAt: toDate(r.updatedAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.automationTemplate.upsert({ where: { id }, update: rest, create: data });
  });

  // 43. Courier
  await migrateTable('Courier', dump['Courier']?.rows, (r) => ({
    id: toInt(r.id),
    name: r.name,
    baseCourierId: toNullableInt(r.baseCourierId),
    minWeight: toNullableFloat(r.minWeight),
    mode: toNullableInt(r.mode),
    serviceType: toNullableInt(r.serviceType),
    isActive: toBool(r.isActive),
    realtimeTracking: r.realtimeTracking,
    podAvailable: r.podAvailable,
    callBeforeDelivery: r.callBeforeDelivery,
    createdAt: toDate(r.createdAt) || new Date(),
    updatedAt: toDate(r.updatedAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.courier.upsert({ where: { id }, update: rest, create: data });
  });

  // 44. Shipment
  await migrateTable('Shipment', dump['Shipment']?.rows, (r) => ({
    id: r.id,
    orderId: r.orderId,
    shiprocketOrderId: r.shiprocketOrderId,
    shipmentId: r.shipmentId,
    awbCode: r.awbCode,
    courierId: toNullableInt(r.courierId),
    courierName: r.courierName,
    shipmentStatus: r.shipmentStatus,
    pickupScheduledAt: toDate(r.pickupScheduledAt),
    pickupTokenNumber: r.pickupTokenNumber,
    assignedAt: toDate(r.assignedAt),
    isReturn: toBool(r.isReturn),
    createdAt: toDate(r.createdAt) || new Date(),
    updatedAt: toDate(r.updatedAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.shipment.upsert({ where: { id }, update: rest, create: data });
  });

  // 45. ShipmentTracking
  await migrateTable('ShipmentTracking', dump['ShipmentTracking']?.rows, (r) => ({
    id: r.id,
    shipmentId: r.shipmentId,
    status: r.status,
    activity: r.activity,
    location: r.location,
    scanTimestamp: toDate(r.scanTimestamp),
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.shipmentTracking.upsert({ where: { id }, update: rest, create: data });
  });

  // 46. ServiceabilityCheck
  await migrateTable('ServiceabilityCheck', dump['ServiceabilityCheck']?.rows, (r) => ({
    id: r.id,
    orderId: r.orderId,
    courierId: toNullableInt(r.courierId),
    courierName: r.courierName,
    estimatedDays: toNullableInt(r.estimatedDays),
    etd: r.etd,
    freightCharge: toNullableFloat(r.freightCharge),
    rtoCharges: toNullableFloat(r.rtoCharges),
    rating: toNullableFloat(r.rating),
    isRecommended: toBool(r.isRecommended),
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.serviceabilityCheck.upsert({ where: { id }, update: rest, create: data });
  });

  // 47. ShipmentWebhookEvent
  await migrateTable('ShipmentWebhookEvent', dump['ShipmentWebhookEvent']?.rows, (r) => ({
    id: r.id,
    shipmentId: r.shipmentId,
    shiprocketOrderId: r.shiprocketOrderId,
    status: r.status,
    payload: toJson(r.payload),
    createdAt: toDate(r.createdAt) || new Date(),
  }), (data) => {
    const { id, ...rest } = data;
    return prisma.shipmentWebhookEvent.upsert({ where: { id }, update: rest, create: data });
  });

  console.log('\n======================================================');
  console.log('🎉 MIGRATION IMPORT COMPLETE');
  console.log('======================================================');
  console.log(`Total Failed Records: ${failedRecords.length}`);
  if (failedRecords.length > 0) {
    console.log('Failed records details:', JSON.stringify(failedRecords, null, 2));
  }
}

migrateAll()
  .catch((err) => {
    console.error('Fatal migration error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
