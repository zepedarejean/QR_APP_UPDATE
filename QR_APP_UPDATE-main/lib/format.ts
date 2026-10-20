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

/** How many minutes after the start a student is still "present". */
export const DEFAULT_GRACE_MINUTES = 5;

/** Within this many seconds of the cutoff a student is "almost late". */
export const ALMOST_LATE_SECONDS = 60;

export type AttendanceEvaluation = {
  status: 'present' | 'late';
  /** How far past the grace cutoff the scan was, in seconds (0 = on time). */
  lateBySeconds: number;
  /** True when the student cut it very close (last minute before the cutoff). */
  almostLate: boolean;
  /** Seconds left until the student would be late (0 when already late). */
  secondsToLate: number;
};

/**
 * Full evaluation of a scan: present / late, how many seconds late, and
 * whether the student scanned within the last minute before being late
 * ("almost late" -> shown in blue).
 */
export function evaluateScan(
  scannedAt: string,
  eventStart?: string | null,
  graceMinutes: number = DEFAULT_GRACE_MINUTES
): AttendanceEvaluation {
  if (!eventStart) {
    return { status: 'present', lateBySeconds: 0, almostLate: false, secondsToLate: Infinity };
  }
  const scanned = new Date(scannedAt).getTime();
  const start = new Date(eventStart).getTime();
  if (Number.isNaN(scanned) || Number.isNaN(start)) {
    return { status: 'present', lateBySeconds: 0, almostLate: false, secondsToLate: Infinity };
  }

  const grace = Math.max(0, graceMinutes) * 60 * 1000;
  const cutoff = start + grace;
  const diff = scanned - cutoff;

  if (diff > 0) {
    return {
      status: 'late',
      lateBySeconds: Math.round(diff / 1000),
      almostLate: false,
      secondsToLate: 0,
    };
  }

  const secondsToLate = Math.round(-diff / 1000);
  return {
    status: 'present',
    lateBySeconds: 0,
    almostLate: secondsToLate <= ALMOST_LATE_SECONDS,
    secondsToLate,
  };
}

export function computeAttendanceStatus(
  scannedAt: string,
  eventStart?: string | null,
  graceMinutes: number = DEFAULT_GRACE_MINUTES
): AttendanceStatus {
  return evaluateScan(scannedAt, eventStart, graceMinutes).status;
}

/** "3m 20s late" / "45s late" / "On time". */
export function formatLateBy(seconds?: number | null): string {
  const total = Math.max(0, Math.round(seconds ?? 0));
  if (total === 0) return 'On time';
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes === 0) return `${rest}s late`;
  return `${minutes}m ${rest}s late`;
}

/**
 * Tone used across the app for a scan:
 *   green  -> on time
 *   info   -> almost late (scanned within the last minute before the cutoff)
 *   danger -> late
 */
export type ScanTone = 'success' | 'info' | 'danger';

export function scanToneFor(evaluation: AttendanceEvaluation): ScanTone {
  if (evaluation.status === 'late') return 'danger';
  return evaluation.almostLate ? 'info' : 'success';
}

export function scanToneLabel(evaluation: AttendanceEvaluation): string {
  if (evaluation.status === 'late') return 'Late';
  return evaluation.almostLate ? 'Almost late' : 'On time';
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
