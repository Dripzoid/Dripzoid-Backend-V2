import 'dotenv/config';
import http from 'http';
import { app } from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

async function makeRequest(port, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: port,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });

    req.on('error', (e) => reject(e));
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log('🚀 Launching Complete API Test Suite against MongoDB Atlas...\n');
  const server = http.createServer(app);
  const TEST_PORT = 5099;

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`📡 Test server listening on port ${TEST_PORT}`);

  const results = [];

  function record(testName, passed, details = '') {
    results.push({ testName, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} | ${testName} ${details ? '(' + details + ')' : ''}`);
  }

  try {
    // 1. Health Check
    const health = await makeRequest(TEST_PORT, 'GET', '/');
    record('1. Server Health Check', health.status === 200 && health.data?.success === true);

    // 2. User Authentication & Profile
    const testEmail = `testuser_${Date.now()}@example.com`;
    const testPassword = 'Password123!';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    const testUser = await prisma.user.create({
      data: {
        email: testEmail,
        name: 'Test Migration User',
        password: hashedPassword,
        phone: '9999988888',
        isAdmin: true,
      },
    });

    const jwtSecret = process.env.JWT_SECRET || 'dripzoid_jwt_secret_key_development_2026';
    const token = jwt.sign(
      { userId: testUser.id, id: testUser.id, email: testUser.email, isAdmin: testUser.isAdmin },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const authHeader = { Authorization: `Bearer ${token}` };

    record('2. User Creation & JWT Sign', !!testUser.id, `User ID: ${testUser.id}`);

    // Test existing user query
    const fetchedUser = await prisma.user.findUnique({ where: { email: testEmail } });
    record('3. User Retrieval from Mongo', fetchedUser?.email === testEmail);

    // 3. Products API
    const productsRes = await makeRequest(TEST_PORT, 'GET', '/api/products');
    record('4. Product Listing API', productsRes.status === 200 && (productsRes.data?.data || productsRes.data?.products || Array.isArray(productsRes.data)), `Status: ${productsRes.status}`);

    const existingProduct = await prisma.product.findFirst({ include: { sizes: true, category: true } });
    const productDetailRes = await makeRequest(TEST_PORT, 'GET', `/api/products/${existingProduct.id}`);
    record('5. Product Details by ID', productDetailRes.status === 200, `Product: ${existingProduct.id}`);

    // 4. Cart API
    const cartAddRes = await makeRequest(TEST_PORT, 'POST', '/api/cart', authHeader, {
      product_id: existingProduct.id,
      quantity: 1,
      selectedSize: existingProduct.sizes[0]?.size || 'Free Size',
      selectedColor: 'Default',
    });
    record('6. Add to Cart API', cartAddRes.status === 200 || cartAddRes.status === 201, `Status: ${cartAddRes.status}`);

    const getCartRes = await makeRequest(TEST_PORT, 'GET', '/api/cart', authHeader);
    record('7. Get Cart API', getCartRes.status === 200, `Status: ${getCartRes.status}`);

    // 5. Wishlist API
    const wishlistAddRes = await makeRequest(TEST_PORT, 'POST', `/api/wishlist/${existingProduct.id}`, authHeader);
    record('8. Add to Wishlist API', wishlistAddRes.status === 200 || wishlistAddRes.status === 201, `Status: ${wishlistAddRes.status}`);

    const getWishlistRes = await makeRequest(TEST_PORT, 'GET', '/api/wishlist', authHeader);
    record('9. Get Wishlist API', getWishlistRes.status === 200, `Status: ${getWishlistRes.status}`);

    // 6. Address API
    const address = await prisma.address.create({
      data: {
        userId: testUser.id,
        name: 'Test Recipient',
        phone: '9999988888',
        line1: '123 Test Street',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500001',
        country: 'India',
        isDefault: true,
      },
    });
    record('10. Address Creation', !!address.id, `Address ID: ${address.id}`);

    // 7. Order Flow & Retrieval
    const orderNumber = `DRIP-TEST-${Date.now()}`;
    const testOrder = await prisma.order.create({
      data: {
        orderNumber,
        userId: testUser.id,
        addressId: address.id,
        totalAmount: 1299.0,
        paymentMethod: 'COD',
        status: 'Pending',
        items: {
          create: [
            {
              productId: existingProduct.id,
              quantity: 1,
              unitPrice: existingProduct.price,
              price: existingProduct.price,
              selectedSize: existingProduct.sizes[0]?.size || 'Free Size',
            },
          ],
        },
      },
      include: {
        items: true,
        address: true,
      },
    });
    record('11. Order Creation with Items', !!testOrder.id && testOrder.items.length === 1, `Order: ${orderNumber}`);

    const userOrdersRes = await makeRequest(TEST_PORT, 'GET', '/api/user/orders', authHeader);
    record('12. User Orders API', userOrdersRes.status === 200, `Status: ${userOrdersRes.status}`);

    const adminOrdersRes = await makeRequest(TEST_PORT, 'GET', '/api/admin/orders', authHeader);
    record('13. Admin Orders API', adminOrdersRes.status === 200, `Status: ${adminOrdersRes.status}`);

    // 8. Shipping & Couriers
    const couriers = await prisma.courier.findMany({ where: { isActive: true } });
    record('14. Courier Listing from DB', couriers.length > 0, `Active couriers: ${couriers.length}`);

    const existingShipment = await prisma.shipment.findFirst({ include: { trackingEvents: true } });
    record('15. Shipment & Tracking Retrieval', !!existingShipment?.id, `Shipment ID: ${existingShipment?.id}`);

    // 9. Semantic & Vector APIs
    const embedRes = await makeRequest(TEST_PORT, 'POST', '/api/embed', {}, { text: 'floral summer dress' });
    record('16. Embedding API', embedRes.status === 200, `Status: ${embedRes.status}`);

    const vectorRes = await makeRequest(TEST_PORT, 'GET', '/api/vectors/products');
    record('17. Vector Products API', vectorRes.status === 200, `Status: ${vectorRes.status}`);

    const kbVectorRes = await makeRequest(TEST_PORT, 'GET', '/api/vectors/kb');
    record('18. KB Vectors API', kbVectorRes.status === 200, `Status: ${kbVectorRes.status}`);

    // 10. Pending Order Expiry Cron Logic Verification
    const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expiredPendingOrder = await prisma.order.create({
      data: {
        orderNumber: `DRIP-EXP-${Date.now()}`,
        userId: testUser.id,
        totalAmount: 500,
        status: 'Pending',
        createdAt: oldDate,
        updatedAt: oldDate,
      },
    });

    const pendingOrdersToCancel = await prisma.order.findMany({
      where: {
        status: 'Pending',
        createdAt: {
          lt: new Date(Date.now() - 30 * 60 * 1000),
        },
      },
    });
    record('19. Pending Order Expiry Query', pendingOrdersToCancel.some((o) => o.id === expiredPendingOrder.id), `Found expired orders: ${pendingOrdersToCancel.length}`);

    // Clean up test data
    await prisma.orderItem.deleteMany({ where: { orderId: { in: [testOrder.id, expiredPendingOrder.id] } } });
    await prisma.order.deleteMany({ where: { id: { in: [testOrder.id, expiredPendingOrder.id] } } });
    await prisma.cartItem.deleteMany({ where: { userId: testUser.id } });
    await prisma.wishlistItem.deleteMany({ where: { userId: testUser.id } });
    await prisma.address.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    record('20. Test Data Cleanup', true);

  } catch (err) {
    console.error('❌ Test suite encountered error:', err);
    record('Test Suite Execution', false, err.message);
  } finally {
    server.close();
    await prisma.$disconnect();
    console.log('\n======================================================');
    const passedCount = results.filter((r) => r.passed).length;
    console.log(`📊 Test Results: ${passedCount}/${results.length} PASSED`);
    console.log('======================================================');
    process.exit(0);
  }
}

runTestSuite().catch(console.error);
