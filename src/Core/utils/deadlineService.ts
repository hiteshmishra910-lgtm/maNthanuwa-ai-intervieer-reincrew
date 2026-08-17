import { AssignmentStatus, InterviewAssignment } from '../../../types';

export function isExpired(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export function isDeadlineWithin24h(deadline: string | null): boolean {
  if (!deadline) return false;
  const dl = new Date(deadline);
  const now = new Date();
  const diffMs = dl.getTime() - now.getTime();
  return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;
}

export function getTimeRemaining(deadline: string | null): {
  expired: boolean;
  hours: number;
  minutes: number;
  display: string;
} {
  if (!deadline) {
    return { expired: false, hours: 0, minutes: 0, display: 'No deadline' };
  }
  const dl = new Date(deadline);
  const now = new Date();
  const diffMs = dl.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { expired: true, hours: 0, minutes: 0, display: 'Expired' };
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let display: string;
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    display = `${days}d ${hours % 24}h remaining`;
  } else if (hours > 0) {
    display = `${hours}h ${minutes}m remaining`;
  } else {
    display = `${minutes}m remaining`;
  }

  return { expired: false, hours, minutes, display };
}

export function canStartAssignment(assignment: InterviewAssignment): {
  allowed: boolean;
  reason?: string;
} {
  const { status, deadline, max_attempts, attempts_used } = assignment;

  if (status === 'COMPLETED') {
    return { allowed: false, reason: 'Interview already completed' };
  }
  if (deadline && isExpired(deadline)) {
    return { allowed: false, reason: 'Interview deadline has passed' };
  }
  if (attempts_used >= max_attempts) {
    return { allowed: false, reason: 'Maximum attempts reached' };
  }
  if (status === 'ABSENT') {
    return { allowed: false, reason: 'This assignment is no longer available' };
  }

  return { allowed: true };
}

export function deriveAssignmentStatus(assignment: InterviewAssignment): AssignmentStatus {
  if (assignment.status === 'COMPLETED' || assignment.status === 'ABSENT') {
    return assignment.status;
  }
  if (assignment.deadline && isExpired(assignment.deadline)) {
    return 'ABSENT';
  }
  if (assignment.attempts_used >= assignment.max_attempts) {
    return 'ABSENT';
  }
  if (assignment.attempts_used > 0 || assignment.status === 'IN_PROGRESS') {
    return 'IN_PROGRESS';
  }
  return 'INVITED';
}
