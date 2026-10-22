import './test-env.js';
import assert from 'node:assert';
import { AppError } from '../src/errors/AppError.js';
import {
  normalizeOrderItems,
  normalizeShippingAddress,
} from '../src/modules/orders/order.utils.js';
import {
  createOrderService,
  executeWithTransaction,
  isTransactionSupported,
  setTransactionSupportForTesting,
  resetTransactionSupportCache,
  reserveProductStock,
  reserveProductSizeStock,
} from '../src/modules/orders/order.service.js';
import { verifyPaymentService } from '../src/modules/payments/payment.service.js';

console.log('🧪 Starting Dripzoid Order Flow & Validation Tests...\n');

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ FAIL: ${description}`);
    console.error(err);
  }
}

async function asyncTest(description, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ FAIL: ${description}`);
    console.error(err);
  }
}

/**
 * Creates an in-memory Prisma-compatible test database with snapshot transaction support.
 */
function createMockPrisma({ supportsTransactions = true } = {}) {
  const store = {
    products: new Map(),
    productSizes: new Map(),
    orders: new Map(),
    orderItems: new Map(),
    cartItems: new Map(),
    addresses: new Map(),
  };

  function cloneStore(source) {
    return {
      products: new Map(Array.from(source.products.entries()).map(([k, v]) => [k, { ...v }])),
      productSizes: new Map(Array.from(source.productSizes.entries()).map(([k, v]) => [k, { ...v }])),
      orders: new Map(Array.from(source.orders.entries()).map(([k, v]) => [k, { ...v }])),
      orderItems: new Map(Array.from(source.orderItems.entries()).map(([k, v]) => [k, { ...v }])),
      cartItems: new Map(Array.from(source.cartItems.entries()).map(([k, v]) => [k, { ...v }])),
      addresses: new Map(Array.from(source.addresses.entries()).map(([k, v]) => [k, { ...v }])),
    };
  }

  function createClient(currentStore) {
    return {
      _store: currentStore,
      $transaction: async (callback) => {
        if (!supportsTransactions) {
          const err = new Error('Kind: Transactions are not supported by this deployment, labels: {}, source: None');
          err.code = 'P2010';
          throw err;
        }

        const snapshot = cloneStore(currentStore);
        const txClient = createClient(snapshot);

        try {
          const result = await callback(txClient);
          // Commit snapshot to currentStore on success
          currentStore.products = snapshot.products;
          currentStore.productSizes = snapshot.productSizes;
          currentStore.orders = snapshot.orders;
          currentStore.orderItems = snapshot.orderItems;
          currentStore.cartItems = snapshot.cartItems;
          currentStore.addresses = snapshot.addresses;
          return result;
        } catch (txErr) {
          // Transaction aborted: snapshot discarded automatically
          throw txErr;
        }
      },

      product: {
        findUnique: async ({ where }) => {
          const p = currentStore.products.get(where.id);
          return p ? { ...p } : null;
        },
        updateMany: async ({ where, data }) => {
          const p = currentStore.products.get(where.id);
          if (!p) return { count: 0 };

          if (where.stock && typeof where.stock.gte === 'number') {
            if (p.stock === null || p.stock < where.stock.gte) {
              return { count: 0 };
            }
          }

          if (data.stock && typeof data.stock.decrement === 'number') {
            p.stock -= data.stock.decrement;
          }
          if (data.stock && typeof data.stock.increment === 'number') {
            p.stock += data.stock.increment;
          }
          if (data.sold && typeof data.sold.increment === 'number') {
            p.sold = (p.sold || 0) + data.sold.increment;
          }
          if (data.sold && typeof data.sold.decrement === 'number') {
            p.sold = Math.max(0, (p.sold || 0) - data.sold.decrement);
          }

          currentStore.products.set(where.id, p);
          return { count: 1 };
        },
        update: async ({ where, data }) => {
          const p = currentStore.products.get(where.id);
          if (!p) throw new Error(`Product ${where.id} not found`);

          if (data.stock && typeof data.stock.increment === 'number') {
            p.stock = (p.stock || 0) + data.stock.increment;
          }
          if (data.sold && typeof data.sold.decrement === 'number') {
            p.sold = Math.max(0, (p.sold || 0) - data.sold.decrement);
          }
          if (data.sold && typeof data.sold.increment === 'number') {
            p.sold = (p.sold || 0) + data.sold.increment;
          }

          currentStore.products.set(where.id, p);
          return { ...p };
        },
      },

      productSize: {
        findMany: async ({ where }) => {
          return Array.from(currentStore.productSizes.values())
            .filter((ps) => ps.productId === where.productId)
            .map((ps) => ({ ...ps }));
        },
        updateMany: async ({ where, data }) => {
          const ps = currentStore.productSizes.get(where.id);
          if (!ps) return { count: 0 };

          if (where.stock && typeof where.stock.gte === 'number') {
            if ((ps.stock || 0) < where.stock.gte) {
              return { count: 0 };
            }
          }

          if (data.stock && typeof data.stock.decrement === 'number') {
            ps.stock -= data.stock.decrement;
          }
          if (data.stock && typeof data.stock.increment === 'number') {
            ps.stock += data.stock.increment;
          }

          currentStore.productSizes.set(where.id, ps);
          return { count: 1 };
        },
        update: async ({ where, data }) => {
          const ps = currentStore.productSizes.get(where.id);
          if (!ps) throw new Error(`ProductSize ${where.id} not found`);
          if (data.stock && typeof data.stock.increment === 'number') {
            ps.stock = (ps.stock || 0) + data.stock.increment;
          }
          currentStore.productSizes.set(where.id, ps);
          return { ...ps };
        },
      },

      order: {
        create: async ({ data }) => {
          const id = data.id || `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const rec = { id, ...data, createdAt: new Date() };
          currentStore.orders.set(id, rec);
          return { ...rec };
        },
        update: async ({ where, data }) => {
          const rec = currentStore.orders.get(where.id);
          if (!rec) throw new Error(`Order ${where.id} not found`);
          const updated = { ...rec, ...data, updatedAt: new Date() };
          currentStore.orders.set(where.id, updated);
          return { ...updated };
        },
        findUnique: async ({ where }) => {
          const rec = currentStore.orders.get(where.id);
          return rec ? { ...rec } : null;
        },
        findFirst: async ({ where }) => {
          for (const ord of currentStore.orders.values()) {
            let match = true;
            if (where.id && ord.id !== where.id) match = false;
            if (where.userId && ord.userId !== where.userId) match = false;
            if (where.razorpayPaymentId && ord.razorpayPaymentId !== where.razorpayPaymentId) match = false;
            if (match) return { ...ord };
          }
          return null;
        },
        delete: async ({ where }) => {
          const rec = currentStore.orders.get(where.id);
          currentStore.orders.delete(where.id);
          return rec ? { ...rec } : null;
        },
      },

      orderItem: {
        create: async ({ data }) => {
          const id = `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const rec = { id, ...data };
          currentStore.orderItems.set(id, rec);
          return { ...rec };
        },
        findMany: async ({ where }) => {
          return Array.from(currentStore.orderItems.values())
            .filter((item) => item.orderId === where.orderId)
            .map((item) => ({ ...item }));
        },
        deleteMany: async ({ where }) => {
          let count = 0;
          for (const [id, item] of currentStore.orderItems.entries()) {
            if (item.orderId === where.orderId) {
              currentStore.orderItems.delete(id);
              count++;
            }
          }
          return { count };
        },
      },

      cartItem: {
        deleteMany: async ({ where }) => {
          let count = 0;
          for (const [id, item] of currentStore.cartItems.entries()) {
            if (item.userId === where.userId) {
              currentStore.cartItems.delete(id);
              count++;
            }
          }
          return { count };
        },
        findMany: async ({ where }) => {
          return Array.from(currentStore.cartItems.values()).filter((c) => c.userId === where.userId);
        },
      },

      address: {
        findFirst: async ({ where }) => {
          for (const addr of currentStore.addresses.values()) {
            if (addr.id === where.id && addr.userId === where.userId) {
              return { ...addr };
            }
          }
          return null;
        },
      },
    };
  }

  return createClient(store);
}

async function main() {
  /* =====================================================
     1. NORMALIZATION UNIT TESTS
  ===================================================== */
  test('normalizeOrderItems extracts product_id and computes numeric price & quantity', () => {
    const items = [
      {
        productId: 'prod-123',
        quantity: 2,
        price: 499,
        selectedSize: 'M',
        selectedColor: 'Blue',
      },
    ];
    const normalized = normalizeOrderItems(items);
    assert.strictEqual(normalized.length, 1);
    assert.strictEqual(normalized[0].product_id, 'prod-123');
    assert.strictEqual(normalized[0].quantity, 2);
    assert.strictEqual(normalized[0].unit_price, 499);
    assert.strictEqual(normalized[0].selectedSize, 'M');
    assert.strictEqual(normalized[0].selectedColor, 'Blue');
  });

  test('normalizeOrderItems rejects items missing product id', () => {
    const items = [{ quantity: 1, price: 100 }];
    assert.throws(() => normalizeOrderItems(items), /missing product id/i);
  });

  test('normalizeShippingAddress sanitizes pincode, phone and formats name', () => {
    const rawAddress = {
      name: 'Teja Sainadh',
      line1: 'Near Cattle Market',
      line2: 'Main Road',
      city: 'Pithapuram',
      state: 'Andhra Pradesh',
      country: 'India',
      pincode: '533 450',
      phone: '+91 94940 38163',
      email: 'teja@example.com',
    };
    const normalized = normalizeShippingAddress(rawAddress);
    assert.strictEqual(normalized.name, 'Teja Sainadh');
    assert.strictEqual(normalized.line1, 'Near Cattle Market');
    assert.strictEqual(normalized.city, 'Pithapuram');
    assert.strictEqual(normalized.pincode, '533450');
    assert.strictEqual(normalized.phone, '919494038163');
    assert.strictEqual(normalized.email, 'teja@example.com');
  });

  /* =====================================================
     2. TRANSACTION DETECT & FALLBACK TESTS
  ===================================================== */
  await asyncTest('Transaction unsupported by database executes safe non-transactional path', async () => {
    resetTransactionSupportCache();
    const mockDb = createMockPrisma({ supportsTransactions: false });

    // Seed product
    mockDb._store.products.set('prod-cod', {
      id: 'prod-cod',
      name: 'Drip Hoodie',
      stock: 5,
      sold: 0,
    });

    const isSupported = await isTransactionSupported(mockDb);
    assert.strictEqual(isSupported, false, 'Should detect transaction unsupported');

    const result = await createOrderService(
      {
        userId: 'user-nt-1',
        items: [{ productId: 'prod-cod', quantity: 2, unitPrice: 999 }],
        paymentMethod: 'COD',
        shippingAddress: { line1: 'Street 1', city: 'City', pincode: '500001' },
      },
      { prisma: mockDb }
    );

    assert.ok(result.orderId, 'Order created in non-transactional mode');
    assert.ok(result.orderNumber.startsWith('DRIP-'));

    // Check stock decremented
    const prod = mockDb._store.products.get('prod-cod');
    assert.strictEqual(prod.stock, 3);
    assert.strictEqual(prod.sold, 2);
  });

  await asyncTest('Transaction abort after partial operations rolls back completely', async () => {
    resetTransactionSupportCache();
    const mockDb = createMockPrisma({ supportsTransactions: true });

    // Seed 1st product with stock 10, 2nd product with stock 1
    mockDb._store.products.set('p1', { id: 'p1', name: 'Product 1', stock: 10, sold: 0 });
    mockDb._store.products.set('p2', { id: 'p2', name: 'Product 2', stock: 1, sold: 0 });

    // Attempt order where 2nd product quantity (5) exceeds available (1)
    await assert.rejects(
      async () => {
        await createOrderService(
          {
            userId: 'user-tx-abort',
            items: [
              { productId: 'p1', quantity: 2, unitPrice: 100 },
              { productId: 'p2', quantity: 5, unitPrice: 200 },
            ],
            paymentMethod: 'COD',
            shippingAddress: { line1: 'Street 1' },
          },
          { prisma: mockDb }
        );
      },
      /Insufficient stock/i
    );

    // Verify 0 orders in database and stock of p1 was completely rolled back
    assert.strictEqual(mockDb._store.orders.size, 0, 'No order should exist after transaction abort');
    assert.strictEqual(mockDb._store.orderItems.size, 0, 'No order items should exist');
    assert.strictEqual(mockDb._store.products.get('p1').stock, 10, 'Product 1 stock must remain 10');
    assert.strictEqual(mockDb._store.products.get('p2').stock, 1, 'Product 2 stock must remain 1');
  });

  /* =====================================================
     3. RETRY AFTER INTERRUPTED ORDER CREATION
  ===================================================== */
  await asyncTest('Retry after an interrupted order creation succeeds cleanly', async () => {
    resetTransactionSupportCache();
    const mockDb = createMockPrisma({ supportsTransactions: true });
    mockDb._store.products.set('prod-retry', { id: 'prod-retry', name: 'Retry Tee', stock: 2, sold: 0 });

    // Attempt 1 fails because quantity exceeds stock
    await assert.rejects(
      async () => {
        await createOrderService(
          {
            userId: 'user-retry',
            items: [{ productId: 'prod-retry', quantity: 10, unitPrice: 500 }],
            paymentMethod: 'COD',
            shippingAddress: { line1: '123 St' },
          },
          { prisma: mockDb }
        );
      },
      /Insufficient stock/i
    );

    // Attempt 2 (retry with corrected quantity) succeeds cleanly
    const orderRes = await createOrderService(
      {
        userId: 'user-retry',
        items: [{ productId: 'prod-retry', quantity: 1, unitPrice: 500 }],
        paymentMethod: 'COD',
        shippingAddress: { line1: '123 St' },
      },
      { prisma: mockDb }
    );

    assert.ok(orderRes.orderId);
    assert.strictEqual(mockDb._store.products.get('prod-retry').stock, 1);
    assert.strictEqual(mockDb._store.orders.size, 1);
  });

  /* =====================================================
     4. CONCURRENCY & STOCK RESERVATION TESTS
  ===================================================== */
  await asyncTest('Concurrent requests against final unit of product stock allows only one winner', async () => {
    const mockDb = createMockPrisma();
    mockDb._store.products.set('p-last-unit', {
      id: 'p-last-unit',
      name: 'Limited Hoodie',
      stock: 1,
      sold: 0,
    });

    const product = mockDb._store.products.get('p-last-unit');

    // Run two concurrent decrements against the final unit
    const results = await Promise.allSettled([
      reserveProductStock(mockDb, product, 1),
      reserveProductStock(mockDb, product, 1),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent request must succeed');
    assert.strictEqual(rejected.length, 1, 'Exactly one concurrent request must fail');
    assert.strictEqual(rejected[0].reason.statusCode, 409, 'Failed request must return HTTP 409 Conflict');
    assert.strictEqual(mockDb._store.products.get('p-last-unit').stock, 0, 'Stock must end at 0');
    assert.strictEqual(mockDb._store.products.get('p-last-unit').sold, 1, 'Sold counter must increment once');
  });

  await asyncTest('Concurrent requests against final unit of a selected size allows only one winner', async () => {
    const mockDb = createMockPrisma();
    mockDb._store.products.set('p-size-test', { id: 'p-size-test', name: 'Tee', stock: 5 });
    mockDb._store.productSizes.set('ps-m', {
      id: 'ps-m',
      productId: 'p-size-test',
      size: 'M',
      stock: 1,
    });

    // Run two concurrent decrements against size M
    const results = await Promise.allSettled([
      reserveProductSizeStock(mockDb, 'p-size-test', 'M', 1),
      reserveProductSizeStock(mockDb, 'p-size-test', 'm', 1),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one size decrement must succeed');
    assert.strictEqual(rejected.length, 1, 'Exactly one size decrement must fail');
    assert.strictEqual(rejected[0].reason.statusCode, 409, 'Failed size decrement must return HTTP 409 Conflict');
    assert.strictEqual(mockDb._store.productSizes.get('ps-m').stock, 0, 'Size stock must end at 0');
  });

  /* =====================================================
     5. MISSING PRODUCT & INVALID SIZE TESTS
  ===================================================== */
  await asyncTest('Missing product throws 404', async () => {
    const mockDb = createMockPrisma();
    await assert.rejects(
      async () => {
        await createOrderService(
          {
            userId: 'user-missing-prod',
            items: [{ productId: 'non-existent-prod', quantity: 1, unitPrice: 100 }],
            paymentMethod: 'COD',
            shippingAddress: { line1: 'Street' },
          },
          { prisma: mockDb }
        );
      },
      (err) => err instanceof AppError && err.statusCode === 404
    );
  });

  await asyncTest('Invalid or unconfigured size selection throws 400', async () => {
    const mockDb = createMockPrisma();
    // Product has no sizes configured in productSize
    mockDb._store.products.set('p-no-sizes', { id: 'p-no-sizes', name: 'Cap', stock: 10 });

    await assert.rejects(
      async () => {
        await reserveProductSizeStock(mockDb, 'p-no-sizes', 'XL', 1);
      },
      (err) => err instanceof AppError && err.statusCode === 400 && /does not have size options/i.test(err.message)
    );

    // Product has sizes S and M, but customer requested XXL
    mockDb._store.products.set('p-with-sizes', { id: 'p-with-sizes', name: 'Shirt', stock: 10 });
    mockDb._store.productSizes.set('ps-s', { id: 'ps-s', productId: 'p-with-sizes', size: 'S', stock: 5 });
    mockDb._store.productSizes.set('ps-m', { id: 'ps-m', productId: 'p-with-sizes', size: 'M', stock: 5 });

    await assert.rejects(
      async () => {
        await reserveProductSizeStock(mockDb, 'p-with-sizes', 'XXL', 1);
      },
      (err) => err instanceof AppError && err.statusCode === 400 && /not found for product/i.test(err.message)
    );
  });

  /* =====================================================
     6. SUCCESSFUL COD ORDER & TOTALS
  ===================================================== */
  await asyncTest('Successful COD order adds COD charge (25), reserves stock, and clears cart', async () => {
    const mockDb = createMockPrisma();
    mockDb._store.products.set('p-cod', { id: 'p-cod', name: 'Jacket', stock: 4, sold: 1 });
    mockDb._store.productSizes.set('ps-cod-l', { id: 'ps-cod-l', productId: 'p-cod', size: 'L', stock: 4 });
    mockDb._store.cartItems.set('c-1', { id: 'c-1', userId: 'user-cod-1', productId: 'p-cod', quantity: 2 });

    const orderRes = await createOrderService(
      {
        userId: 'user-cod-1',
        items: [{ productId: 'p-cod', quantity: 2, unitPrice: 1000, selectedSize: 'L' }],
        paymentMethod: 'COD',
        shippingAddress: { line1: '123 Main Rd', city: 'Hyderabad', pincode: '500001' },
      },
      { prisma: mockDb }
    );

    const orderInDb = mockDb._store.orders.get(orderRes.orderId);
    assert.ok(orderInDb);
    assert.strictEqual(orderInDb.status, 'Confirmed');
    // Total: 2 * 1000 + 25 (COD fee) = 2025
    assert.strictEqual(orderInDb.totalAmount, 2025, 'Total must include 25 COD surcharge');

    // Product stock decreased
    assert.strictEqual(mockDb._store.products.get('p-cod').stock, 2);
    assert.strictEqual(mockDb._store.products.get('p-cod').sold, 3);
    assert.strictEqual(mockDb._store.productSizes.get('ps-cod-l').stock, 2);

    // Cart cleared
    assert.strictEqual(mockDb._store.cartItems.size, 0, 'Cart must be cleaned up on order success');
  });

  /* =====================================================
     7. ONLINE PAYMENT VERIFICATION & IDEMPOTENCY
  ===================================================== */
  await asyncTest('Successful payment verification confirms order, reserves stock, and cleans cart', async () => {
    const mockDb = createMockPrisma();
    mockDb._store.products.set('p-online', { id: 'p-online', name: 'Sneakers', stock: 3, sold: 0 });
    mockDb._store.productSizes.set('ps-online-9', { id: 'ps-online-9', productId: 'p-online', size: 'UK 9', stock: 3 });

    // Pending order in database (stock not yet decremented)
    const pendingOrder = {
      id: 'ord-online-100',
      orderNumber: 'DRIP-20261022-ord-online-100',
      userId: 'user-online-1',
      totalAmount: 2500,
      status: 'Pending',
      shippingAddress: JSON.stringify({ line1: '456 Tech Park', city: 'Bangalore' }),
    };
    mockDb._store.orders.set(pendingOrder.id, pendingOrder);

    mockDb._store.orderItems.set('item-100', {
      id: 'item-100',
      orderId: 'ord-online-100',
      productId: 'p-online',
      quantity: 1,
      unitPrice: 2500,
      selectedSize: 'UK 9',
    });

    mockDb._store.cartItems.set('c-online', { id: 'c-online', userId: 'user-online-1', productId: 'p-online' });

    let shiprocketCreated = false;

    const result = await verifyPaymentService(
      {
        razorpay_payment_id: 'pay_test_123',
        razorpay_order_id: 'order_rzp_123',
        razorpay_signature: 'sig_valid',
        internalOrderId: 'ord-online-100',
      },
      {
        prisma: mockDb,
        verifyPaymentSignature: () => true,
        fetchPayment: async () => ({ id: 'pay_test_123', status: 'captured', notes: { internalOrderId: 'ord-online-100' } }),
        getOrderById: async (id) => mockDb.order.findUnique({ where: { id } }),
        getOrderByPaymentId: async (pid) => mockDb.order.findFirst({ where: { razorpayPaymentId: pid } }),
        getOrderItems: async (id) => mockDb.orderItem.findMany({ where: { orderId: id } }),
        confirmPayment: async ({ orderId, paymentId, shiprocketOrderId }) => {
          return mockDb.order.update({
            where: { id: orderId },
            data: { status: 'Confirmed', razorpayPaymentId: paymentId, paymentDetails: { shiprocketOrderId } },
          });
        },
        createShiprocketOrder: async () => {
          shiprocketCreated = true;
          return { order_id: 'SR-100' };
        },
      }
    );

    assert.strictEqual(result.status, 'Confirmed');
    assert.strictEqual(result.internalOrderId, 'ord-online-100');
    assert.strictEqual(shiprocketCreated, true, 'Shiprocket order should be triggered');

    // Order status confirmed
    const updatedOrd = mockDb._store.orders.get('ord-online-100');
    assert.strictEqual(updatedOrd.status, 'Confirmed');
    assert.strictEqual(updatedOrd.razorpayPaymentId, 'pay_test_123');

    // Stock reserved once
    assert.strictEqual(mockDb._store.products.get('p-online').stock, 2);
    assert.strictEqual(mockDb._store.productSizes.get('ps-online-9').stock, 2);

    // Cart cleaned up
    assert.strictEqual(mockDb._store.cartItems.size, 0);
  });

  await asyncTest('Repeated payment verification is idempotent and does not duplicate decrements or cart deletions', async () => {
    const mockDb = createMockPrisma();
    mockDb._store.products.set('p-idem', { id: 'p-idem', name: 'Cap', stock: 5, sold: 1 });

    const confirmedOrder = {
      id: 'ord-already-confirmed',
      orderNumber: 'DRIP-20261022-ord-already-confirmed',
      userId: 'user-idem',
      totalAmount: 500,
      status: 'Confirmed',
      razorpayPaymentId: 'pay_idem_999',
      paymentDetails: { shiprocketOrderId: 'SR-999' },
    };
    mockDb._store.orders.set(confirmedOrder.id, confirmedOrder);

    let shiprocketCallCount = 0;

    const result = await verifyPaymentService(
      {
        razorpay_payment_id: 'pay_idem_999',
        razorpay_order_id: 'order_rzp_999',
        razorpay_signature: 'sig_valid',
        internalOrderId: 'ord-already-confirmed',
      },
      {
        prisma: mockDb,
        verifyPaymentSignature: () => true,
        fetchPayment: async () => ({ id: 'pay_idem_999', status: 'captured' }),
        getOrderById: async (id) => mockDb.order.findUnique({ where: { id } }),
        getOrderByPaymentId: async (pid) => mockDb.order.findFirst({ where: { razorpayPaymentId: pid } }),
        getOrderItems: async (id) => mockDb.orderItem.findMany({ where: { orderId: id } }),
        confirmPayment: async () => assert.fail('confirmPayment should not be called again on retry'),
        createShiprocketOrder: async () => {
          shiprocketCallCount++;
          return { order_id: 'SR-DUP' };
        },
      }
    );

    assert.strictEqual(result.alreadyProcessed, true, 'Must identify order as alreadyProcessed');
    assert.strictEqual(result.status, 'Confirmed');
    assert.strictEqual(shiprocketCallCount, 0, 'Shiprocket must not be re-invoked on retry');
    assert.strictEqual(mockDb._store.products.get('p-idem').stock, 5, 'Stock must not be decremented again');
  });

  /* =====================================================
     8. CAPTURED PAYMENT WITH INVENTORY RECONCILIATION
  ===================================================== */
  await asyncTest('Captured payment with inventory allocation failure records reconciliation state without failing client payment', async () => {
    const mockDb = createMockPrisma();
    // Stock is 0 because someone else bought the last item between checkout start and payment completion
    mockDb._store.products.set('p-exhausted', { id: 'p-exhausted', name: 'Rare Tee', stock: 0, sold: 5 });

    const pendingOrder = {
      id: 'ord-exhausted',
      orderNumber: 'DRIP-20261022-ord-exhausted',
      userId: 'user-unlucky',
      totalAmount: 1200,
      status: 'Pending',
    };
    mockDb._store.orders.set(pendingOrder.id, pendingOrder);

    mockDb._store.orderItems.set('item-ex', {
      id: 'item-ex',
      orderId: 'ord-exhausted',
      productId: 'p-exhausted',
      quantity: 1,
      unitPrice: 1200,
    });

    const result = await verifyPaymentService(
      {
        razorpay_payment_id: 'pay_captured_but_out_of_stock',
        razorpay_order_id: 'order_rzp_ex',
        razorpay_signature: 'sig_valid',
        internalOrderId: 'ord-exhausted',
      },
      {
        prisma: mockDb,
        verifyPaymentSignature: () => true,
        fetchPayment: async () => ({ id: 'pay_captured_but_out_of_stock', status: 'captured' }),
        getOrderById: async (id) => mockDb.order.findUnique({ where: { id } }),
        getOrderByPaymentId: async (pid) => mockDb.order.findFirst({ where: { razorpayPaymentId: pid } }),
        getOrderItems: async (id) => mockDb.orderItem.findMany({ where: { orderId: id } }),
      }
    );

    assert.strictEqual(result.status, 'NeedsReconciliation');
    assert.strictEqual(result.reconciliationRequired, true);

    const ord = mockDb._store.orders.get('ord-exhausted');
    assert.strictEqual(ord.status, 'NeedsReconciliation');
    assert.strictEqual(ord.razorpayPaymentId, 'pay_captured_but_out_of_stock', 'Must record payment id');
    assert.strictEqual(ord.paymentDetails.reconciliationRequired, true);
    assert.ok(ord.paymentDetails.inventoryError, 'Must record inventory error details');
  });

  /* =====================================================
     9. CART CLEANUP INTEGRITY TEST
  ===================================================== */
  await asyncTest('Cart cleanup only occurs on successful order and is preserved on failure', async () => {
    const mockDb = createMockPrisma();
    mockDb._store.cartItems.set('cart-u1', { id: 'cart-u1', userId: 'user-persist-cart', productId: 'p1' });

    // Trigger failure by requesting an invalid quantity
    await assert.rejects(
      async () => {
        await createOrderService(
          {
            userId: 'user-persist-cart',
            items: [{ productId: 'p1', quantity: 0, unitPrice: 100 }],
            paymentMethod: 'COD',
            shippingAddress: { line1: 'Street' },
          },
          { prisma: mockDb }
        );
      },
      /Invalid quantity/i
    );

    // Cart items must still be intact
    assert.strictEqual(mockDb._store.cartItems.size, 1, 'Cart items must not be deleted when order fails');
  });

  /* =====================================================
     10. NON-TRANSACTIONAL COMPENSATING ROLLBACK TEST
  ===================================================== */
  await asyncTest('Non-transactional mode compensating rollback recovers stock and removes partial order on mid-stream failure', async () => {
    resetTransactionSupportCache();
    const mockDb = createMockPrisma({ supportsTransactions: false });

    // Item 1 has stock 5, Item 2 has size that does not exist
    mockDb._store.products.set('p-comp-1', { id: 'p-comp-1', name: 'Item 1', stock: 5, sold: 0 });
    mockDb._store.products.set('p-comp-2', { id: 'p-comp-2', name: 'Item 2', stock: 5, sold: 0 });
    mockDb._store.productSizes.set('ps-valid', { id: 'ps-valid', productId: 'p-comp-1', size: 'M', stock: 5 });
    // Item 2 has NO sizes seeded, but order requests size 'L' -> fails during line item processing!

    await assert.rejects(
      async () => {
        await createOrderService(
          {
            userId: 'user-comp-test',
            items: [
              { productId: 'p-comp-1', quantity: 2, unitPrice: 100, selectedSize: 'M' },
              { productId: 'p-comp-2', quantity: 1, unitPrice: 100, selectedSize: 'L' },
            ],
            paymentMethod: 'COD',
            shippingAddress: { line1: 'Street' },
          },
          { prisma: mockDb }
        );
      },
      /does not have size options configured/i
    );

    // Verification: compensating rollback should have deleted the partial order and restored stock of Item 1
    assert.strictEqual(mockDb._store.orders.size, 0, 'Partial order must be rolled back');
    assert.strictEqual(mockDb._store.orderItems.size, 0, 'Partial order items must be rolled back');
    assert.strictEqual(mockDb._store.products.get('p-comp-1').stock, 5, 'Product 1 stock must be restored to 5');
    assert.strictEqual(mockDb._store.productSizes.get('ps-valid').stock, 5, 'Size stock must be restored to 5');
  });

  console.log(`\n========================================`);
  console.log(`Test Summary: ${passedTests}/${totalTests} tests passed`);
  console.log(`========================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
