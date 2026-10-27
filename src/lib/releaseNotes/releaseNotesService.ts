/**
 * BeBig 2.0 — Versioned Release Notes Service
 *
 * Manages local acknowledgement of version-specific release notes popups.
 * Local-first, offline, keyed strictly by version string.
 */

import { platformStorage } from '../storage/platformStorage';
import { getAppVersionInfo } from '../../config/version';

export const RELEASE_NOTES_STORAGE_KEY = 'bebig.release_notes.acknowledged_version';

export interface ReleaseNoteItem {
  version: string;
  title: string;
  highlights: string[];
}

export const CURRENT_RELEASE_NOTES: Record<string, ReleaseNoteItem> = {
  '2.1.1': {
    version: '2.1.1',
    title: "What's New in BeBig 2.0",
    highlights: [
      'Automatic Session Numbering: Workouts started from templates automatically track and display sequential session numbers.',
      'Recently Used Exercises: Quick access to your frequently and recently used exercises at the top of the picker.',
      'Data Export (Excel & PDF): Export complete workout histories and saved templates directly to .xlsx spreadsheets and formatted .pdf documents.',
      'Profile Photo Persistence: Upload, update, and reliably keep your athlete profile photo across web and mobile.',
      'Progress Analytics 2.0 & AI Weekly Analysis: Deep volume, intensity, and muscle group analysis with AI-guided weekly performance insights.',
      'Workout & Rest Timer Notifications: Reliable background alerts and lock-screen notifications when your rest timer finishes.',
    ],
  },
  '2.1.0': {
    version: '2.1.0',
    title: "What's New in BeBig",
    highlights: [
      'Workout 2.0: Athletic, spacious Active Workout experience',
      'Compact set rows with streamlined input UX',
      'Multi-select Exercise Picker with instant batch addition',
      'Smart exercise reordering with auto-scroll compensation',
      'Redesigned Start Workout screen & Templates 2.0',
      'Balanced, non-intrusive Rest Timer',
      'New premium Home dashboard & personal progress',
    ],
  },
  '2.0.0': {
    version: '2.0.0',
    title: "What's New in BeBig",
    highlights: [
      'Performance Progression (Set-by-set history)',
      'Workout Insights (Compare current vs previous workout)',
      'Weekly Performance (Analytics engine for week-over-week trends)',
      'Smoother Performance Experience',
    ],
  },
  '1.0.5': {
    version: '1.0.5',
    title: "What's New in BeBig",
    highlights: [
      'Release Notes popup timing polished (appears after startup splash)',
      'Rest Timer UI is smoother and better aligned',
      'Navigation feels faster and smoother',
      'Exercise Picker performance improved',
    ],
  },
  '1.0.4': {
    version: '1.0.4',
    title: "What's New in BeBig",
    highlights: [
      'Rest Timer UI is smoother and better aligned',
      'Navigation feels faster and smoother',
      'Exercise Picker performance improved',
      'Workout experience polished',
    ],
  },
};

export const defaultReleaseHighlights: string[] = [
  'Automatic Session Numbering for workout templates',
  'Recently Used Exercises at the top of the exercise picker',
  'Data Export to Excel (.xlsx) and PDF (.pdf)',
  'Profile photo persistence across web and mobile',
  'Progress Analytics 2.0 with AI weekly performance analysis',
  'Reliable workout and rest timer notifications',
];

export class ReleaseNotesService {
  async getAcknowledgedVersion(): Promise<string | null> {
    try {
      const val = await platformStorage.getItem(RELEASE_NOTES_STORAGE_KEY);
      if (typeof val === 'string' && val.trim().length > 0) {
        return val.trim();
      }
      return null;
    } catch {
      return null;
    }
  }

  async shouldShowReleaseNotes(targetVersion?: string): Promise<boolean> {
    const rawVersion = targetVersion !== undefined ? targetVersion : getAppVersionInfo().version;
    if (!rawVersion || typeof rawVersion !== 'string' || rawVersion.trim().length === 0) {
      return false;
    }
    const version = rawVersion.trim();

    const acknowledgedVersion = await this.getAcknowledgedVersion();
    return acknowledgedVersion !== version;
  }

  async acknowledgeReleaseNotes(targetVersion?: string): Promise<void> {
    const rawVersion = targetVersion !== undefined ? targetVersion : getAppVersionInfo().version;
    if (!rawVersion || typeof rawVersion !== 'string' || rawVersion.trim().length === 0) {
      return;
    }
    const version = rawVersion.trim();

    try {
      await platformStorage.setItem(RELEASE_NOTES_STORAGE_KEY, version);
    } catch (err) {
      console.warn('[ReleaseNotesService] Failed to save acknowledgement:', err);
    }
  }

  getReleaseNotesForVersion(version: string): ReleaseNoteItem {
    if (CURRENT_RELEASE_NOTES[version]) {
      return CURRENT_RELEASE_NOTES[version];
    }
    return {
      version,
      title: "What's New in BeBig",
      highlights: defaultReleaseHighlights,
    };
  }
}

export const releaseNotesService = new ReleaseNotesService();
