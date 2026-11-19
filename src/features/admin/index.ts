export {
  errorTelemetryService,
  sanitizeErrorText,
  ERROR_RING_BUFFER_KEY,
  ERROR_RING_BUFFER_MAX,
} from './services/errorTelemetryService';
export type {
  ErrorSeverity,
  DeviceDiagnosticsInfo,
  ClientErrorLogEntry,
  CaptureErrorInput,
} from './services/errorTelemetryService';

export { adminService, sanitizeTrainerExercises } from './services/adminService';
export type {
  AdminAccessRole,
  AdminAccessResult,
  AdminOverviewMetrics,
  AdminOverviewResult,
  AnnouncementType,
  AppAnnouncement,
  CreateAnnouncementInput,
  PwaHealthSnapshot,
  AdminDirectoryUser,
  AdminUserDirectoryResult,
  TrainerExerciseSpec,
  TrainerWorkoutTemplate,
  SaveTrainerTemplateInput,
  AssignedWorkoutStatus,
  AssignedWorkoutRecord,
  AssignTemplateToUsersInput,
} from './services/adminService';

export { useAdminAccess } from './hooks/useAdminAccess';
export type { UseAdminAccessResult } from './hooks/useAdminAccess';

export {
  globalExerciseCatalogService,
  sanitizeGlobalExerciseInput,
  mapGlobalRecordToExercise,
  GLOBAL_EXERCISE_ID_PREFIX,
} from '../exercises/services/globalExerciseCatalogService';
export type {
  GlobalExerciseRecord,
  SaveGlobalExerciseInput,
} from '../exercises/services/globalExerciseCatalogService';
