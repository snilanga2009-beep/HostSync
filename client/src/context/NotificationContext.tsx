import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { NotificationItem } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

export interface NewIssuePopupData {
  requestId: string | number;
  requestCode: string;
  roomNumber: string;
  category: string;
  description: string;
  guestName?: string;
  guestPhone?: string;
  priority?: string;
  type: 'maintenance' | 'service';
  createdAt?: string;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  activeAlert: { title: string; message: string; type: string } | null;
  dismissAlert: () => void;
  bigIssuePopup: NewIssuePopupData | null;
  dismissBigIssuePopup: () => void;
  playAlertSound: (isEmergency?: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Web Audio API chime sound generator (Guaranteed cross-platform, zero external file dependency)
let sharedAudioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        sharedAudioCtx = new AudioContextClass();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch (e) {
    return null;
  }
}

// Unlock audio context on user gesture to comply with browser autoplay policies
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'running') {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    }
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}

export function playHotelAlertSound(isEmergency: boolean = false) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const playTone = (freq: number, startTime: number, duration: number, type: OscillatorType = 'sine', peakGain: number = 0.25) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const t = ctx.currentTime;
    if (isEmergency) {
      // Rapid urgent alert pings
      playTone(880, t, 0.15, 'triangle', 0.3);
      playTone(1320, t + 0.1, 0.2, 'triangle', 0.35);
      playTone(880, t + 0.25, 0.15, 'triangle', 0.3);
      playTone(1320, t + 0.35, 0.35, 'triangle', 0.35);
    } else {
      // Four-tone ascending hotel concierge chime (C5, E5, G5, C6)
      playTone(523.25, t, 0.22, 'sine', 0.25);
      playTone(659.25, t + 0.12, 0.22, 'sine', 0.25);
      playTone(783.99, t + 0.24, 0.25, 'sine', 0.3);
      playTone(1046.5, t + 0.36, 0.5, 'sine', 0.35);
    }
  } catch (e) {
    console.warn('Could not play alert audio', e);
  }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [activeAlert, setActiveAlert] = useState<{ title: string; message: string; type: string } | null>(null);
  const [bigIssuePopup, setBigIssuePopup] = useState<NewIssuePopupData | null>(null);

  const playAlertSound = useCallback((isEmergency: boolean = false) => {
    if (soundEnabled) {
      playHotelAlertSound(isEmergency);
    }
  }, [soundEnabled]);

  const refreshNotifications = async () => {
    if (!token) return;
    try {
      const res = await api.get<{ notifications: NotificationItem[]; unreadCount: number }>('/notifications');
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (e) {
      // Background poll
    }
  };

  useEffect(() => {
    refreshNotifications();
  }, [token]);

  // Connect to SSE stream for real-time push updates
  useEffect(() => {
    if (!token) return;

    const apiBase = (import.meta.env.VITE_API_BASE as string || '/api').replace(/\/api\/?$/, '');
    const sseUrl = `${apiBase}/api/sse/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.addEventListener('NEW_MAINTENANCE_REQUEST', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const isEmerg =
          data.priority?.toLowerCase() === 'emergency' ||
          data.priority?.toLowerCase() === 'urgent' ||
          data.priority?.toLowerCase() === 'high';

        if (soundEnabled) {
          playHotelAlertSound(isEmerg);
        }

        // Trigger the Big Modal Popup
        setBigIssuePopup({
          requestId: data.requestId || data.id,
          requestCode: data.requestCode || `REQ-${data.roomNumber || ''}`,
          roomNumber: data.roomNumber || 'Unknown',
          category: data.category || 'Maintenance',
          description: data.description || 'Maintenance issue reported by guest',
          guestName: data.guestName || 'In-Room Guest',
          guestPhone: data.guestPhone || '',
          priority: data.priority || 'Normal',
          type: 'maintenance',
          createdAt: data.createdAt || new Date().toISOString()
        });

        setActiveAlert({
          title: `Room ${data.roomNumber}: Maintenance Alert`,
          message: `${data.category || 'Issue'}: ${data.description || 'Guest submitted a report'}`,
          type: isEmerg ? 'urgent' : 'warning'
        });

        // Broadcast DOM event for instant reactive update in Desk and Dashboard
        window.dispatchEvent(new CustomEvent('hotel_new_request', { detail: { type: 'maintenance', data } }));
        refreshNotifications();
      } catch (err) {
        console.error('Error handling NEW_MAINTENANCE_REQUEST:', err);
      }
    });

    eventSource.addEventListener('NEW_GUEST_SERVICE_REQUEST', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const isEmerg =
          data.priority?.toLowerCase() === 'emergency' ||
          data.priority?.toLowerCase() === 'urgent';

        if (soundEnabled) {
          playHotelAlertSound(isEmerg);
        }

        // Trigger the Big Modal Popup
        setBigIssuePopup({
          requestId: data.requestId || data.id,
          requestCode: data.requestCode || `SRV-${data.roomNumber || ''}`,
          roomNumber: data.roomNumber || 'Unknown',
          category: data.category || 'Room Service',
          description: data.description || 'Guest service / amenities requested',
          guestName: data.guestName || 'In-Room Guest',
          guestPhone: data.guestPhone || '',
          priority: data.priority || 'Normal',
          type: 'service',
          createdAt: data.createdAt || new Date().toISOString()
        });

        setActiveAlert({
          title: `Room ${data.roomNumber}: Service Request`,
          message: `${data.category || 'Service'}: ${data.description || 'Requested by guest'}`,
          type: isEmerg ? 'urgent' : 'info'
        });

        // Broadcast DOM event for instant reactive update in Desk and Dashboard
        window.dispatchEvent(new CustomEvent('hotel_new_request', { detail: { type: 'service', data } }));
        refreshNotifications();
      } catch (err) {
        console.error('Error handling NEW_GUEST_SERVICE_REQUEST:', err);
      }
    });

    eventSource.addEventListener('TASK_ASSIGNED', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (soundEnabled) playHotelAlertSound(false);
        setActiveAlert({
          title: `New Task Assigned: Room ${data.roomNumber}`,
          message: `${data.priority || 'Normal'} Priority task assigned.`,
          type: 'info'
        });
        window.dispatchEvent(new CustomEvent('hotel_new_request', { detail: { type: 'task_assigned', data } }));
        refreshNotifications();
      } catch (err) {}
    });

    eventSource.addEventListener('REQUEST_STATUS_CHANGED', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.status === 'Completed' && soundEnabled) playHotelAlertSound(false);
        window.dispatchEvent(new CustomEvent('hotel_new_request', { detail: { type: 'status_changed', data } }));
        refreshNotifications();
      } catch (err) {}
    });

    eventSource.addEventListener('PAYMENT_CONFIRMED', () => {
      try {
        if (soundEnabled) playHotelAlertSound(false);
        window.dispatchEvent(new CustomEvent('hotel_new_request', { detail: { type: 'payment' } }));
        refreshNotifications();
      } catch (err) {}
    });

    return () => {
      eventSource.close();
    };
  }, [token, soundEnabled]);

  const markAsRead = async (id: string) => {
    await api.put(`/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    await api.put('/notifications/read/all');
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
  };

  const dismissAlert = () => setActiveAlert(null);
  const dismissBigIssuePopup = () => setBigIssuePopup(null);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        soundEnabled,
        setSoundEnabled,
        markAsRead,
        markAllAsRead,
        refreshNotifications,
        activeAlert,
        dismissAlert,
        bigIssuePopup,
        dismissBigIssuePopup,
        playAlertSound
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};
