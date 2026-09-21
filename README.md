# HostSync - Smart Guest Service & Room Maintenance Platform
*Operational & Sleek*

> Production-ready, responsive web-based Hotel & Resort Room Maintenance, Guest Service, Staff Assignment, and Staff Tip Management System.

---

## 🌟 Executive Summary

**ResortCare** is a hospitality operations platform designed for luxury resorts, boutique hotels, and hotel chains. It connects in-room guests directly to the hotel's front office and maintenance engineering staff through secure in-room QR codes, eliminating phone waits and service friction.

- **Guest Mobile-First Portal**: In-room QR code scan auto-identifies Hotel, Building, Floor, Room Number, and room-specific equipment without requiring guest account creation.
- **Front Office Dispatch Desk**: Live operations dashboard with instant sound and toast notifications, request filtering, and one-click staff assignment.
- **Technician & Staff Mobile Workflow**: Mobile task execution view with status lifecycle (`Assigned` → `Accepted` → `On The Way` → `Arrived` → `Working` → `Completed`), replacement parts tracking, and repair cost logging.
- **Staff Tipping & Payment Gateway Architecture**: Integrated with the Square Checkout and Payments API architecture (hosted checkout links, idempotency keys, and webhook signature verification) alongside an interactive Sandbox Simulator. Configurable tip distribution rules (100% staff payout or custom split ratio).
- **Printable QR Sheet Generator**: One-click batch generation of high-resolution in-room QR cards formatted with hotel branding for cardstock or tent cards.
- **Reports & Operational Diagnostics**: Equipment failure frequency analysis, repair expenditure tracking, technician response metrics, and CSV exports.

---

## 🏗 System Architecture

```
hotel-QR/
├── client/                     # React 18 + Vite + Tailwind CSS + Lucide Icons SPA
│   ├── public/manifest.json    # PWA web manifest
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/         # StatusBadge, PriorityBadge, Modal, ImageUploader, QRPreviewModal
│   │   │   └── layout/         # AdminSidebar, AdminNavbar
│   │   ├── context/            # AuthContext (RBAC), NotificationContext (SSE + Web Audio), LanguageContext (i18n)
│   │   ├── pages/
│   │   │   ├── guest/          # GuestRoomHome, GuestMaintenanceModal, GuestServiceModal, GuestTrackingView, GuestCheckoutView
│   │   │   ├── admin/          # Dashboard, Rooms, RoomTypes, RoomItems, Maintenance, GuestRequests, Staff, QRSheets, Tips, Reports, Audit, Settings
│   │   │   ├── staff/          # StaffTasksPage, StaffTipsPage
│   │   │   └── auth/           # LoginPage
│   │   └── services/           # Centralized API client
├── server/                     # Express + TypeScript + SQLite REST Backend
│   ├── src/
│   │   ├── config.ts           # Central configuration & Square credentials
│   │   ├── db/
│   │   │   ├── schema.sql      # Strict relational schema with foreign keys and indexes
│   │   │   ├── database.ts     # SQLite connection with WAL mode
│   │   │   └── seed.ts         # Realistic Ocean Pearl Resort demo data
│   │   ├── middleware/         # JWT Auth, RBAC, Multer upload, Audit logger
│   │   ├── routes/             # Modular REST endpoints
│   │   └── services/           # QR code generation, SSE stream hub, Payment & Tipping engine
│   └── tests/
│       └── verify.ts           # 22-step automated end-to-end test suite
```

---

## 👥 User Roles & Demo Credentials

All test accounts use password: `password123`

| Role | Email | Name | Default Landing |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@oceanpearl.com` | Alexander Vance | Operations Dashboard (`/admin`) |
| **Hotel Admin** | `manager@oceanpearl.com` | Elena Rostova | Operations Dashboard (`/admin`) |
| **Front Office Staff** | `frontdesk@oceanpearl.com` | Chloe Bennett | Maintenance Dispatch (`/admin/maintenance`) |
| **Technician (HVAC/Elec)** | `david@oceanpearl.com` | David Fernando | Mobile Task Portal (`/staff/tasks`) |
| **Technician (Plumbing)** | `michael@oceanpearl.com` | Michael Perera | Mobile Task Portal (`/staff/tasks`) |
| **Room Service Boy** | `john@oceanpearl.com` | John Silva | Mobile Task Portal (`/staff/tasks`) |
| **Housekeeping Staff** | `sarah@oceanpearl.com` | Sarah Jenkins | Mobile Task Portal (`/staff/tasks`) |
| **Guest** | *No login needed* | In-Room Guest | `/guest/r/ocean101token` |

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
# In project root
npm install
npm install --prefix server
npm install --prefix client
```

### 2. Seed Database
Initializes SQLite database (`data/resortcare.db`) with Ocean Pearl Resort rooms, room items, staff profiles, and sample requests:
```bash
npm run seed
```

### 3. Run Development Servers
Starts backend API on `http://localhost:5000` and Vite client on `http://localhost:5173`:
```bash
npm run dev
```

### 4. Run Automated End-to-End Verification Test
Executes the comprehensive 22-step test suite covering auth, room resolution, maintenance requests, staff assignment, technician status transitions, tipping, and payment webhooks:
```bash
npm run verify
```

---

## 📱 Core User Journeys

### 1. In-Room Guest QR Flow
1. Guest scans QR code located in room: opens `/guest/r/ocean101token`.
2. Room 101, building (Main Coral Wing), floor, and room items automatically resolve.
3. Guest clicks **Room Maintenance** → selects **Air Conditioner** → chooses issue **Not cooling** → submits.
4. Guest receives tracking number (e.g. `RM-1025`) and tracks real-time progress at `/guest/track/:token`.

### 2. Front Office Dispatch
1. Front desk supervisor logs in (`frontdesk@oceanpearl.com`).
2. Instant sound chime and notification alert announce the new request.
3. Front desk opens request and clicks **Assign** → selects **David Fernando (Senior HVAC Technician)**.
4. Real-time push updates the technician's phone and the guest's tracking timeline.

### 3. Technician Mobile Execution
1. Technician David opens task on `/staff/tasks`.
2. Clicks `[Accept Task]` → `[On The Way]` → `[Arrived & Start Work]`.
3. Repairs the AC, enters parts replaced (`Freon R410A`), cost (`$45.00`), and work notes.
4. Clicks `[Complete Maintenance]`. Front Office is notified and room status resets to Available.

### 4. Guest Rating & Staff Tipping
1. Guest tracking view automatically displays **Maintenance Completed!**
2. Guest gives a 5-star rating and clicks **Tip Our Staff**.
3. Selects technician David Fernando → chooses tip amount ($20) → proceeds to hosted Square checkout.
4. Sandbox payment simulator confirms transaction → Webhook validates payment → Tip is marked **Paid** and credited to David Fernando's tip ledger.

---

## 🔒 Security & Architecture Standards
- **Token Security**: Cryptographic random tokens (`uuidv4`) for in-room QR codes; internal database IDs are never exposed in guest URLs.
- **Payment Security**: Strict server-side secret management. Secrets are never exposed to client-side bundles. Payments are only confirmed after verified webhook confirmation.
- **Idempotency**: All payment transactions require idempotency keys to eliminate duplicate billing.
- **Database Integrity**: Full foreign key enforcement (`PRAGMA foreign_keys = ON;`) and Write-Ahead Logging (`PRAGMA journal_mode = WAL;`) for high concurrency.
- **Audit Trails**: Security audit logger tracks user logins, room creations, dispatches, status transitions, and payments.
>>>>>>> acb7b4c (HostSync platform initial release)
