import { Router, Response } from 'express';
import { db } from '../db/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/reports/dashboard-kpi - High-level metrics for Front Office & Admin dashboards
router.get('/dashboard-kpi', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const totalRooms = db.prepare(`SELECT COUNT(*) as count FROM rooms`).get() as any;
    const occupiedRooms = db.prepare(`SELECT COUNT(*) as count FROM rooms WHERE occupancy_status = 'Occupied'`).get() as any;
    const availableRooms = db.prepare(`SELECT COUNT(*) as count FROM rooms WHERE room_status = 'Available'`).get() as any;
    const cleaningRooms = db.prepare(`SELECT COUNT(*) as count FROM rooms WHERE room_status = 'Cleaning'`).get() as any;
    const maintenanceRooms = db.prepare(`SELECT COUNT(*) as count FROM rooms WHERE room_status = 'Maintenance'`).get() as any;

    const openMaintenance = db.prepare(`SELECT COUNT(*) as count FROM maintenance_requests WHERE status NOT IN ('Completed', 'Cancelled')`).get() as any;
    const urgentRequests = db.prepare(`SELECT COUNT(*) as count FROM maintenance_requests WHERE priority IN ('High', 'Emergency') AND status NOT IN ('Completed', 'Cancelled')`).get() as any;
    const assignedRequests = db.prepare(`SELECT COUNT(*) as count FROM maintenance_requests WHERE status = 'Assigned'`).get() as any;
    const completedToday = db.prepare(`SELECT COUNT(*) as count FROM maintenance_requests WHERE status = 'Completed' AND date(resolved_at) = date('now')`).get() as any;
    const pendingGuestServices = db.prepare(`SELECT COUNT(*) as count FROM guest_service_requests WHERE status NOT IN ('Delivered', 'Cancelled')`).get() as any;

    const tipsToday = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM tips WHERE status = 'Paid' AND date(created_at) = date('now')`).get() as any;

    res.json({
      rooms: {
        total: totalRooms.count,
        occupied: occupiedRooms.count,
        available: availableRooms.count,
        cleaning: cleaningRooms.count,
        maintenance: maintenanceRooms.count
      },
      requests: {
        open: openMaintenance.count,
        urgent: urgentRequests.count,
        assigned: assignedRequests.count,
        completedToday: completedToday.count,
        pendingServices: pendingGuestServices.count
      },
      financials: {
        tipsToday: tipsToday.total
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/maintenance-analytics - Equipment breakdown, failure trends, cost analysis
router.get('/maintenance-analytics', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    // 1. Most reported equipment
    const mostReportedEquipment = db.prepare(`
      SELECT mri.item_name, COUNT(*) as report_count,
             COUNT(CASE WHEN mr.priority IN ('High', 'Emergency') THEN 1 END) as urgent_count
      FROM maintenance_request_items mri
      JOIN maintenance_requests mr ON mri.request_id = mr.id
      GROUP BY mri.item_name
      ORDER BY report_count DESC
      LIMIT 8
    `).all();

    // 2. Failure rate by category
    const problemsByType = db.prepare(`
      SELECT mri.problem_type, COUNT(*) as count
      FROM maintenance_request_items mri
      GROUP BY mri.problem_type
      ORDER BY count DESC
    `).all();

    // 3. Requests by day (last 7 days)
    const requestsByDay = db.prepare(`
      SELECT date(created_at) as request_date,
             COUNT(*) as total_requests,
             COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed_requests
      FROM maintenance_requests
      WHERE created_at >= date('now', '-7 days')
      GROUP BY date(created_at)
      ORDER BY request_date ASC
    `).all();

    // 4. Maintenance repair cost summary
    const costSummary = db.prepare(`
      SELECT COALESCE(SUM(cost), 0) as total_repair_cost,
             COUNT(CASE WHEN cost > 0 THEN 1 END) as jobs_with_cost
      FROM request_status_history
      WHERE cost > 0
    `).get() as any;

    res.json({
      mostReportedEquipment,
      problemsByType,
      requestsByDay,
      costSummary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/technician-performance - Staff completion rate & workload
router.get('/technician-performance', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const performance = db.prepare(`
      SELECT sp.id as staff_id, u.full_name, sp.job_title, sp.department, sp.rating,
             COUNT(sa.id) as total_assigned,
             COUNT(CASE WHEN sa.status = 'Completed' THEN 1 END) as completed_tasks,
             COALESCE(SUM(td.staff_amount), 0) as total_tips_earned
      FROM staff_profiles sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN staff_assignments sa ON sa.staff_id = sp.id
      LEFT JOIN tip_distributions td ON td.staff_id = sp.id
      WHERE sp.department IN ('Maintenance', 'Room Service', 'Housekeeping')
      GROUP BY sp.id
      ORDER BY completed_tasks DESC
    `).all();

    res.json({ performance });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/export-csv - Generate downloadable CSV report
router.get('/export-csv', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.query; // 'requests' or 'tips'

    if (type === 'tips') {
      const rows = db.prepare(`
        SELECT t.id, t.created_at, r.room_number, u.full_name as staff_name,
               t.amount, t.currency, t.status, p.transaction_id, td.staff_amount, td.hotel_pool_amount
        FROM tips t
        JOIN rooms r ON t.room_id = r.id
        JOIN staff_profiles sp ON t.staff_id = sp.id
        JOIN users u ON sp.user_id = u.id
        LEFT JOIN payments p ON p.tip_id = t.id
        LEFT JOIN tip_distributions td ON td.tip_id = t.id
        ORDER BY t.created_at DESC
      `).all() as any[];

      let csv = 'Tip ID,Date,Room Number,Staff Name,Amount,Currency,Status,Transaction ID,Staff Payout,Hotel Pool\n';
      rows.forEach(r => {
        csv += `"${r.id}","${r.created_at}","${r.room_number}","${r.staff_name}",${r.amount},"${r.currency}","${r.status}","${r.transaction_id || ''}",${r.staff_amount || 0},${r.hotel_pool_amount || 0}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="resortcare-tips-report.csv"');
      return res.send(csv);
    }

    // Default: Maintenance requests
    const rows = db.prepare(`
      SELECT mr.request_code, mr.created_at, r.room_number, mr.priority, mr.urgency, mr.status,
             mr.guest_name, mr.description, mr.resolved_at,
             u.full_name as assigned_staff
      FROM maintenance_requests mr
      JOIN rooms r ON mr.room_id = r.id
      LEFT JOIN staff_assignments sa ON sa.request_id = mr.id AND sa.status != 'Cancelled'
      LEFT JOIN staff_profiles sp ON sa.staff_id = sp.id
      LEFT JOIN users u ON sp.user_id = u.id
      ORDER BY mr.created_at DESC
    `).all() as any[];

    let csv = 'Request Code,Date,Room Number,Priority,Urgency,Status,Guest Name,Description,Assigned Staff,Resolved Date\n';
    rows.forEach(r => {
      csv += `"${r.request_code}","${r.created_at}","${r.room_number}","${r.priority}","${r.urgency}","${r.status}","${r.guest_name || ''}","${(r.description || '').replace(/"/g, '""')}","${r.assigned_staff || 'Unassigned'}","${r.resolved_at || ''}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="resortcare-maintenance-report.csv"');
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/executive-summary - Comprehensive aggregated operational report
router.get('/executive-summary', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as string) || 'all';

    const getTimeFilter = (field: string) => {
      if (timeframe === 'today') return `date(${field}) = date('now')`;
      if (timeframe === 'week') return `${field} >= datetime('now', '-7 days')`;
      if (timeframe === 'month') return `${field} >= datetime('now', '-30 days')`;
      return '1=1';
    };

    const mrFilter = getTimeFilter('mr.created_at');
    const mFilter = getTimeFilter('created_at');
    const gsFilter = getTimeFilter('created_at');
    const tipFilter = getTimeFilter('created_at');

    // 1. Maintenance Requests Overview
    const maintenance = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status IN ('Submitted', 'Received', 'Assigned', 'In Progress') THEN 1 END) as pending,
        COUNT(CASE WHEN priority IN ('High', 'Emergency') THEN 1 END) as urgent,
        COALESCE(SUM(repair_cost), 0) as total_repair_cost,
        AVG(CASE WHEN status = 'Completed' AND resolved_at IS NOT NULL 
            THEN (strftime('%s', resolved_at) - strftime('%s', created_at)) / 60 
            ELSE NULL END) as avg_turnaround_minutes
      FROM maintenance_requests
      WHERE ${mFilter}
    `).get() as any;

    // 2. Guest Services Overview
    const services = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'Delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status IN ('Submitted', 'Received', 'Assigned', 'In Progress') THEN 1 END) as pending
      FROM guest_service_requests
      WHERE ${gsFilter}
    `).get() as any;

    // 3. Tips Financials
    const tips = db.prepare(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) as total_count,
        COALESCE(AVG(amount), 0) as avg_amount
      FROM tips
      WHERE status = 'Paid' AND ${tipFilter}
    `).get() as any;

    // 4. Room Occupancy & Inventory Health
    const rooms = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN occupancy_status = 'Occupied' THEN 1 END) as occupied,
        COUNT(CASE WHEN room_status = 'Available' THEN 1 END) as available,
        COUNT(CASE WHEN room_status = 'Maintenance' THEN 1 END) as maintenance,
        COUNT(CASE WHEN room_status = 'Cleaning' THEN 1 END) as cleaning
      FROM rooms
    `).get() as any;

    // 5. Top Reported Equipment Issues
    const topEquipment = db.prepare(`
      SELECT mri.item_name, COUNT(*) as report_count,
             COUNT(CASE WHEN mr.priority IN ('High', 'Emergency') THEN 1 END) as urgent_count
      FROM maintenance_request_items mri
      JOIN maintenance_requests mr ON mri.request_id = mr.id
      WHERE ${mrFilter}
      GROUP BY mri.item_name
      ORDER BY report_count DESC
      LIMIT 6
    `).all();

    // 6. Top Requested Guest Services
    const topServices = db.prepare(`
      SELECT service_type, COUNT(*) as request_count, SUM(quantity) as total_units
      FROM guest_service_requests
      WHERE ${gsFilter}
      GROUP BY service_type
      ORDER BY request_count DESC
      LIMIT 6
    `).all();

    // 7. Staff Performance Leaderboard
    const topStaff = db.prepare(`
      SELECT sp.id as staff_id, u.full_name, sp.job_title, sp.department, sp.rating, sp.avatar_url,
             COUNT(sa.id) as total_assigned,
             COUNT(CASE WHEN sa.status = 'Completed' THEN 1 END) as completed_tasks,
             COALESCE((SELECT SUM(staff_amount) FROM tip_distributions WHERE staff_id = sp.id), 0) as total_tips_earned
      FROM staff_profiles sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN staff_assignments sa ON sa.staff_id = sp.id
      GROUP BY sp.id
      ORDER BY completed_tasks DESC
      LIMIT 8
    `).all();

    // Aggregates
    const totalDispatches = (maintenance.total || 0) + (services.total || 0);
    const totalResolved = (maintenance.completed || 0) + (services.delivered || 0);
    const resolutionRate = totalDispatches > 0 ? Math.round((totalResolved / totalDispatches) * 100) : 100;

    res.json({
      timeframe,
      summary: {
        totalDispatches,
        totalResolved,
        resolutionRate,
        maintenance: {
          total: maintenance.total || 0,
          completed: maintenance.completed || 0,
          pending: maintenance.pending || 0,
          urgent: maintenance.urgent || 0,
          totalRepairCost: Number(maintenance.total_repair_cost || 0),
          avgTurnaroundMinutes: Math.round(maintenance.avg_turnaround_minutes || 0)
        },
        services: {
          total: services.total || 0,
          delivered: services.delivered || 0,
          pending: services.pending || 0
        },
        tips: {
          totalAmount: Number(tips.total_amount || 0),
          totalCount: tips.total_count || 0,
          avgAmount: Number(tips.avg_amount || 0).toFixed(2)
        },
        rooms: {
          total: rooms.total || 0,
          occupied: rooms.occupied || 0,
          available: rooms.available || 0,
          maintenance: rooms.maintenance || 0,
          cleaning: rooms.cleaning || 0,
          occupancyRate: rooms.total > 0 ? Math.round((rooms.occupied / rooms.total) * 100) : 0
        }
      },
      topEquipment,
      topServices,
      topStaff
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
