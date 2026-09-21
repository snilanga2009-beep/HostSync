const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🧪 Starting ResortCare End-to-End Automated Verification...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`, detail || '');
      failed++;
    }
  }

  try {
    // 1. Health Check
    const healthRes = await fetch(`${BASE_URL}/health`);
    const health = await healthRes.json();
    assert(health.status === 'online', '1. Server Health Check online');

    // 2. Auth: Super Admin Login
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@oceanpearl.com', password: 'password123' })
    });
    const adminAuth = await adminLoginRes.json();
    assert(!!adminAuth.token && adminAuth.user.role === 'Super Admin', '2. Super Admin Login & JWT generation');

    const adminHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminAuth.token}`
    };

    // 3. Auth: Technician Login
    const techLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'david@oceanpearl.com', password: 'password123' })
    });
    const techAuth = await techLoginRes.json();
    assert(!!techAuth.token && techAuth.user.full_name === 'David Fernando', '3. Technician David Login & Profile recognition');

    const techHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${techAuth.token}`
    };

    // 4. Guest QR Token Room Resolution (Room 101)
    const guestRoomRes = await fetch(`${BASE_URL}/guest/room/ocean101token`);
    const guestRoom = await guestRoomRes.json();
    assert(
      guestRoom.success === true &&
      guestRoom.room.number === '101' &&
      guestRoom.facilities.length > 0,
      '4. Guest in-room QR token resolution auto-identifies Room 101 and facilities',
      guestRoom.room
    );

    // 5. Invalid QR Token Rejection
    const invalidQrRes = await fetch(`${BASE_URL}/guest/room/nonexistent_fake_qr_token`);
    assert(invalidQrRes.status === 404, '5. Security: Non-existent QR token correctly rejected with 404');

    // 6. Add Room with Automatic QR Generation
    const testRoomNum = `99${Math.floor(10 + Math.random() * 89)}`;
    const createRoomRes = await fetch(`${BASE_URL}/rooms`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        room_number: testRoomNum,
        name: `Penthouse Test ${testRoomNum}`,
        room_status: 'Available',
        occupancy_status: 'Vacant'
      })
    });
    const newRoom = await createRoomRes.json();
    assert(newRoom.success === true && !!newRoom.qrToken, `6. Admin creates Room ${testRoomNum} with auto-generated secure QR token`);

    // Verify newly generated QR token works publicly
    const newQrResolve = await fetch(`${BASE_URL}/guest/room/${newRoom.qrToken}`);
    const resolvedNewRoom = await newQrResolve.json();
    assert(resolvedNewRoom.room.number === testRoomNum, `7. Auto-generated QR token immediately resolves newly created Room ${testRoomNum}`);

    // 7. Guest Submits Maintenance Request
    const maintReqRes = await fetch(`${BASE_URL}/guest/maintenance-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomToken: 'ocean101token',
        items: [
          { itemName: 'Air Conditioner', problemType: 'Not cooling' }
        ],
        description: 'Automated test: AC is blowing warm air.',
        urgency: 'High',
        guestName: 'Sir Arthur Conan'
      })
    });
    const maintReq = await maintReqRes.json();
    assert(maintReq.success === true && !!maintReq.requestCode && !!maintReq.trackingToken, `8. Guest submits maintenance request via QR code -> Received Code ${maintReq.requestCode}`);

    // 8. Front Office Dispatches & Assigns Technician David Fernando
    // Look up David's staff ID
    const staffRes = await fetch(`${BASE_URL}/staff`, { headers: adminHeaders });
    const staffData = await staffRes.json();
    const davidStaff = staffData.staff.find((s: any) => s.full_name === 'David Fernando');
    assert(!!davidStaff, '9. Staff Directory lists Technician David Fernando');

    // Find the request in Front Office list
    const reqListRes = await fetch(`${BASE_URL}/requests?search=${maintReq.requestCode}`, { headers: adminHeaders });
    const reqListData = await reqListRes.json();
    const createdReqObj = reqListData.requests[0];
    assert(!!createdReqObj && createdReqObj.request_code === maintReq.requestCode, `10. Front Office maintenance queue receives ${maintReq.requestCode}`);

    // Assign to David
    const assignRes = await fetch(`${BASE_URL}/requests/${createdReqObj.id}/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ staffId: davidStaff.id, notes: 'Priority cooling issue' })
    });
    const assignData = await assignRes.json();
    assert(assignData.success === true, `11. Front Office assigns task to David Fernando`);

    // 9. Technician Workflow Transitions
    // David accepts task
    const acceptRes = await fetch(`${BASE_URL}/requests/${createdReqObj.id}/status`, {
      method: 'POST',
      headers: techHeaders,
      body: JSON.stringify({ status: 'Accepted' })
    });
    assert((await acceptRes.json()).success === true, '12. Technician transitions status -> Accepted');

    // David On The Way
    const otwRes = await fetch(`${BASE_URL}/requests/${createdReqObj.id}/status`, {
      method: 'POST',
      headers: techHeaders,
      body: JSON.stringify({ status: 'On The Way' })
    });
    assert((await otwRes.json()).success === true, '13. Technician transitions status -> On The Way');

    // David Arrived / Working
    const workingRes = await fetch(`${BASE_URL}/requests/${createdReqObj.id}/status`, {
      method: 'POST',
      headers: techHeaders,
      body: JSON.stringify({ status: 'In Progress' })
    });
    assert((await workingRes.json()).success === true, '14. Technician transitions status -> In Progress');

    // David Completes Work with Parts and Cost
    const completeRes = await fetch(`${BASE_URL}/requests/${createdReqObj.id}/status`, {
      method: 'POST',
      headers: techHeaders,
      body: JSON.stringify({
        status: 'Completed',
        notes: 'Refilled Freon refrigerant and cleaned outdoor compressor coil.',
        parts_used: 'R410A Refrigerant 2lbs',
        cost: 45.00
      })
    });
    assert((await completeRes.json()).success === true, '15. Technician marks job Completed with work notes, parts used, and cost');

    // 10. Guest Live Tracking Endpoint Verification
    const guestTrackRes = await fetch(`${BASE_URL}/guest/track/${maintReq.trackingToken}`);
    const guestTrackData = await guestTrackRes.json();
    assert(
      guestTrackData.status === 'Completed' &&
      guestTrackData.assignedStaff?.staff_name === 'David Fernando',
      '16. Guest public tracker verifies status is Completed and shows assigned specialist David Fernando'
    );

    // 11. Guest Tips Technician & Initiates Payment
    const tipRes = await fetch(`${BASE_URL}/guest/tip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomToken: 'ocean101token',
        staffId: davidStaff.id,
        requestId: createdReqObj.id,
        amount: 25.00,
        guestName: 'Sir Arthur Conan',
        guestMessage: 'Prompt repair, bedroom is wonderfully cool now!'
      })
    });
    const tipData = await tipRes.json();
    assert(tipData.success === true && !!tipData.transactionId, `17. Guest creates $25.00 tip checkout session (${tipData.transactionId})`);

    // Verify initial status is Pending (NOT marked Paid until verified)
    const checkPendingRes = await fetch(`${BASE_URL}/payments/status/${tipData.transactionId}`);
    const checkPending = await checkPendingRes.json();
    assert(checkPending.payment.status === 'Pending', '18. Payment security: Tip is initialized in Pending state and not premature Paid');

    // 12. Sandbox Payment Simulator / Webhook Confirmation
    const simPayRes = await fetch(`${BASE_URL}/payments/simulate-sandbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionId: tipData.transactionId,
        status: 'SUCCESS',
        paymentMethod: 'Square Test Card'
      })
    });
    const simPayData = await simPayRes.json();
    assert(simPayData.success === true, '19. Payment Gateway confirmation processed successfully');

    // Verify tip is now Paid and distributed to David
    const checkPaidRes = await fetch(`${BASE_URL}/payments/status/${tipData.transactionId}`);
    const checkPaid = await checkPaidRes.json();
    assert(checkPaid.payment.status === 'Paid', '20. Payment record finalized to Paid with timestamp');

    // Check David's tip history reflects new earnings
    const davidTipsRes = await fetch(`${BASE_URL}/staff/${davidStaff.id}/tips`, { headers: techHeaders });
    const davidTipsData = await davidTipsRes.json();
    assert(davidTipsData.summary.total >= 25.00, `21. Technician tip ledger reflects $25.00 gratuity payout (Total: $${davidTipsData.summary.total})`);

    // 13. Reports and Analytics Endpoint
    const reportsRes = await fetch(`${BASE_URL}/reports/maintenance-analytics`, { headers: adminHeaders });
    const reportsData = await reportsRes.json();
    assert(reportsData.mostReportedEquipment.length > 0, '22. Maintenance reports compute failure rates and equipment breakdown');

    console.log(`\n==================================================`);
    console.log(`🏁 VERIFICATION SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log(`==================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
