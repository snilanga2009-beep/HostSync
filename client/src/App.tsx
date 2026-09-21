import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { NotificationProvider } from './context/NotificationContext';
import { LanguageProvider } from './context/LanguageContext';
import { ToastNotification } from './components/common/ToastNotification';
import { IncomingRequestModal } from './components/common/IncomingRequestModal';
import { AdminSidebar } from './components/layout/AdminSidebar';
import { AdminNavbar } from './components/layout/AdminNavbar';

// Guest Pages
import { GuestRoomHome } from './pages/guest/GuestRoomHome';
import { GuestTrackingView } from './pages/guest/GuestTrackingView';
import { GuestCheckoutView } from './pages/guest/GuestCheckoutView';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';

// Admin Pages
import { DashboardHome } from './pages/admin/DashboardHome';
import { RoomsPage } from './pages/admin/RoomsPage';
import { RoomTypesPage } from './pages/admin/RoomTypesPage';
import { RoomItemsPage } from './pages/admin/RoomItemsPage';
import { MaintenanceRequestsPage } from './pages/admin/MaintenanceRequestsPage';
import { GuestRequestsPage } from './pages/admin/GuestRequestsPage';
import { StaffManagementPage } from './pages/admin/StaffManagementPage';
import { QRBatchPrintPage } from './pages/admin/QRBatchPrintPage';
import { TipsManagementPage } from './pages/admin/TipsManagementPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { NotificationCenterPage } from './pages/admin/NotificationCenterPage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { FrontOfficePage } from './pages/admin/FrontOfficePage';

// Staff Pages
import { StaffTasksPage } from './pages/staff/StaffTasksPage';
import { StaffTipsPage } from './pages/staff/StaffTipsPage';
import { StaffJobMobilePage } from './pages/staff/StaffJobMobilePage';

// Navigation wrapper inside Router
const AdminLayout: React.FC<{ children: React.ReactNode; title: string }> = ({ children, title }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <AdminSidebar
        currentPath={location.pathname}
        onNavigate={(path) => navigate(path)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <AdminNavbar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          title={title}
          onNavigate={(path) => navigate(path)}
        />
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

// Staff mobile layout wrapper
const StaffLayout: React.FC<{ children: React.ReactNode; title: string }> = ({ children, title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="sticky top-0 z-30 bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between shadow-md">
        <div>
          <h1 className="text-sm font-extrabold">{title}</h1>
          <p className="text-[10px] text-brand-300">{user?.full_name} ({user?.job_title})</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/staff/tasks')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              location.pathname === '/staff/tasks' ? 'bg-brand-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            Tasks
          </button>
          <button
            onClick={() => navigate('/staff/tips')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              location.pathname === '/staff/tips' ? 'bg-rose-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            Tips
          </button>
          <button
            onClick={logout}
            className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-lg w-full mx-auto">
        {children}
      </main>
    </div>
  );
};

// Protected route gate
const RequireAuth: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user, loading, hasRole } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-xs text-slate-500">Checking authorization...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

// Root index redirector
const RootRedirect: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'Technician' || user.role === 'Room Service Boy' || user.role === 'Housekeeping Staff') {
    return <Navigate to="/staff/tasks" replace />;
  }
  return <Navigate to="/admin" replace />;
};

export function App() {
  return (
    <BrowserRouter>
      <BrandingProvider>
        <AuthProvider>
        <LanguageProvider>
          <NotificationProvider>
            <ToastNotification />
            <IncomingRequestModal />
            <Routes>
              {/* Root */}
              <Route path="/" element={<RootRedirect />} />

              {/* Guest In-Room Experience (No login required) */}
              <Route path="/guest/r/:token" element={<GuestRoomHome />} />
              <Route path="/guest/track/:token" element={<GuestTrackingView />} />
              <Route path="/guest/checkout/:transactionId" element={<GuestCheckoutView />} />

              {/* Staff Mobile Job Portal (No app install, loginless token link) */}
              <Route path="/job/:token" element={<StaffJobMobilePage />} />

              {/* Authentication */}
              <Route path="/login" element={<LoginPage />} />

              {/* Admin & Operations Routes */}
              <Route
                path="/admin"
                element={
                  <RequireAuth>
                    <AdminLayout title="Operations Dashboard">
                      <DashboardHome onNavigate={(p) => window.location.href = p} />
                    </AdminLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/front-office"
                element={
                  <RequireAuth allowedRoles={['Super Admin', 'Hotel Admin', 'Front Office Staff']}>
                    <AdminLayout title="Front Office Desk">
                      <FrontOfficePage />
                    </AdminLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <RequireAuth allowedRoles={['Super Admin', 'Hotel Admin']}>
                    <AdminLayout title="User & Admin Accounts">
                      <UserManagementPage />
                    </AdminLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/rooms"
                element={
                  <RequireAuth>
                    <AdminLayout title="Room Inventory & QR Keys">
                      <RoomsPage />
                    </AdminLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/room-types"
                element={
                  <RequireAuth>
                    <AdminLayout title="Room Categories & Types">
                      <RoomTypesPage />
                    </AdminLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/room-items"
                element={
                  <RequireAuth>
                    <AdminLayout title="Room Items & Condition">
                      <RoomItemsPage />
                    </AdminLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/maintenance"
                element={
                  <RequireAuth>
                    <AdminLayout title="Maintenance Dispatch Desk">
                      <MaintenanceRequestsPage />
                    </AdminLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/guest-requests"
                element={
                  <RequireAuth>
                    <AdminLayout title="Guest Supplies & Services">
                      <GuestRequestsPage />
                    </AdminLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/staff"
                element={
                  <RequireAuth>
                    <AdminLayout title="Staff Directory">
                      <StaffManagementPage />
                    </AdminLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/notifications-center"
                element={
                  <RequireAuth>
                    <AdminLayout title="Staff Mobile Notification Center">
                      <NotificationCenterPage />
                    </AdminLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/qr-sheets"
                element={
                  <RequireAuth>
                    <AdminLayout title="Batch Printable QR Key Sheets">
                      <QRBatchPrintPage />
                    </AdminLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/tips"
                element={
                  <RequireAuth>
                    <AdminLayout title="Staff Tips & Gratuities">
                      <TipsManagementPage />
                    </AdminLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/payments"
                element={
                  <RequireAuth>
                    <AdminLayout title="Payment Gateway Transactions">
                      <TipsManagementPage />
                    </AdminLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/reports"
                element={
                  <RequireAuth>
                    <AdminLayout title="Hospitality Reports & Diagnostics">
                      <ReportsPage />
                    </AdminLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/audit"
                element={
                  <RequireAuth>
                    <AdminLayout title="Security & Operational Audit Trail">
                      <AuditLogsPage />
                    </AdminLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <RequireAuth>
                    <AdminLayout title="System & Hotel Settings">
                      <SettingsPage />
                    </AdminLayout>
                  </RequireAuth>
                }
              />

              {/* Staff / Technician Portal */}
              <Route
                path="/staff/tasks"
                element={
                  <RequireAuth>
                    <StaffLayout title="My Assigned Tasks">
                      <StaffTasksPage />
                    </StaffLayout>
                  </RequireAuth>
                }
              />
              <Route
                path="/staff/tips"
                element={
                  <RequireAuth>
                    <StaffLayout title="My Tip Earnings">
                      <StaffTipsPage />
                    </StaffLayout>
                  </RequireAuth>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </NotificationProvider>
        </LanguageProvider>
      </AuthProvider>
      </BrandingProvider>
    </BrowserRouter>
  );
}

export default App;
