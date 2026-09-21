export interface User {
  id: string;
  hotel_id: string;
  email: string;
  full_name: string;
  role: string;
  staff_id?: string;
  department?: string;
  job_title?: string;
  avatar_url?: string;
}

export interface Hotel {
  id: string;
  name: string;
  resort_name?: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  currency: string;
  timezone: string;
  country: string;
  default_lang: string;
  emergency_contact?: string;
  guest_service_contact?: string;
}

export interface Building {
  id: string;
  hotel_id: string;
  name: string;
  code?: string;
  floors?: Floor[];
}

export interface Floor {
  id: string;
  building_id: string;
  floor_number: number;
  name: string;
}

export interface RoomType {
  id: string;
  name: string;
  code: string;
  description?: string;
  max_guests: number;
  bed_count: number;
  bed_type: string;
  room_size_sqm: number;
  base_price: number;
  image_url?: string;
  status: 'active' | 'inactive';
}

export interface Room {
  id: string;
  hotel_id: string;
  building_id?: string;
  floor_id?: string;
  room_type_id?: string;
  room_number: string;
  name?: string;
  room_status: 'Available' | 'Occupied' | 'Cleaning' | 'Maintenance' | 'Out of Service';
  occupancy_status: 'Vacant' | 'Occupied' | 'Check-in' | 'Check-out' | 'Reserved';
  guest_status?: string;
  qr_token: string;
  room_image?: string;
  notes?: string;
  room_type_name?: string;
  room_type_code?: string;
  base_price?: number;
  building_name?: string;
  floor_name?: string;
  floor_number?: number;
  qr_scans?: number;
  qr_active?: number;
  qr_data_url?: string;
  total_items?: number;
  damaged_items?: number;
  open_requests?: number;
}

export interface RoomItemCatalog {
  id: string;
  name: string;
  category: string;
  icon: string;
  default_description?: string;
  assigned_rooms_count?: number;
  maintenance_needed_count?: number;
}

export interface RoomItemAssignment {
  id: string;
  room_id: string;
  room_item_id: string;
  condition_status: 'Working' | 'Not Working' | 'Damaged' | 'Missing' | 'Needs Inspection' | 'Under Maintenance' | 'Replaced';
  serial_number?: string;
  install_date?: string;
  warranty_date?: string;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  notes?: string;
  photos_json?: string;
  item_name?: string;
  item_category?: string;
  item_icon?: string;
}

export interface MaintenanceRequest {
  id: string;
  request_code: string;
  hotel_id: string;
  room_id: string;
  tracking_token: string;
  guest_name?: string;
  guest_phone?: string;
  priority: 'Normal' | 'High' | 'Emergency';
  urgency: 'Normal' | 'High' | 'Emergency';
  status: 'Submitted' | 'Received' | 'Assigned' | 'Technician On The Way' | 'In Progress' | 'Completed' | 'Cancelled';
  description?: string;
  photos_json?: string;
  video_url?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  room_number?: string;
  room_name?: string;
  building_name?: string;
  floor_name?: string;
  assigned_staff_name?: string;
  assigned_staff_title?: string;
  assigned_staff_avatar?: string;
  reported_items_summary?: string;
  latest_job_token?: string;
  latest_notif_status?: string;
  latest_notif_channel?: string;
}

export interface GuestServiceRequest {
  id: string;
  request_code: string;
  hotel_id: string;
  room_id: string;
  tracking_token: string;
  guest_name?: string;
  guest_phone?: string;
  service_type: string;
  quantity: number;
  notes?: string;
  status: 'Submitted' | 'Received' | 'Assigned' | 'In Progress' | 'Delivered' | 'Cancelled';
  created_at: string;
  room_number?: string;
  room_name?: string;
}

export interface StaffProfile {
  id: string;
  user_id: string;
  employee_id: string;
  department: string;
  job_title: string;
  phone?: string;
  country_code?: string;
  whatsapp_number?: string;
  whatsapp_available?: number;
  sms_enabled?: number;
  whatsapp_enabled?: number;
  preferred_channel?: 'sms' | 'whatsapp' | 'both';
  fallback_enabled?: number;
  pin_code?: string;
  skills_json?: string;
  avatar_url?: string;
  status: 'available' | 'busy' | 'off_duty';
  working_hours?: string;
  rating?: number;
  full_name?: string;
  email?: string;
  role?: string;
  active_tasks_count?: number;
  total_tips_earned?: number;
}

export interface Tip {
  id: string;
  hotel_id: string;
  room_id: string;
  staff_id: string;
  request_id?: string;
  amount: number;
  currency: string;
  custom_amount: number;
  status: 'Pending' | 'Processing' | 'Paid' | 'Failed' | 'Refunded' | 'Cancelled';
  guest_name?: string;
  guest_message?: string;
  created_at: string;
  completed_at?: string;
  room_number?: string;
  staff_name?: string;
  staff_title?: string;
  transaction_id?: string;
  staff_amount?: number;
  hotel_pool_amount?: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'urgent';
  link?: string;
  is_read: number;
  created_at: string;
}
