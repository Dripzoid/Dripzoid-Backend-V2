import 'dotenv/config';
process.env.GOOGLE_CLIENT_ID ||= 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-secret';
import http from 'http';

const TEST_PORT = 5098;

async function request(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data,
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runCorsTests() {
  const { app } = await import('../src/app.js');
  console.log('🧪 Running Backend CORS Test Suite...\n');
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
    }
  }

  try {
    // 1. Production Flutter Web origin preflight
    const r1 = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/auth/login',
      method: 'OPTIONS',
      headers: {
        Origin: 'https://dripzoid.yuvatejasainadh.me',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization',
      },
    });
    assert(r1.status === 204, `Production origin preflight returns 204 (got ${r1.status})`);
    assert(
      r1.headers['access-control-allow-origin'] === 'https://dripzoid.yuvatejasainadh.me',
      `Production origin receives exact ACAO header: ${r1.headers['access-control-allow-origin']}`
    );
    assert(
      r1.headers['access-control-allow-credentials'] === 'true',
      'Credentials allowed for production origin'
    );
    assert(
      r1.headers['access-control-allow-methods']?.includes('POST'),
      'POST method is allowed in preflight'
    );
    assert(
      r1.headers['access-control-allow-headers']?.toLowerCase().includes('authorization'),
      'Authorization header is allowed in preflight'
    );

    // 2. Vercel origin preflight
    const r2 = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/auth/login',
      method: 'OPTIONS',
      headers: {
        Origin: 'https://dripzoidv2.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization',
      },
    });
    assert(r2.status === 204, `Vercel origin preflight returns 204 (got ${r2.status})`);
    assert(
      r2.headers['access-control-allow-origin'] === 'https://dripzoidv2.vercel.app',
      `Vercel origin receives exact ACAO header: ${r2.headers['access-control-allow-origin']}`
    );

    // 3. Custom domain origin (https://dripzoid.com)
    const r3 = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/auth/login',
      method: 'OPTIONS',
      headers: {
        Origin: 'https://dripzoid.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert(r3.status === 204, `dripzoid.com preflight returns 204 (got ${r3.status})`);
    assert(
      r3.headers['access-control-allow-origin'] === 'https://dripzoid.com',
      'dripzoid.com receives exact ACAO'
    );

    // 4. Unauthorized origin preflight
    const r4 = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/auth/login',
      method: 'OPTIONS',
      headers: {
        Origin: 'https://malicious-website.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization',
      },
    });
    assert(
      !r4.headers['access-control-allow-origin'],
      'Unauthorized origin receives NO Access-Control-Allow-Origin header'
    );
    assert(
      r4.status !== 500,
      `Unauthorized origin does not throw HTTP 500 error (got ${r4.status})`
    );

    // 5. Non-browser request without Origin header (e.g., Mobile App / Curl)
    const r5 = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/',
      method: 'GET',
      headers: {},
    });
    assert(r5.status === 200, `Request without Origin header is allowed (got ${r5.status})`);

    // 6. Production origin GET on health check
    const r6 = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/',
      method: 'GET',
      headers: {
        Origin: 'https://dripzoid.yuvatejasainadh.me',
      },
    });
    assert(r6.status === 200, `Production origin GET succeeds (got ${r6.status})`);
    assert(
      r6.headers['access-control-allow-origin'] === 'https://dripzoid.yuvatejasainadh.me',
      'Production origin receives ACAO on GET response'
    );

    console.log(`\n🎉 CORS Test Results: ${passed}/${total} assertions passed.`);
    server.close();
    if (passed !== total) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('Test execution failed:', err);
    server.close();
    process.exit(1);
  }
}

runCorsTests();
