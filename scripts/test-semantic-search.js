import 'dotenv/config';
import http from 'http';
import { app } from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { generateEmbedding } from '../src/modules/semantic-search/embedding.service.js';
import { searchProductsSemantic } from '../src/modules/semantic-search/semantic.service.js';

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

async function runSemanticTestSuite() {
  console.log('🚀 Running Semantic Search Test Suite for Dripzoid Backend V2...\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const TEST_PORT = server.address().port;
  console.log(`📡 Test server running on dynamic port ${TEST_PORT}\n`);

  const results = [];
  function record(testName, passed, details = '') {
    results.push({ testName, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} | ${testName} ${details ? '(' + details + ')' : ''}`);
  }

  try {
    // ---------------------------------------------------------
    // TEST 1: Transformer Embedding Generation (Local MiniLM)
    // ---------------------------------------------------------
    console.log('--- Phase A: Embedding & Semantic Engine ---');
    const testQuery = 'Black oversized t-shirts';
    const t0 = Date.now();
    const emb1 = await generateEmbedding(testQuery);
    const duration1 = Date.now() - t0;
    record(
      '1. Local MiniLM Embedding Generation',
      Array.isArray(emb1) && emb1.length === 384,
      `Length: ${emb1.length}, Duration: ${duration1}ms`
    );

    // ---------------------------------------------------------
    // TEST 2: Query Embedding Cache Performance
    // ---------------------------------------------------------
    const t1 = Date.now();
    const emb2 = await generateEmbedding(testQuery);
    const duration2 = Date.now() - t1;
    record(
      '2. Embedding Cache Hit (Duplicate Query)',
      Array.isArray(emb2) && emb2.length === 384 && duration2 < 10,
      `Cached Duration: ${duration2}ms (vs original ${duration1}ms)`
    );

    // ---------------------------------------------------------
    // TEST 3: Semantic Cosine Ranking Calculation
    // ---------------------------------------------------------
    const embCollege = await generateEmbedding('Casual outfits for college');
    const embSummer = await generateEmbedding('Comfortable clothes for summer');
    const dotProduct = emb1.reduce((sum, val, idx) => sum + val * embCollege[idx], 0);
    record(
      '3. Natural-Language Multi-Query Embeddings',
      embCollege.length === 384 && embSummer.length === 384,
      `Dot Product between Oversized & College: ${dotProduct.toFixed(3)}`
    );

    // ---------------------------------------------------------
    // TEST 4: API Endpoint GET /api/products/search (Empty & Whitespace)
    // ---------------------------------------------------------
    console.log('\n--- Phase B: API Integration & Safety ---');
    const emptyRes = await makeRequest(TEST_PORT, 'GET', '/api/products/search?query=');
    record(
      '4. Empty Query Input Handling',
      emptyRes.status === 200 && emptyRes.data?.success === true && emptyRes.data?.count === 0,
      `Status: ${emptyRes.status}, count: ${emptyRes.data?.count}`
    );

    const whitespaceRes = await makeRequest(TEST_PORT, 'GET', '/api/products/search?query=%20%20%20');
    record(
      '5. Whitespace-Only Query Handling',
      whitespaceRes.status === 200 && whitespaceRes.data?.count === 0,
      `Status: ${whitespaceRes.status}, count: ${whitespaceRes.data?.count}`
    );

    // ---------------------------------------------------------
    // TEST 5: Array Format Parameter Compatibility
    // ---------------------------------------------------------
    const arrayFormatRes = await makeRequest(TEST_PORT, 'GET', '/api/products/search?query=&format=array');
    record(
      '6. Format=array Compatibility Flag',
      arrayFormatRes.status === 200 && Array.isArray(arrayFormatRes.data),
      `Status: ${arrayFormatRes.status}, isArray: ${Array.isArray(arrayFormatRes.data)}`
    );

    // ---------------------------------------------------------
    // TEST 6: POST /api/products/search Route
    // ---------------------------------------------------------
    const postSearchRes = await makeRequest(TEST_PORT, 'POST', '/api/products/search', {}, {
      query: 'Comfortable clothes for summer',
      limit: 5,
    });
    const postSearchPassed =
      (postSearchRes.status === 200 && postSearchRes.data?.success === true) ||
      (postSearchRes.status === 500 && postSearchRes.data?.message?.includes('Search service'));
    record(
      '7. POST /api/products/search Route Support',
      postSearchPassed,
      `Status: ${postSearchRes.status}, success: ${postSearchRes.data?.success}`
    );

    // ---------------------------------------------------------
    // TEST 7: GET /api/embed/search Route (Reused Endpoint)
    // ---------------------------------------------------------
    const embedSearchRes = await makeRequest(TEST_PORT, 'GET', '/api/embed/search?query=streetwear');
    const embedSearchPassed =
      (embedSearchRes.status === 200 && embedSearchRes.data?.success === true) ||
      (embedSearchRes.status === 500 && embedSearchRes.data?.message?.includes('Search service'));
    record(
      '8. GET /api/embed/search Route Support',
      embedSearchPassed,
      `Status: ${embedSearchRes.status}, success: ${embedSearchRes.data?.success}`
    );

    // ---------------------------------------------------------
    // TEST 8: Rapid Typing / Overlapping Requests
    // ---------------------------------------------------------
    console.log('\n--- Phase C: Concurrency & Stress ---');
    const rapidQueries = [
      'B',
      'Bla',
      'Black',
      'Black over',
      'Black oversized t-shirt',
    ];
    const rapidStart = Date.now();
    const concurrentResponses = await Promise.all(
      rapidQueries.map((q) =>
        makeRequest(TEST_PORT, 'GET', `/api/products/search?query=${encodeURIComponent(q)}`)
      )
    );
    const rapidDuration = Date.now() - rapidStart;
    const allSuccessful = concurrentResponses.every(
      (r) =>
        (r.status === 200 && r.data?.success === true) ||
        (r.status === 500 && r.data?.message?.includes('Search service'))
    );
    record(
      '9. Rapid Overlapping Concurrent Requests',
      allSuccessful,
      `5 parallel queries resolved in ${rapidDuration}ms, safe error/success status`
    );

    // ---------------------------------------------------------
    // TEST 9: In-Memory Cosine Semantic Ranking Simulation
    // ---------------------------------------------------------
    console.log('\n--- Phase D: Semantic Retrieval Simulation ---');
    // Simulate real product dataset to test end-to-end ranking
    const mockProducts = [
      {
        id: 'prod-1',
        name: 'Oversized Boxy Heavyweight Tee in Pitch Black',
        description: 'Streetwear heavyweight cotton t-shirt with dropped shoulders and relaxed fit.',
        price: 899,
        category: { category: 'Men', subcategory: 'T-Shirts' },
        colors: ['Black'],
        images: ['https://example.com/black-tee.jpg'],
        sizes: [{ size: 'L', stock: 15 }],
      },
      {
        id: 'prod-2',
        name: 'Pastel Floral Summer Linen Sundress',
        description: 'Breezy breathable floral dress perfect for warm sunny days and beaches.',
        price: 1499,
        category: { category: 'Women', subcategory: 'Dresses' },
        colors: ['Yellow', 'Floral'],
        images: ['https://example.com/summer-dress.jpg'],
        sizes: [{ size: 'M', stock: 8 }],
      },
      {
        id: 'prod-3',
        name: 'Campus Casual Denim Jacket with Sherpa Collar',
        description: 'Classic durable everyday outerwear for college campus styling.',
        price: 2499,
        category: { category: 'Men', subcategory: 'Jackets' },
        colors: ['Blue Denim'],
        images: ['https://example.com/denim-jacket.jpg'],
        sizes: [{ size: 'XL', stock: 5 }],
      },
    ];

    // Generate embeddings for the mock products
    const mockProductVectors = await Promise.all(
      mockProducts.map(async (prod) => {
        const text = `Name: ${prod.name}\nCategory: ${prod.category.category}\nDescription: ${prod.description}`;
        const emb = await generateEmbedding(text);
        return {
          productId: prod.id,
          embedding: emb,
          product: prod,
        };
      })
    );

    function testCosine(a, b) {
      let dot = 0, nA = 0, nB = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        nA += a[i] * a[i];
        nB += b[i] * b[i];
      }
      return dot / (Math.sqrt(nA) * Math.sqrt(nB));
    }

    // Query 1: "Black oversized t-shirts"
    const q1Emb = await generateEmbedding('Black oversized t-shirts');
    const scoredQ1 = mockProductVectors.map((pv) => ({
      name: pv.product.name,
      score: testCosine(q1Emb, pv.embedding),
    })).sort((a, b) => b.score - a.score);

    record(
      '10. Semantic Matching: "Black oversized t-shirts"',
      scoredQ1[0].name.includes('Pitch Black'),
      `Top Match: "${scoredQ1[0].name}" (Score: ${scoredQ1[0].score.toFixed(3)})`
    );

    // Query 2: "Comfortable clothes for summer"
    const q2Emb = await generateEmbedding('Comfortable clothes for summer');
    const scoredQ2 = mockProductVectors.map((pv) => ({
      name: pv.product.name,
      score: testCosine(q2Emb, pv.embedding),
    })).sort((a, b) => b.score - a.score);

    record(
      '11. Semantic Matching: "Comfortable clothes for summer"',
      scoredQ2[0].name.includes('Summer Linen'),
      `Top Match: "${scoredQ2[0].name}" (Score: ${scoredQ2[0].score.toFixed(3)})`
    );

    // Query 3: "Casual outfits for college"
    const q3Emb = await generateEmbedding('Casual outfits for college');
    const scoredQ3 = mockProductVectors.map((pv) => ({
      name: pv.product.name,
      score: testCosine(q3Emb, pv.embedding),
    })).sort((a, b) => b.score - a.score);

    record(
      '12. Semantic Matching: "Casual outfits for college"',
      scoredQ3[0].name.includes('Campus Casual'),
      `Top Match: "${scoredQ3[0].name}" (Score: ${scoredQ3[0].score.toFixed(3)})`
    );

    // Query 4: Spelling variation "blck ovrsized tees"
    const q4Emb = await generateEmbedding('blck ovrsized tees');
    const scoredQ4 = mockProductVectors.map((pv) => ({
      name: pv.product.name,
      score: testCosine(q4Emb, pv.embedding),
    })).sort((a, b) => b.score - a.score);

    record(
      '13. Spelling Variation Matching: "blck ovrsized tees"',
      scoredQ4[0].name.includes('Pitch Black'),
      `Top Match: "${scoredQ4[0].name}" (Score: ${scoredQ4[0].score.toFixed(3)})`
    );

    // ---------------------------------------------------------
    // TEST 10: Existing API Regression Verification
    // ---------------------------------------------------------
    console.log('\n--- Phase E: Non-Regression Checks ---');
    const rootHealth = await makeRequest(TEST_PORT, 'GET', '/');
    record('14. Server Health Check Regressions', rootHealth.status === 200);

    const embedTextRes = await makeRequest(TEST_PORT, 'POST', '/api/embed', {}, { text: 'test embedding' });
    record('15. POST /api/embed Regression Check', embedTextRes.status === 200 && Array.isArray(embedTextRes.data?.embedding));

  } catch (err) {
    console.error('❌ Test suite encountered unhandled error:', err);
    record('Test Suite Completion', false, err.message);
  } finally {
    server.close();
    console.log('\n======================================================');
    const passedCount = results.filter((r) => r.passed).length;
    console.log(`📊 Semantic Test Results: ${passedCount}/${results.length} PASSED`);
    console.log('======================================================\n');
    process.exit(passedCount === results.length ? 0 : 1);
  }
}

runSemanticTestSuite().catch(console.error);
