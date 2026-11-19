import { parseDateTime } from './utils.js';

/**
 * Combines manual reminders + auto-synced reminders from Bookings & Deadlines in Công việc
 */
export function buildAllReminders(state) {
  const list = [];

  // 1. Manual reminders
  for (const r of state?.reminders || []) {
    const triggerAt = parseDateTime(r.date, r.time || '09:00');
    list.push({
      ...r,
      source: 'manual',
      triggerAt
    });
  }

  // 2. Auto-synced from Công việc (Bookings & Deadlines with date + time + remindBefore >= 0)
  for (const t of state?.tasks || []) {
    if (t.status === 'done') continue;
    if (!t.date || !t.time) continue;
    const remindMins = Number(t.remindBefore ?? 30);
    if (remindMins < 0) continue;

    const isAutoEligible = t.type === 'booking' || t.isDeadline || remindMins > 0;
    if (!isAutoEligible) continue;

    const eventTime = parseDateTime(t.date, t.time);
    if (!eventTime) continue;

    const triggerAt = new Date(eventTime.getTime() - remindMins * 60000);
    const labelLead = remindMins === 0
      ? 'Đúng giờ'
      : remindMins >= 1440
        ? `Trước ${Math.round(remindMins / 1440)} ngày`
        : remindMins >= 60
          ? `Trước ${Math.round(remindMins / 60)} giờ`
          : `Trước ${remindMins} phút`;

    list.push({
      id: `auto_${t.id}`,
      linkedTaskId: t.id,
      source: t.type === 'booking' ? 'booking' : t.isDeadline ? 'deadline' : 'task',
      title: t.type === 'booking' ? `Booking: ${t.title}` : t.isDeadline ? `Deadline: ${t.title}` : t.title,
      notes: `${t.client ? t.client + ' • ' : ''}Giờ hẹn ${t.time} (${labelLead})`,
      date: t.date,
      time: `${String(triggerAt.getHours()).padStart(2, '0')}:${String(triggerAt.getMinutes()).padStart(2, '0')}`,
      eventTimeStr: t.time,
      priority: t.type === 'booking' || t.isDeadline ? 'high' : 'medium',
      repeat: 'none',
      completed: false,
      triggerAt
    });
  }

  return list.sort((a, b) => {
    const ta = a.triggerAt ? a.triggerAt.getTime() : 0;
    const tb = b.triggerAt ? b.triggerAt.getTime() : 0;
    return ta - tb;
  });
}

class InAppReminderManager {
  constructor() {
    this.firedIds = new Set();
    this._watcher = null;
  }

  async init() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch {
        // Ignore on unsupported origins
      }
    }
  }

  startWatcher(getState, onTrigger) {
    if (this._watcher) clearInterval(this._watcher);
    const checkDue = () => {
      const state = getState();
      if (!state) return;
      const all = buildAllReminders(state);
      const now = Date.now();
      for (const r of all) {
        if (r.completed || !r.triggerAt) continue;
        const diff = now - r.triggerAt.getTime();
        const key = `${r.id}_${r.triggerAt.toISOString()}`;
        if (diff >= 0 && diff < 60_000 && !this.firedIds.has(key)) {
          this.firedIds.add(key);
          onTrigger?.(r);
        }
      }
    };
    this._watcher = setInterval(checkDue, 20_000);
  }

  stopWatcher() {
    if (this._watcher) {
      clearInterval(this._watcher);
      this._watcher = null;
    }
    this.firedIds.clear();
  }
}

export const notifications = new InAppReminderManager();
