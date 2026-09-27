import { OwnerType } from '../auth/types';

export type ScheduledWorkoutStatus = 'scheduled' | 'completed' | 'skipped';

export interface ScheduledWorkout {
  id: string; // Stable UUID
  ownerId?: string;
  ownerType?: OwnerType;
  templateId?: string | null; // Optional reference to source template
  name: string; // Snapshot of template name or custom workout name
  scheduledDate: string; // "YYYY-MM-DD" local calendar date
  scheduledTime?: string | null; // "HH:mm" optional target time (24h)
  status: ScheduledWorkoutStatus;
  completedSessionId?: string | null; // Linked workout_sessions.id upon completion
  notes?: string | null;
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
  clientUpdatedAt: string; // ISO 8601 UTC
  deletedAt?: string | null; // ISO 8601 UTC tombstone
}
