export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateShort(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return `${formatDateShort(iso)}, ${formatTime(iso)}`;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function minutesUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 60000);
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSeconds = Math.floor((Date.now() - then) / 1000);
  if (diffSeconds < 60) return 'Just now';
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateShort(iso);
}

export type AttendanceStatus = 'present' | 'late' | 'absent';

const GRACE_MINUTES = 5;

export function computeAttendanceStatus(
  scannedAt: string,
  eventStart?: string | null
): AttendanceStatus {
  if (!eventStart) return 'present';
  const scanned = new Date(scannedAt).getTime();
  const start = new Date(eventStart).getTime();
  if (Number.isNaN(scanned) || Number.isNaN(start)) return 'present';
  return scanned - start > GRACE_MINUTES * 60 * 1000 ? 'late' : 'present';
}

export type EventPhase = 'upcoming' | 'live' | 'ended' | 'closed';

export function getEventPhase(event: {
  start_time?: string | null;
  end_time?: string | null;
  status?: string | null;
}): EventPhase {
  if (event.status === 'closed') return 'closed';
  const now = Date.now();
  const start = event.start_time ? new Date(event.start_time).getTime() : null;
  const end = event.end_time ? new Date(event.end_time).getTime() : null;
  if (end !== null && now > end) return 'ended';
  if (start !== null && now < start) return 'upcoming';
  return 'live';
}
