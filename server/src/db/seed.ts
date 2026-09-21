import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from './database';
import { QRCodeService } from '../services/qrcode';

async function seed() {
  console.log('🌱 Starting ResortCare database seeding...');
  initDatabase();

  // Clear existing records in logical order
  const tables = [
    'audit_logs', 'notifications', 'payment_webhooks', 'payments', 'tip_distributions',
    'tips', 'staff_assignments', 'request_status_history', 'maintenance_request_items',
    'maintenance_requests', 'guest_service_requests', 'qr_codes', 'staff_profiles',
    'users', 'room_item_assignments', 'room_items', 'rooms', 'room_types',
    'floors', 'buildings', 'settings', 'hotels'
  ];

  for (const table of tables) {
    db.prepare(`DELETE FROM ${table}`).run();
  }

  // 1. Hotel
  const hotelId = 'hotel-ocean-pearl';
  db.prepare(`
    INSERT INTO hotels (
      id, name, resort_name, logo_url, address, phone, email, website,
      currency, timezone, country, default_lang, emergency_contact, guest_service_contact
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    hotelId,
    'Ocean Pearl Resort & Spa',
    'Ocean Pearl Resort',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&auto=format&fit=crop&q=80',
    '45 Ocean Drive, Coral Bay, Florida 33040',
    '+1 (305) 555-0199',
    'guestservice@oceanpearlresort.com',
    'https://www.oceanpearlresort.com',
    'USD',
    'America/New_York',
    'United States',
    'en',
    '+1 (305) 555-0911',
    '+1 (305) 555-0100'
  );

  // 2. Buildings & Floors
  const bldgMain = 'bldg-main';
  const bldgVilla = 'bldg-villas';

  db.prepare(`INSERT INTO buildings (id, hotel_id, name, code) VALUES (?, ?, ?, ?)`).run(
    bldgMain, hotelId, 'Main Coral Wing', 'MCW'
  );
  db.prepare(`INSERT INTO buildings (id, hotel_id, name, code) VALUES (?, ?, ?, ?)`).run(
    bldgVilla, hotelId, 'Oceanfront Villas', 'OVL'
  );

  const floor1Id = 'floor-main-1';
  const floor2Id = 'floor-main-2';
  const floorVillaId = 'floor-villa-1';

  db.prepare(`INSERT INTO floors (id, building_id, floor_number, name) VALUES (?, ?, ?, ?)`).run(
    floor1Id, bldgMain, 1, 'First Floor - Coral Wing'
  );
  db.prepare(`INSERT INTO floors (id, building_id, floor_number, name) VALUES (?, ?, ?, ?)`).run(
    floor2Id, bldgMain, 2, 'Second Floor - Coral Wing'
  );
  db.prepare(`INSERT INTO floors (id, building_id, floor_number, name) VALUES (?, ?, ?, ?)`).run(
    floorVillaId, bldgVilla, 1, 'Ground Level Villas'
  );

  // 3. Room Types
  const roomTypes = [
    { id: 'rt-std', name: 'Standard Room', code: 'STD', desc: 'Comfortable luxury room with plush bedding and resort garden view.', guests: 2, beds: 1, bedType: 'Queen', size: 32, price: 175, img: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&auto=format&fit=crop&q=80' },
    { id: 'rt-dlx', name: 'Deluxe Ocean View', code: 'DLX', desc: 'Spacious deluxe room with panoramic ocean balcony and upgraded amenities.', guests: 2, beds: 1, bedType: 'King', size: 45, price: 285, img: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=600&auto=format&fit=crop&q=80' },
    { id: 'rt-sup', name: 'Superior Twin', code: 'SUP', desc: 'Elegant room with two double beds, working desk and marble bathroom.', guests: 4, beds: 2, bedType: 'Double', size: 40, price: 240, img: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&auto=format&fit=crop&q=80' },
    { id: 'rt-ste', name: 'Executive Ocean Suite', code: 'STE', desc: 'Executive suite with private living lounge, jacuzzi tub and premium butler service.', guests: 3, beds: 1, bedType: 'King', size: 68, price: 450, img: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&auto=format&fit=crop&q=80' },
    { id: 'rt-vil', name: 'Presidential Beach Villa', code: 'VIL', desc: 'Exclusive beachfront villa with private plunge pool, outdoor rain shower and sun deck.', guests: 6, beds: 3, bedType: 'King & Queens', size: 140, price: 850, img: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=600&auto=format&fit=crop&q=80' }
  ];

  for (const rt of roomTypes) {
    db.prepare(`
      INSERT INTO room_types (id, hotel_id, name, code, description, max_guests, bed_count, bed_type, room_size_sqm, base_price, image_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(rt.id, hotelId, rt.name, rt.code, rt.desc, rt.guests, rt.beds, rt.bedType, rt.size, rt.price, rt.img);
  }

  // 4. Room Items Catalog
  const itemCatalog = [
    { id: 'item-ac', name: 'Air Conditioner', category: 'HVAC', icon: 'fan', desc: 'Climate control cooling & heating unit' },
    { id: 'item-tv', name: 'Smart Television 55"', category: 'Electronics', icon: 'tv', desc: '4K Ultra HD smart TV with hospitality streaming' },
    { id: 'item-remote', name: 'TV Remote Control', category: 'Electronics', icon: 'remote', desc: 'Sanitized universal television remote' },
    { id: 'item-fridge', name: 'Mini Refrigerator', category: 'Appliances', icon: 'refrigerator', desc: 'Silent compact minibar refrigerator' },
    { id: 'item-water-heater', name: 'Water Heater', category: 'Plumbing', icon: 'flame', desc: 'Rapid hot water system' },
    { id: 'item-shower', name: 'Rainfall Shower', category: 'Plumbing', icon: 'shower-head', desc: 'High pressure thermostatic shower' },
    { id: 'item-safe', name: 'Digital In-Room Safe', category: 'Security', icon: 'shield-check', desc: 'Laptop-sized electronic keypad safe' },
    { id: 'item-hairdryer', name: 'Ionic Hair Dryer', category: 'Bathroom', icon: 'wind', desc: '1800W quiet ionic styling dryer' },
    { id: 'item-wifi', name: 'In-Room Wi-Fi Access Point', category: 'Electronics', icon: 'wifi', desc: 'High-speed dedicated Wi-Fi 6 access point' },
    { id: 'item-coffee', name: 'Nespresso Coffee Machine', category: 'Appliances', icon: 'coffee', desc: 'Capsule espresso coffee maker' },
    { id: 'item-kettle', name: 'Electric Kettle', category: 'Appliances', icon: 'coffee', desc: 'Rapid-boil stainless steel kettle' },
    { id: 'item-lock', name: 'Smart Keycard Door Lock', category: 'Security', icon: 'lock', desc: 'RFID contactless guest lock' },
    { id: 'item-iron', name: 'Steam Iron & Ironing Board', category: 'Appliances', icon: 'shirt', desc: 'Full-size steam iron and foldaway board' },
    { id: 'item-lights', name: 'Smart Lighting & Dimmer', category: 'Electrical', icon: 'lightbulb', desc: 'Architectural recessed ambient lighting' }
  ];

  for (const item of itemCatalog) {
    db.prepare(`
      INSERT INTO room_items (id, hotel_id, name, category, icon, default_description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(item.id, hotelId, item.name, item.category, item.icon, item.desc);
  }

  // 5. Rooms & Unique QR Tokens
  const roomDefinitions = [
    { num: '101', name: 'Coral Garden Room', type: 'rt-std', bldg: bldgMain, floor: floor1Id, status: 'Occupied', occ: 'Occupied', token: 'ocean101token' },
    { num: '102', name: 'Coral Garden Room', type: 'rt-std', bldg: bldgMain, floor: floor1Id, status: 'Available', occ: 'Vacant', token: 'ocean102token' },
    { num: '103', name: 'Deluxe Sunset Room', type: 'rt-dlx', bldg: bldgMain, floor: floor1Id, status: 'Occupied', occ: 'Occupied', token: 'ocean103token' },
    { num: '104', name: 'Deluxe Sunset Room', type: 'rt-dlx', bldg: bldgMain, floor: floor1Id, status: 'Cleaning', occ: 'Vacant', token: 'ocean104token' },
    { num: '201', name: 'Oceanview Grand Suite', type: 'rt-ste', bldg: bldgMain, floor: floor2Id, status: 'Occupied', occ: 'Occupied', token: 'ocean201token' },
    { num: '202', name: 'Oceanview Grand Suite', type: 'rt-ste', bldg: bldgMain, floor: floor2Id, status: 'Available', occ: 'Vacant', token: 'ocean202token' },
    { num: 'Villa-1', name: 'Pearl Beach Villa 01', type: 'rt-vil', bldg: bldgVilla, floor: floorVillaId, status: 'Occupied', occ: 'Occupied', token: 'oceanvilla1token' }
  ];

  for (const r of roomDefinitions) {
    const roomId = `room-${r.num.toLowerCase().replace('-', '')}`;
    
    // Insert Room
    db.prepare(`
      INSERT INTO rooms (
        id, hotel_id, building_id, floor_id, room_type_id, room_number, name,
        room_status, occupancy_status, guest_status, qr_token, room_image, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Checked-in', ?, ?, ?)
    `).run(
      roomId, hotelId, r.bldg, r.floor, r.type, r.num, r.name,
      r.status, r.occ, r.token,
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&auto=format&fit=crop&q=80',
      'VIP guest preference for quiet room'
    );

    // Generate and Insert QR Code Record
    const qrDataUrl = await QRCodeService.generateDataUrl(r.token);
    db.prepare(`
      INSERT INTO qr_codes (id, room_id, token, qr_data_url, scans_count, is_active, created_at, last_scanned_at)
      VALUES (?, ?, ?, ?, 12, 1, datetime('now'), datetime('now'))
    `).run(uuidv4(), roomId, r.token, qrDataUrl);

    // Assign Room Items specifically to this room
    // Standard rooms have standard items, suites/villas have all luxury items
    const selectedItemIds = (r.type === 'rt-ste' || r.type === 'rt-vil')
      ? itemCatalog.map(i => i.id)
      : ['item-ac', 'item-tv', 'item-remote', 'item-fridge', 'item-water-heater', 'item-shower', 'item-safe', 'item-hairdryer', 'item-wifi', 'item-kettle', 'item-lock', 'item-lights'];

    for (const itemId of selectedItemIds) {
      // Room 101 AC is experiencing cooling issue
      const isDamaged101AC = (r.num === '101' && itemId === 'item-ac');
      const condition = isDamaged101AC ? 'Needs Inspection' : 'Working';

      db.prepare(`
        INSERT INTO room_item_assignments (
          id, room_id, room_item_id, condition_status, serial_number, install_date,
          warranty_date, last_maintenance_date, notes
        ) VALUES (?, ?, ?, ?, ?, '2024-01-15', '2027-01-15', '2026-06-10', ?)
      `).run(
        uuidv4(),
        roomId,
        itemId,
        condition,
        `SN-${r.num}-${itemId.substring(5).toUpperCase()}`,
        isDamaged101AC ? 'Reported cooling intermittently' : 'Inspected clean & functioning'
      );
    }
  }

  // 6. Users & Staff Profiles
  const passwordHash = await bcrypt.hash('password123', 10);

  const usersList = [
    {
      id: 'usr-admin',
      email: 'admin@oceanpearl.com',
      name: 'Alexander Vance',
      role: 'Super Admin',
      phone: '+1 305-555-0101',
      dept: 'Executive Management',
      title: 'General Manager',
      empId: 'EMP-001',
      skills: ['Leadership', 'Hotel Operations', 'Financial Auditing'],
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: 'usr-hotel-admin',
      email: 'manager@oceanpearl.com',
      name: 'Elena Rostova',
      role: 'Hotel Admin',
      phone: '+1 305-555-0102',
      dept: 'Front Office',
      title: 'Operations Manager',
      empId: 'EMP-002',
      skills: ['Guest Services', 'Room Inventory', 'Dispute Resolution'],
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: 'usr-frontdesk',
      email: 'frontdesk@oceanpearl.com',
      name: 'Chloe Bennett',
      role: 'Front Office Staff',
      phone: '+1 305-555-0103',
      dept: 'Front Desk',
      title: 'Front Office Supervisor',
      empId: 'EMP-003',
      skills: ['Check-in/Check-out', 'Concierge', 'Guest Dispatch'],
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: 'usr-maint-mgr',
      email: 'maintenance@oceanpearl.com',
      name: 'Marcus Brody',
      role: 'Maintenance Manager',
      phone: '+1 305-555-0104',
      dept: 'Engineering',
      title: 'Chief Engineer',
      empId: 'EMP-004',
      skills: ['Facilities Engineering', 'Preventive Maintenance', 'HVAC Master'],
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: 'usr-david',
      email: 'david@oceanpearl.com',
      name: 'David Fernando',
      role: 'Technician',
      phone: '+1 305-555-0111',
      dept: 'Maintenance',
      title: 'Senior HVAC & Electrical Technician',
      empId: 'EMP-101',
      skills: ['HVAC Systems', 'Electrical Wiring', 'Smart Locks', 'Refrigeration'],
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: 'usr-michael',
      email: 'michael@oceanpearl.com',
      name: 'Michael Perera',
      role: 'Technician',
      phone: '+1 305-555-0112',
      dept: 'Maintenance',
      title: 'Plumbing & Electronics Specialist',
      empId: 'EMP-102',
      skills: ['Plumbing', 'Water Heaters', 'Audio/Visual', 'Appliances'],
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: 'usr-john',
      email: 'john@oceanpearl.com',
      name: 'John Silva',
      role: 'Room Service Boy',
      phone: '+1 305-555-0121',
      dept: 'Room Service',
      title: 'Lead Guest Hospitality & Room Boy',
      empId: 'EMP-201',
      skills: ['Dining Service', 'Quick Dispatch', 'Guest Hospitality', 'Luggage Assistance'],
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: 'usr-sarah',
      email: 'sarah@oceanpearl.com',
      name: 'Sarah Jenkins',
      role: 'Housekeeping Staff',
      phone: '+1 305-555-0122',
      dept: 'Housekeeping',
      title: 'Floor Housekeeping Supervisor',
      empId: 'EMP-202',
      skills: ['Sanitization', 'Linen Management', 'VIP Preparation'],
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80'
    }
  ];

  for (const u of usersList) {
    db.prepare(`
      INSERT INTO users (id, hotel_id, email, password_hash, full_name, role, status, phone)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(u.id, hotelId, u.email, passwordHash, u.name, u.role, u.phone);

    const staffId = `staff-${u.empId.toLowerCase()}`;
    db.prepare(`
      INSERT INTO staff_profiles (
        id, user_id, employee_id, department, job_title, phone,
        skills_json, avatar_url, status, working_hours, rating
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', '08:00 - 17:00', 4.9)
    `).run(
      staffId,
      u.id,
      u.empId,
      u.dept,
      u.title,
      u.phone,
      JSON.stringify(u.skills),
      u.avatar
    );
  }

  // 7. Seed Sample Maintenance Requests
  const req1Id = 'req-rm-1024';
  const req1Token = 'track1024token';
  db.prepare(`
    INSERT INTO maintenance_requests (
      id, request_code, hotel_id, room_id, tracking_token, guest_name, guest_phone,
      priority, urgency, status, description, created_at, updated_at
    ) VALUES (?, 'RM-1024', ?, 'room-101', ?, 'Dr. Marcus Sterling', '+1 305-555-9011', 'High', 'High', 'Submitted', 'The AC unit is blowing ambient air and will not cool down below 78F.', datetime('now', '-45 minutes'), datetime('now', '-45 minutes'))
  `).run(req1Id, hotelId, req1Token);

  db.prepare(`
    INSERT INTO maintenance_request_items (id, request_id, item_name, problem_type, notes)
    VALUES (?, ?, 'Air Conditioner', 'Not cooling', 'Set to 68F but temperature stays warm.')
  `).run(uuidv4(), req1Id);

  db.prepare(`
    INSERT INTO request_status_history (id, request_id, status, notes, created_at)
    VALUES (?, ?, 'Submitted', 'Guest submitted maintenance request via in-room QR code', datetime('now', '-45 minutes'))
  `).run(uuidv4(), req1Id);

  // Request 2 (Assigned to Technician David)
  const req2Id = 'req-rm-1022';
  const req2Token = 'track1022token';
  db.prepare(`
    INSERT INTO maintenance_requests (
      id, request_code, hotel_id, room_id, tracking_token, guest_name, guest_phone,
      priority, urgency, status, description, created_at, updated_at
    ) VALUES (?, 'RM-1022', ?, 'room-103', ?, 'Amanda Hayes', '+1 305-555-9022', 'Normal', 'Normal', 'Assigned', 'Smart TV in living area says no signal on HDMI 1.', datetime('now', '-2 hours'), datetime('now', '-1 hour'))
  `).run(req2Id, hotelId, req2Token);

  db.prepare(`
    INSERT INTO maintenance_request_items (id, request_id, item_name, problem_type, notes)
    VALUES (?, ?, 'Television', 'Not working', 'HDMI signal lost.')
  `).run(uuidv4(), req2Id);

  db.prepare(`
    INSERT INTO staff_assignments (id, request_id, staff_id, assigned_by_user_id, status, assigned_at)
    VALUES (?, ?, 'staff-emp-101', 'usr-frontdesk', 'Assigned', datetime('now', '-1 hour'))
  `).run(uuidv4(), req2Id);

  db.prepare(`
    INSERT INTO request_status_history (id, request_id, status, notes, created_at)
    VALUES (?, ?, 'Assigned', 'Assigned to David Fernando (HVAC & Electrical Specialist)', datetime('now', '-1 hour'))
  `).run(uuidv4(), req2Id);

  // Request 3 (Completed)
  const req3Id = 'req-rm-1019';
  const req3Token = 'track1019token';
  db.prepare(`
    INSERT INTO maintenance_requests (
      id, request_code, hotel_id, room_id, tracking_token, guest_name, guest_phone,
      priority, urgency, status, description, created_at, updated_at, resolved_at
    ) VALUES (?, 'RM-1019', ?, 'room-201', ?, 'Lord Harrison', '+1 305-555-9033', 'Normal', 'Normal', 'Completed', 'Bathroom water heater was humming loudly.', datetime('now', '-1 day'), datetime('now', '-20 hours'), datetime('now', '-20 hours'))
  `).run(req3Id, hotelId, req3Token);

  db.prepare(`
    INSERT INTO staff_assignments (id, request_id, staff_id, assigned_by_user_id, status, assigned_at, completed_at, notes)
    VALUES (?, ?, 'staff-emp-102', 'usr-frontdesk', 'Completed', datetime('now', '-23 hours'), datetime('now', '-20 hours'), 'Descaled heating element and replaced gasket.')
  `).run(uuidv4(), req3Id);

  db.prepare(`
    INSERT INTO request_status_history (id, request_id, status, changed_by_user_id, notes, parts_used, cost, created_at)
    VALUES (?, ?, 'Completed', 'usr-michael', 'Heating element serviced and valve gasket replaced. Flushed lines.', 'High-temp silicone gasket (x1)', 24.50, datetime('now', '-20 hours'))
  `).run(uuidv4(), req3Id);

  // 8. Sample Guest Service Request
  db.prepare(`
    INSERT INTO guest_service_requests (
      id, request_code, hotel_id, room_id, tracking_token, guest_name, guest_phone,
      service_type, quantity, notes, status, created_at
    ) VALUES (?, 'GS-3012', ?, 'room-101', 'trackgs3012token', 'Dr. Marcus Sterling', '+1 305-555-9011', 'Extra towels', 3, 'Extra large bath sheets requested please.', 'Received', datetime('now', '-30 minutes'))
  `).run(uuidv4(), hotelId);

  // 9. Sample Tips and Payments
  const tip1Id = 'tip-demo-01';
  const txn1Id = 'TXN-1726000000-8821';
  db.prepare(`
    INSERT INTO tips (
      id, hotel_id, room_id, staff_id, request_id, amount, currency, custom_amount,
      status, guest_name, guest_message, created_at, completed_at
    ) VALUES (?, ?, 'room-201', 'staff-emp-201', ?, 20.00, 'USD', 0, 'Paid', 'Lord Harrison', 'Superb service by John Silva! Prompt and polite.', datetime('now', '-18 hours'), datetime('now', '-18 hours'))
  `).run(tip1Id, hotelId, req3Id);

  db.prepare(`
    INSERT INTO tip_distributions (id, tip_id, staff_id, staff_amount, hotel_pool_amount, distribution_rule, created_at)
    VALUES (?, ?, 'staff-emp-201', 20.00, 0.00, '100_staff', datetime('now', '-18 hours'))
  `).run(uuidv4(), tip1Id);

  db.prepare(`
    INSERT INTO payments (
      id, transaction_id, provider, tip_id, amount, currency, status, idempotency_key, payment_token, checkout_url, raw_response, created_at, completed_at
    ) VALUES (?, ?, 'square', ?, 20.00, 'USD', 'Paid', ?, 'tok_sq_sandbox_8821', 'https://square.com/checkout/mock', ?, datetime('now', '-18 hours'), datetime('now', '-18 hours'))
  `).run(uuidv4(), txn1Id, tip1Id, uuidv4(), JSON.stringify({ status: 'COMPLETED', card_brand: 'VISA', last_4: '4242' }));

  // Tip 2 (David - Technician)
  const tip2Id = 'tip-demo-02';
  const txn2Id = 'TXN-1726000000-8822';
  db.prepare(`
    INSERT INTO tips (
      id, hotel_id, room_id, staff_id, request_id, amount, currency, custom_amount,
      status, guest_name, guest_message, created_at, completed_at
    ) VALUES (?, ?, 'room-201', 'staff-emp-102', ?, 15.00, 'USD', 0, 'Paid', 'Lord Harrison', 'Great repair work on the water heater!', datetime('now', '-17 hours'), datetime('now', '-17 hours'))
  `).run(tip2Id, hotelId, req3Id);

  db.prepare(`
    INSERT INTO tip_distributions (id, tip_id, staff_id, staff_amount, hotel_pool_amount, distribution_rule, created_at)
    VALUES (?, ?, 'staff-emp-102', 15.00, 0.00, '100_staff', datetime('now', '-17 hours'))
  `).run(uuidv4(), tip2Id);

  db.prepare(`
    INSERT INTO payments (
      id, transaction_id, provider, tip_id, amount, currency, status, idempotency_key, payment_token, checkout_url, raw_response, created_at, completed_at
    ) VALUES (?, ?, 'card', ?, 15.00, 'USD', 'Paid', ?, 'tok_card_mock_8822', 'https://square.com/checkout/mock', ?, datetime('now', '-17 hours'), datetime('now', '-17 hours'))
  `).run(uuidv4(), txn2Id, tip2Id, uuidv4(), JSON.stringify({ status: 'COMPLETED', card_brand: 'MASTERCARD', last_4: '8811' }));

  // 10. Default Settings
  const defaultSettings = [
    {
      category: 'branding',
      key: 'identity',
      value: {
        productName: 'ResortCare',
        subtitle: 'Smart Guest Service & Room Maintenance Platform',
        hotelName: 'Ocean Pearl Resort & Spa',
        resortName: 'Ocean Pearl Resort',
        logoUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&auto=format&fit=crop&q=80',
        primaryColor: '#0284c7',
        accentColor: '#c59b27',
        contactPhone: '+1 (305) 555-0100',
        emergencyPhone: '+1 (305) 555-0911',
        currency: 'USD',
        currencySymbol: '$',
        timezone: 'America/New_York',
        country: 'United States',
        defaultLang: 'en'
      }
    },
    {
      category: 'tips',
      key: 'distribution',
      value: {
        rule: '100_staff', // '100_staff' or 'split_ratio'
        staffPercent: 100,
        hotelPoolPercent: 0,
        presets: [5, 10, 20, 50],
        allowCustom: true
      }
    },
    {
      category: 'payments',
      key: 'gateway',
      value: {
        provider: 'square',
        environment: 'sandbox',
        applicationId: 'sandbox-sq0idb-oceanpearl-demo',
        accessToken: '',
        locationId: 'LOC_OCEAN_PEARL_MAIN',
        currency: 'USD',
        sandboxSimulatorEnabled: true
      }
    },
    {
      category: 'notifications',
      key: 'channels',
      value: {
        inAppSound: true,
        frontOfficeSound: true,
        technicianSound: true,
        emailEnabled: false,
        smsEnabled: false,
        whatsappEnabled: false
      }
    }
  ];

  for (const s of defaultSettings) {
    db.prepare(`
      INSERT INTO settings (id, hotel_id, category, key, value_json, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(uuidv4(), hotelId, s.category, s.key, JSON.stringify(s.value));
  }

  // 11. Initial Notifications
  db.prepare(`
    INSERT INTO notifications (id, hotel_id, target_role, title, message, type, link, created_at)
    VALUES (?, ?, 'Front Office Staff', 'New Maintenance Request', 'Room 101 reported AC not cooling (High Priority)', 'urgent', '/admin/maintenance', datetime('now', '-45 minutes'))
  `).run(uuidv4(), hotelId);

  // 12. Initial Audit Log
  db.prepare(`
    INSERT INTO audit_logs (id, hotel_id, user_name, action, entity, entity_id, details_json, created_at)
    VALUES (?, ?, 'System Seed', 'SYSTEM_INITIALIZED', 'system', 'seed', '{"status":"success","rooms":7,"staff":8}', datetime('now'))
  `).run(uuidv4(), hotelId);

  console.log('✅ ResortCare Database seeded successfully with realistic resort demo data!');
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
