const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting CampusDrop Backend API Tests...\n');

  try {
    // 1. Health
    console.log('1. Testing GET /api/health');
    const health = await request('GET', '/api/health');
    console.assert(health.status === 200, `Expected 200, got ${health.status}`);
    console.log('   ✅ Health OK:', health.data);

    // 2. Boxes
    console.log('\n2. Testing GET /api/boxes');
    const boxes = await request('GET', '/api/boxes');
    console.assert(boxes.status === 200 && Array.isArray(boxes.data), 'Expected boxes array');
    console.log(`   ✅ Found ${boxes.data.length} boxes (B01 is ${boxes.data[0].name})`);

    // 3. Register parcel drop
    const testOrderId = '4029' + Math.floor(10000000 + Math.random() * 90000000);
    const expectedPin = testOrderId.slice(-4);
    console.log(`\n3. Testing POST /api/orders (Order: ${testOrderId}, expected PIN: ${expectedPin})`);
    const newOrder = await request('POST', '/api/orders', {
      orderId: testOrderId,
      boxId: 'B01',
      studentId: '22BCE1043',
      courier: 'Amazon',
      size: 'Medium'
    });
    console.assert(newOrder.status === 201, `Expected 201, got ${newOrder.status}`);
    console.assert(newOrder.data.order.pin === expectedPin, `PIN mismatch: ${newOrder.data.order.pin} vs ${expectedPin}`);
    console.log('   ✅ Order created with automatic last-4-digits PIN:', newOrder.data.order.pin);

    // 4. Verify Incorrect PIN
    console.log('\n4. Testing POST /api/orders/verify-pin (Incorrect PIN: 0000)');
    const wrongPin = await request('POST', '/api/orders/verify-pin', {
      orderId: testOrderId,
      pin: '0000'
    });
    console.assert(wrongPin.status === 401, `Expected 401 for wrong PIN, got ${wrongPin.status}`);
    console.log('   ✅ Incorrect PIN properly rejected:', wrongPin.data.message);

    // 5. Verify Correct PIN
    console.log(`\n5. Testing POST /api/orders/verify-pin (Correct PIN: ${expectedPin})`);
    const correctPin = await request('POST', '/api/orders/verify-pin', {
      orderId: testOrderId,
      pin: expectedPin
    });
    console.assert(correctPin.status === 200, `Expected 200 for correct PIN, got ${correctPin.status}`);
    console.assert(correctPin.data.box.locked === false, 'Box should be unlocked');
    console.assert(correctPin.data.box.servoAngle === 90, 'Servo angle should be 90');
    console.log('   ✅ PIN verified! Servo unlocked to 90 degrees:', correctPin.data.message);

    // 6. Collect parcel
    console.log('\n6. Testing POST /api/orders/:id/collect');
    const collect = await request('POST', `/api/orders/${testOrderId}/collect`);
    console.assert(collect.status === 200, `Expected 200, got ${collect.status}`);
    console.assert(collect.data.order.status === 'collected', 'Order status should be collected');
    console.assert(collect.data.box.locked === true, 'Box should be re-locked');
    console.log('   ✅ Parcel marked collected and box servo re-locked to 0 degrees.');

    // 7. IoT Sensor Reading
    console.log('\n7. Testing POST /api/boxes/B01/sensor');
    const sensor = await request('POST', '/api/boxes/B01/sensor', {
      parcelPresent: true,
      distanceCm: 11.4
    });
    console.assert(sensor.status === 200, `Expected 200, got ${sensor.status}`);
    console.log('   ✅ Sensor telemetry accepted:', sensor.data.event);

    console.log('\n===========================================');
    console.log('🎉 ALL BACKEND API TESTS PASSED SUCCESSFULLY!');
    console.log('===========================================\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

runTests();
