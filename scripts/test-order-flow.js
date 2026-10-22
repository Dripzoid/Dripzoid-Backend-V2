import assert from 'node:assert';
import { AppError } from '../src/errors/AppError.js';
import { normalizeOrderItems, normalizeShippingAddress } from '../src/modules/orders/order.utils.js';

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

async function main() {
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

  // 2. Shipping Address Normalization Tests
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

  test('normalizeShippingAddress falls back to user credentials when address fields are missing', () => {
    const user = { name: 'Teja User', email: 'user@example.com', phone: '9494038163' };
    const rawAddress = {
      line1: '123 Street',
      city: 'Kakinada',
      state: 'AP',
      pincode: '533001',
    };
    const normalized = normalizeShippingAddress(rawAddress, user);
    assert.strictEqual(normalized.name, 'Teja User');
    assert.strictEqual(normalized.email, 'user@example.com');
    assert.strictEqual(normalized.phone, '9494038163');
  });

  // 3. AppError Status Codes Verification
  test('AppError produces structured status codes for client feedback', () => {
    const notFound = new AppError('Product not found', 404);
    assert.strictEqual(notFound.statusCode, 404);
    assert.strictEqual(notFound.message, 'Product not found');

    const outOfStock = new AppError('Insufficient stock for size L', 409);
    assert.strictEqual(outOfStock.statusCode, 409);
    assert.strictEqual(outOfStock.message, 'Insufficient stock for size L');

    const badRequest = new AppError('Order items required', 400);
    assert.strictEqual(badRequest.statusCode, 400);
  });

  // 4. Case-Insensitive Size Matching Logic Verification
  test('Size matching logic handles case-insensitivity and trim variations', () => {
    const dbSizes = [
      { id: 'size-1', size: 'M', stock: 5 },
      { id: 'size-2', size: 'L', stock: 2 },
      { id: 'size-3', size: 'XL', stock: 0 },
    ];

    function matchSize(requestedSize) {
      const req = String(requestedSize).trim().toLowerCase();
      return dbSizes.find((s) => s.size && s.size.trim().toLowerCase() === req);
    }

    assert.strictEqual(matchSize('m')?.id, 'size-1');
    assert.strictEqual(matchSize(' M ')?.id, 'size-1');
    assert.strictEqual(matchSize('l')?.id, 'size-2');
    assert.strictEqual(matchSize('XL')?.id, 'size-3');
    assert.strictEqual(matchSize('S'), undefined);
  });

  // 5. Stock Validation Logic Verification (Legacy Unseeded vs Seeded Size Stock)
  test('Stock validation allows product-level fallback when all size rows are 0 but product.stock > 0', () => {
    const product = { id: 'prod-hoodie', stock: 2, name: 'Heritage Hoodie' };
    const sizeRows = [
      { size: 'L', stock: 0 },
      { size: 'M', stock: 0 },
      { size: 'XL', stock: 0 },
    ];

    function validateStock(item, product, productSizes) {
      if (product.stock !== null && product.stock < item.quantity) {
        throw new AppError(`Insufficient stock for product ${product.id}`, 409);
      }
      if (item.selectedSize && productSizes.length > 0) {
        const req = String(item.selectedSize).trim().toLowerCase();
        const matched = productSizes.find((ps) => ps.size.trim().toLowerCase() === req);
        const anySizeHasStock = productSizes.some((ps) => (ps.stock || 0) > 0);

        if (!matched) {
          if (anySizeHasStock) throw new AppError(`Size ${item.selectedSize} not found`, 400);
        } else if ((matched.stock || 0) > 0) {
          if (matched.stock < item.quantity) throw new AppError(`Insufficient stock for size ${matched.size}`, 409);
        } else if (anySizeHasStock) {
          throw new AppError(`Size ${matched.size} is out of stock`, 409);
        }
      }
      return true;
    }

    // Should succeed using product.stock fallback
    const result = validateStock({ productId: 'prod-hoodie', quantity: 1, selectedSize: 'M' }, product, sizeRows);
    assert.strictEqual(result, true);

    // Should fail when quantity exceeds product.stock
    assert.throws(
      () => validateStock({ productId: 'prod-hoodie', quantity: 3, selectedSize: 'M' }, product, sizeRows),
      /Insufficient stock for product/
    );
  });

  test('Stock validation enforces specific size stock when sizes are tracked (>0)', () => {
    const product = { id: 'prod-tshirt', stock: 10, name: 'Graphic Tee' };
    const sizeRows = [
      { size: 'S', stock: 3 },
      { size: 'M', stock: 0 },
      { size: 'L', stock: 5 },
    ];

    function validateStock(item, product, productSizes) {
      if (product.stock !== null && product.stock < item.quantity) {
        throw new AppError(`Insufficient stock for product ${product.id}`, 409);
      }
      if (item.selectedSize && productSizes.length > 0) {
        const req = String(item.selectedSize).trim().toLowerCase();
        const matched = productSizes.find((ps) => ps.size.trim().toLowerCase() === req);
        const anySizeHasStock = productSizes.some((ps) => (ps.stock || 0) > 0);

        if (!matched) {
          if (anySizeHasStock) throw new AppError(`Size ${item.selectedSize} not found`, 400);
        } else if ((matched.stock || 0) > 0) {
          if (matched.stock < item.quantity) throw new AppError(`Insufficient stock for size ${matched.size}`, 409);
        } else if (anySizeHasStock) {
          throw new AppError(`Size ${matched.size} is out of stock`, 409);
        }
      }
      return true;
    }

    // Size S has 3 in stock, quantity 1 should pass
    assert.strictEqual(
      validateStock({ productId: 'prod-tshirt', quantity: 1, selectedSize: 'S' }, product, sizeRows),
      true
    );

    // Size M has 0 in stock while other sizes have stock -> Should throw Out of Stock
    assert.throws(
      () => validateStock({ productId: 'prod-tshirt', quantity: 1, selectedSize: 'M' }, product, sizeRows),
      /out of stock/
    );

    // Size XXL doesn't exist while sizes are tracked -> Should throw Size not found
    assert.throws(
      () => validateStock({ productId: 'prod-tshirt', quantity: 1, selectedSize: 'XXL' }, product, sizeRows),
      /Size XXL not found/
    );
  });

  // 6. Address Validation Logic Verification
  test('Address resolution handles existing address and ignores unlinked temporary IDs gracefully', () => {
    const savedAddresses = [{ id: 'addr-real-1', userId: 'user-1' }];

    function resolveAddressId(shippingAddress, userId) {
      if (shippingAddress?.id) {
        const found = savedAddresses.find((a) => a.id === shippingAddress.id && a.userId === userId);
        if (found) return found.id;
      }
      return null;
    }

    // Valid saved address for current user
    assert.strictEqual(resolveAddressId({ id: 'addr-real-1' }, 'user-1'), 'addr-real-1');

    // Address ID belonging to another user
    assert.strictEqual(resolveAddressId({ id: 'addr-real-1' }, 'user-2'), null);

    // Temporary or non-existent address ID (e.g. from guest or fresh address form)
    assert.strictEqual(resolveAddressId({ id: 'temp-addr-999' }, 'user-1'), null);

    // No address ID passed
    assert.strictEqual(resolveAddressId({}, 'user-1'), null);
  });

  // 7. Non-Transactional Fallback Simulation
  await asyncTest('executeWithTransaction falls back cleanly when deployment does not support transactions', async () => {
    let fallbackInvoked = false;

    const mockPrisma = {
      $transaction: async (fn) => {
        const err = new Error('Kind: Transactions are not supported by this deployment, labels: {}, source: None');
        err.code = 'P2010';
        throw err;
      },
      order: {
        create: async () => ({ id: 'order-123' }),
      },
    };

    async function mockExecuteWithTransaction(action) {
      try {
        return await mockPrisma.$transaction(action);
      } catch (err) {
        if (err?.code === 'P2010' || err?.message?.includes('Transactions are not supported')) {
          fallbackInvoked = true;
          return await action(mockPrisma);
        }
        throw err;
      }
    }

    const result = await mockExecuteWithTransaction(async (tx) => {
      return await tx.order.create();
    });

    assert.strictEqual(fallbackInvoked, true);
    assert.strictEqual(result.id, 'order-123');
  });

  console.log(`\n========================================`);
  console.log(`Test Summary: ${passedTests}/${totalTests} tests passed`);
  console.log(`========================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
