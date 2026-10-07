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
  'Rest Timer UI is smoother and better aligned',
  'Navigation feels faster and smoother',
  'Exercise Picker performance improved',
  'Workout experience polished',
];

export class ReleaseNotesService {
  async getAcknowledgedVersion(): Promise<string | null> {
    try {
      return await platformStorage.getItem(RELEASE_NOTES_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  async shouldShowReleaseNotes(targetVersion?: string): Promise<boolean> {
    const version = targetVersion || getAppVersionInfo().version;
    if (!version) return false;

    const acknowledgedVersion = await this.getAcknowledgedVersion();
    return acknowledgedVersion !== version;
  }

  async acknowledgeReleaseNotes(targetVersion?: string): Promise<void> {
    const version = targetVersion || getAppVersionInfo().version;
    if (!version) return;

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
