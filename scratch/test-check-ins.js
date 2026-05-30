// scratch/test-check-ins.js
import http from 'http';

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const payload = postData ? JSON.stringify(postData) : null;
    const reqHeaders = { ...(options.headers || {}) };

    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const reqOptions = {
      ...options,
      headers: reqHeaders,
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, rawBody: data, headers: res.headers });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function run() {
  console.log('1. Logging in as owner...');
  const loginRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/auth/login',
      method: 'POST',
    },
    {
      email: 'owner@demo-clinic.com',
      password: 'Admin@123456',
      tenantSlug: 'demo-clinic',
    }
  );

  if (loginRes.status !== 200) {
    console.error('Login failed!', loginRes.body);
    process.exit(1);
  }

  const accessToken = loginRes.body.data.accessToken;
  console.log('Logged in as owner successfully.');

  const clientEmail = `checkin.tester-${Date.now()}@example.com`;
  console.log(`\n2. Creating a test client with email ${clientEmail}...`);
  const clientRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/clients',
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    {
      firstName: 'CheckIn',
      lastName: 'Tester',
      email: clientEmail,
      phone: '+1-555-888-7777',
      gender: 'FEMALE',
      dateOfBirth: '1990-08-15',
    }
  );

  const clientId = clientRes.body.data.client.id;
  console.log('Client created with ID:', clientId);

  console.log('\n3. Creating a test Diet Plan for client...');
  const planRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/clients/${clientId}/diet-plans`,
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    {
      title: 'Check-in Target Plan',
      startDate: '2026-05-01T00:00:00Z',
      endDate: '2026-05-31T00:00:00Z',
      status: 'ACTIVE',
    }
  );

  const planId = planRes.body.data.dietPlan.id;
  console.log('Diet plan created with ID:', planId);

  // 4. Validate clinical ranges
  console.log('\n4. Testing out-of-bounds weight validation (600kg)...');
  const badWeightRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/clients/${clientId}/check-ins`,
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    {
      weightKg: 600,
    }
  );
  console.log('Status (Expected 400):', badWeightRes.status);
  if (badWeightRes.status !== 400) {
    console.error('Expected 400 Bad Request for out-of-bounds weight!');
    process.exit(1);
  }

  console.log('\n5. Testing out-of-bounds water intake validation (25L)...');
  const badWaterRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/clients/${clientId}/check-ins`,
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    {
      waterIntakeLiters: 25,
    }
  );
  console.log('Status (Expected 400):', badWaterRes.status);
  if (badWaterRes.status !== 400) {
    console.error('Expected 400 Bad Request for out-of-bounds water!');
    process.exit(1);
  }

  console.log('\n6. Testing out-of-bounds rating validation (energyLevel = 6)...');
  const badRatingRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/clients/${clientId}/check-ins`,
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    {
      energyLevel: 6,
    }
  );
  console.log('Status (Expected 400):', badRatingRes.status);
  if (badRatingRes.status !== 400) {
    console.error('Expected 400 Bad Request for out-of-bounds rating!');
    process.exit(1);
  }

  // 5. Create first valid check-in
  console.log('\n7. Creating first valid check-in in PENDING status...');
  const checkIn1Res = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/clients/${clientId}/check-ins`,
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    {
      dietPlanId: planId,
      checkInDate: '2026-05-10T00:00:00Z',
      status: 'PENDING',
      weightKg: 80.0,
      waistCm: 90.0,
      waterIntakeLiters: 2.5,
      sleepHours: 7.5,
      exerciseDays: 3,
      energyLevel: 4,
      stressLevel: 2,
      moodLevel: 4,
      planAdherence: 4,
      clientNotes: 'First draft',
    }
  );

  console.log('Status (Expected 201):', checkIn1Res.status);
  if (checkIn1Res.status !== 201) {
    console.error('Failed to create check-in 1!', checkIn1Res.body);
    process.exit(1);
  }
  const checkIn1 = checkIn1Res.body.data.checkIn;
  console.log('Created Check-in 1 with ID:', checkIn1.id);
  console.log('Weight Change (Expected null):', checkIn1.weightChange);

  // 6. Submit check-in
  console.log('\n8. Updating check-in 1 status to SUBMITTED...');
  const submitRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/check-ins/${checkIn1.id}`,
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    {
      status: 'SUBMITTED',
      clientNotes: 'Submitted notes',
    }
  );
  console.log('Status (Expected 200):', submitRes.status);
  if (submitRes.status !== 200) {
    console.error('Failed to update check-in to SUBMITTED!');
    process.exit(1);
  }
  console.log('Submitted At date set:', submitRes.body.data.checkIn.submittedAt !== null);

  // 7. Verify review workflow validation
  console.log('\n9. Attempting to review a PENDING check-in (should fail)...');
  const checkInPendingRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/clients/${clientId}/check-ins`,
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    {
      checkInDate: '2026-05-08T00:00:00Z',
      status: 'PENDING',
      weightKg: 79.5,
    }
  );
  const pendingId = checkInPendingRes.body.data.checkIn.id;
  const reviewPendingFailRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/check-ins/${pendingId}/review`,
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    {
      practitionerNotes: 'Reviewing early',
      status: 'REVIEWED',
    }
  );
  console.log('Review Pending Status (Expected 400):', reviewPendingFailRes.status);
  if (reviewPendingFailRes.status !== 400) {
    console.error('Allowed reviewing a PENDING check-in, which should be blocked!');
    process.exit(1);
  }

  // 8. Review the submitted check-in
  console.log('\n10. Reviewing the submitted check-in 1...');
  const reviewRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/check-ins/${checkIn1.id}/review`,
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    {
      practitionerNotes: 'Doing great, water intake is good.',
      status: 'REVIEWED',
    }
  );
  console.log('Status (Expected 200):', reviewRes.status);
  if (reviewRes.status !== 200) {
    console.error('Failed to review check-in!', reviewRes.body);
    process.exit(1);
  }
  const reviewedCheckIn = reviewRes.body.data.checkIn;
  console.log('Review Status:', reviewedCheckIn.status);
  console.log('Reviewed By user name:', reviewedCheckIn.reviewedBy.name);

  // 9. Verify terminal status constraints
  console.log('\n11. Attempting to demote reviewed check-in back to SUBMITTED (should fail)...');
  const demoteRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/check-ins/${checkIn1.id}`,
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    {
      status: 'SUBMITTED',
    }
  );
  console.log('Demotion Status (Expected 400):', demoteRes.status);
  if (demoteRes.status !== 400) {
    console.error('Allowed demoting a REVIEWED check-in!');
    process.exit(1);
  }

  // 10. Create second check-in to test weight delta
  console.log('\n12. Creating second check-in with lower weight to test trend delta calculations...');
  const checkIn2Res = await makeRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/clients/${clientId}/check-ins`,
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    {
      checkInDate: '2026-05-15T00:00:00Z',
      status: 'SUBMITTED',
      weightKg: 78.2, // 80.0 -> 78.2
      waistCm: 89.0,  // 90.0 -> 89.0
    }
  );
  console.log('Status (Expected 201):', checkIn2Res.status);
  if (checkIn2Res.status !== 201) {
    console.error('Failed to create second check-in!', checkIn2Res.body);
    process.exit(1);
  }
  const checkIn2 = checkIn2Res.body.data.checkIn;
  console.log('Check-in 2 Weight Change Delta:', checkIn2.weightChange);
  console.log('Check-in 2 Waist Change Delta:', checkIn2.waistChange);

  if (checkIn2.weightChange !== -1.8) {
    console.error('Weight change delta incorrect! Expected -1.8, got:', checkIn2.weightChange);
    process.exit(1);
  }
  if (checkIn2.waistChange !== -1) {
    console.error('Waist change delta incorrect! Expected -1.0, got:', checkIn2.waistChange);
    process.exit(1);
  }

  // 11. Retrieve client check-ins list
  console.log('\n13. Querying check-ins list for the client...');
  const listRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/v1/clients/${clientId}/check-ins?sortBy=checkInDate&sortOrder=desc`,
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  console.log('List Status (Expected 200):', listRes.status);
  const list = listRes.body.data.checkIns;
  console.log('Check-ins returned:', list.length);
  if (list[0].id !== checkIn2.id) {
    console.error('Sorting failed! Expected check-in 2 (latest) to be first.');
    process.exit(1);
  }
  console.log('Verification: list[0] delta calculation present:', list[0].weightChange !== null);

  // 12. Query global check-ins list
  console.log('\n14. Querying global practitioner check-ins list...');
  const globalRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/v1/check-ins?status=SUBMITTED`,
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  console.log('Global List Status (Expected 200):', globalRes.status);
  console.log('Global results returned:', globalRes.body.data.checkIns.length);

  // 13. Soft-delete the check-in
  console.log('\n15. Soft-deleting check-in 2...');
  const deleteRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/v1/check-ins/${checkIn2.id}`,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  console.log('Delete Status (Expected 200):', deleteRes.status);
  if (deleteRes.status !== 200) {
    process.exit(1);
  }

  console.log('\n16. Verifying deleted check-in is no longer retrievable...');
  const getDeletedRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/v1/check-ins/${checkIn2.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  console.log('Get Deleted Status (Expected 404):', getDeletedRes.status);
  if (getDeletedRes.status !== 404) {
    console.error('Soft-deleted check-in is still retrievable!');
    process.exit(1);
  }

  console.log('\n======================================');
  console.log('🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('======================================');
  process.exit(0);
}

run().catch((e) => {
  console.error('Test run error:', e);
  process.exit(1);
});
