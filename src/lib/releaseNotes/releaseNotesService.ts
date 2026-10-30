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
  '2.2.0': {
    version: '2.2.0',
    title: "What's New in BeBig 2.2",
    highlights: [
      'Exercise Demonstration Media: 10 verified core exercise demonstrations and 2 seed mappings with author attribution and CC-BY-SA licensing.',
      'Unified Custom Exercise Creation: Identical creation workflow across Exercise Library and Ongoing Workout, with persistent custom photo support.',
      'Indian Commercial Gym Catalogue: Refined exercise catalogue prioritized for standard gym equipment with duplicate movement suppression.',
      'Search & Navigation Responsiveness: Stable virtual keyboard typing during exercise search and smooth list scrolling with cached exercise hydration.',
      'Factual Weekly Performance: Clean, deterministic weekly training trends and progressive overload analytics following the retirement of the legacy AI coach.',
    ],
  },
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
  'Verified Exercise Demonstration Media with licensing attribution',
  'Unified Custom Exercise Creation with photo persistence',
  'Exercise catalogue refined for Indian commercial gym equipment',
  'Smooth exercise library navigation and stable search typing',
  'Factual Weekly Performance and progressive overload analytics',
  'Data Export to Excel (.xlsx) and PDF (.pdf)',
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
