-- ResortCare Database Schema

PRAGMA foreign_keys = ON;

-- 1. Hotels
CREATE TABLE IF NOT EXISTS hotels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    resort_name TEXT,
    logo_url TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    currency TEXT DEFAULT 'USD',
    timezone TEXT DEFAULT 'America/New_York',
    country TEXT DEFAULT 'United States',
    default_lang TEXT DEFAULT 'en',
    emergency_contact TEXT,
    guest_service_contact TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Buildings
CREATE TABLE IF NOT EXISTS buildings (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

-- 3. Floors
CREATE TABLE IF NOT EXISTS floors (
    id TEXT PRIMARY KEY,
    building_id TEXT NOT NULL,
    floor_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
);

-- 4. Room Types
CREATE TABLE IF NOT EXISTS room_types (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    max_guests INTEGER DEFAULT 2,
    bed_count INTEGER DEFAULT 1,
    bed_type TEXT DEFAULT 'King',
    room_size_sqm REAL DEFAULT 35.0,
    base_price REAL DEFAULT 150.0,
    image_url TEXT,
    status TEXT DEFAULT 'active', -- active, inactive
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

-- 5. Rooms
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL,
    building_id TEXT,
    floor_id TEXT,
    room_type_id TEXT,
    room_number TEXT NOT NULL,
    name TEXT,
    room_status TEXT DEFAULT 'Available', -- Available, Occupied, Cleaning, Maintenance, Out of Service
    occupancy_status TEXT DEFAULT 'Vacant', -- Vacant, Occupied, Check-in, Check-out, Reserved
    guest_status TEXT DEFAULT 'None',
    qr_token TEXT UNIQUE NOT NULL,
    room_image TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE SET NULL,
    FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE SET NULL,
    FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE SET NULL
);

-- 6. Room Items Master Catalog
CREATE TABLE IF NOT EXISTS room_items (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- Electronics, Plumbing, Furniture, HVAC, Bathroom, Access, etc.
    icon TEXT DEFAULT 'wrench',
    default_description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

-- 7. Room Item Assignments (Facilities inside each room)
CREATE TABLE IF NOT EXISTS room_item_assignments (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    room_item_id TEXT NOT NULL,
    condition_status TEXT DEFAULT 'Working', -- Working, Not Working, Damaged, Missing, Needs Inspection, Under Maintenance, Replaced
    serial_number TEXT,
    install_date TEXT,
    warranty_date TEXT,
    last_maintenance_date TEXT,
    next_maintenance_date TEXT,
    notes TEXT,
    photos_json TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (room_item_id) REFERENCES room_items(id) ON DELETE CASCADE
);

-- 8. Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL, -- Super Admin, Hotel Admin, Front Office Staff, Maintenance Manager, Technician, Room Service Boy, Housekeeping Staff, Guest
    status TEXT DEFAULT 'active',
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

-- 9. Staff Profiles
CREATE TABLE IF NOT EXISTS staff_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    employee_id TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL, -- Maintenance, Room Service, Housekeeping, Front Desk
    job_title TEXT NOT NULL,
    phone TEXT,
    country_code TEXT DEFAULT '+1',
    whatsapp_number TEXT,
    whatsapp_available INTEGER DEFAULT 1,
    sms_enabled INTEGER DEFAULT 1,
    whatsapp_enabled INTEGER DEFAULT 1,
    preferred_channel TEXT DEFAULT 'whatsapp', -- sms, whatsapp
    fallback_enabled INTEGER DEFAULT 1,
    pin_code TEXT DEFAULT '1234',
    skills_json TEXT DEFAULT '[]',
    avatar_url TEXT,
    status TEXT DEFAULT 'available', -- available, busy, off_duty
    working_hours TEXT DEFAULT '08:00 - 17:00',
    rating REAL DEFAULT 5.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 10. QR Codes
CREATE TABLE IF NOT EXISTS qr_codes (
    id TEXT PRIMARY KEY,
    room_id TEXT UNIQUE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    qr_data_url TEXT,
    scans_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_scanned_at DATETIME,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- 11. Maintenance Requests
CREATE TABLE IF NOT EXISTS maintenance_requests (
    id TEXT PRIMARY KEY,
    request_code TEXT UNIQUE NOT NULL, -- e.g. RM-1024
    hotel_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    tracking_token TEXT UNIQUE NOT NULL,
    guest_name TEXT,
    guest_phone TEXT,
    priority TEXT DEFAULT 'Normal', -- Normal, High, Emergency
    urgency TEXT DEFAULT 'Normal',
    status TEXT DEFAULT 'Submitted', -- Submitted, Received, Assigned, Technician On The Way, Arrived, In Progress, Completed, Declined, Cancelled
    description TEXT,
    photos_json TEXT DEFAULT '[]',
    video_url TEXT,
    completion_notes TEXT,
    before_photos_json TEXT DEFAULT '[]',
    after_photos_json TEXT DEFAULT '[]',
    parts_used TEXT,
    repair_cost REAL DEFAULT 0,
    guest_signature_url TEXT,
    completed_by_staff_id TEXT,
    arrived_at DATETIME,
    started_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- 12. Maintenance Request Items (Specific items reported in request)
CREATE TABLE IF NOT EXISTS maintenance_request_items (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    room_item_assignment_id TEXT,
    item_name TEXT NOT NULL,
    problem_type TEXT NOT NULL, -- Not working, Broken, Damaged, Missing, Making noise, Not cooling, Not heating, Other
    notes TEXT,
    FOREIGN KEY (request_id) REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (room_item_assignment_id) REFERENCES room_item_assignments(id) ON DELETE SET NULL
);

-- 13. Guest Service Requests (Towels, Pillows, Water, Toiletries, etc.)
CREATE TABLE IF NOT EXISTS guest_service_requests (
    id TEXT PRIMARY KEY,
    request_code TEXT UNIQUE NOT NULL, -- e.g. GS-2045
    hotel_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    tracking_token TEXT UNIQUE NOT NULL,
    guest_name TEXT,
    guest_phone TEXT,
    service_type TEXT NOT NULL, -- Extra towels, Extra pillows, Drinking water, Toiletries, Room cleaning, Laundry, Food request, Baby items, Iron, Other
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    status TEXT DEFAULT 'Submitted', -- Submitted, Received, Assigned, In Progress, Delivered, Cancelled
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- 14. Request Status History (Timeline / Audit for maintenance requests)
CREATE TABLE IF NOT EXISTS request_status_history (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    status TEXT NOT NULL,
    changed_by_user_id TEXT,
    notes TEXT,
    photos_json TEXT DEFAULT '[]',
    parts_used TEXT,
    cost REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 15. Staff Assignments
CREATE TABLE IF NOT EXISTS staff_assignments (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    assigned_by_user_id TEXT,
    status TEXT DEFAULT 'Assigned', -- Assigned, Accepted, In Progress, Completed
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    notes TEXT,
    FOREIGN KEY (request_id) REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 16. Tips
CREATE TABLE IF NOT EXISTS tips (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    request_id TEXT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    custom_amount INTEGER DEFAULT 0, -- 1 if entered custom amount
    status TEXT DEFAULT 'Pending', -- Pending, Processing, Paid, Failed, Refunded, Cancelled
    guest_name TEXT,
    guest_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (request_id) REFERENCES maintenance_requests(id) ON DELETE SET NULL
);

-- 17. Tip Distributions
CREATE TABLE IF NOT EXISTS tip_distributions (
    id TEXT PRIMARY KEY,
    tip_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    staff_amount REAL NOT NULL,
    hotel_pool_amount REAL NOT NULL,
    distribution_rule TEXT NOT NULL, -- e.g. '100_staff' or '80_staff_20_hotel'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tip_id) REFERENCES tips(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE
);

-- 18. Payments
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    transaction_id TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL, -- square, card, sandbox
    tip_id TEXT UNIQUE NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'Pending', -- Pending, Processing, Paid, Failed, Refunded, Cancelled
    idempotency_key TEXT UNIQUE NOT NULL,
    payment_token TEXT,
    checkout_url TEXT,
    raw_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (tip_id) REFERENCES tips(id) ON DELETE CASCADE
);

-- 19. Payment Webhooks
CREATE TABLE IF NOT EXISTS payment_webhooks (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    event_id TEXT,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    signature TEXT,
    status TEXT DEFAULT 'processed', -- processed, ignored, error
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 20. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL,
    user_id TEXT, -- NULL if broadcast to role
    target_role TEXT, -- Front Office Staff, Technician, Housekeeping Staff, All
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- info, success, warning, urgent
    link TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 21. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    details_json TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 22. System Settings
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL,
    category TEXT NOT NULL, -- branding, payments, tips, notifications, maintenance
    key TEXT NOT NULL,
    value_json TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hotel_id, category, key),
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

-- 23. File Uploads
CREATE TABLE IF NOT EXISTS file_uploads (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    uploaded_by_user_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

-- 24. Secure Staff Job Tokens
CREATE TABLE IF NOT EXISTS job_tokens (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    request_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    hotel_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    is_revoked INTEGER DEFAULT 0,
    revoked_reason TEXT,
    last_accessed_at DATETIME,
    access_count INTEGER DEFAULT 0,
    device_info TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE
);

-- 25. Notification Logs (Delivery Tracking & Audit)
CREATE TABLE IF NOT EXISTS notification_logs (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    staff_id TEXT,
    channel TEXT NOT NULL, -- SMS, WhatsApp
    provider TEXT NOT NULL, -- Twilio, Simulator
    recipient TEXT NOT NULL,
    message_template TEXT,
    provider_message_id TEXT,
    status TEXT NOT NULL, -- QUEUED, SENDING, SENT, DELIVERED, FAILED, READ
    sent_at DATETIME,
    delivered_at DATETIME,
    failed_at DATETIME,
    error_code TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    fallback_used INTEGER DEFAULT 0,
    payload_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 26. Guest Notification Preferences & Consent
CREATE TABLE IF NOT EXISTS guest_notification_preferences (
    id TEXT PRIMARY KEY,
    tracking_token TEXT NOT NULL,
    room_id TEXT NOT NULL,
    phone TEXT,
    whatsapp_number TEXT,
    preferred_channel TEXT DEFAULT 'none', -- sms, whatsapp, none
    sms_enabled INTEGER DEFAULT 1,
    whatsapp_enabled INTEGER DEFAULT 1,
    notify_maintenance_updates INTEGER DEFAULT 1,
    notify_technician_arrival INTEGER DEFAULT 1,
    notify_job_completion INTEGER DEFAULT 1,
    notify_tip_receipt INTEGER DEFAULT 1,
    consent_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    consent_source TEXT DEFAULT 'guest_in_room_web',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimal lookup performance
CREATE INDEX IF NOT EXISTS idx_rooms_qr_token ON rooms(qr_token);
CREATE INDEX IF NOT EXISTS idx_rooms_hotel_status ON rooms(hotel_id, room_status);
CREATE INDEX IF NOT EXISTS idx_room_item_assignments_room ON room_item_assignments(room_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_room ON maintenance_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_tracking ON maintenance_requests(tracking_token);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_request ON staff_assignments(request_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_staff ON staff_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_tips_staff ON tips(staff_id);
CREATE INDEX IF NOT EXISTS idx_tips_status ON tips(status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_hotel_time ON audit_logs(hotel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_job_tokens_token ON job_tokens(token);
CREATE INDEX IF NOT EXISTS idx_job_tokens_request ON job_tokens(request_id);
CREATE INDEX IF NOT EXISTS idx_job_tokens_staff ON job_tokens(staff_id);
CREATE INDEX IF NOT EXISTS idx_notif_logs_job ON notification_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_notif_logs_staff ON notification_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_notif_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_guest_notif_prefs_token ON guest_notification_preferences(tracking_token);

