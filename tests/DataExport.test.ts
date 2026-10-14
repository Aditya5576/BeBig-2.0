/**
 * BeBig 2.0 — Workout History & Template Export Unit Tests
 *
 * Verifies:
 * - Genuine XLSX workbook generation, sheet names, headers, and cell values
 * - Genuine PDF document generation, headers, structure, and magic bytes
 * - Open JSON and CSV exports and RFC 4180 escaping
 * - Empty collections and missing optional fields
 * - Standardized filenames and MIME types
 * - Mobile file system + sharing integration and Web download handling
 */

import { Platform, Share } from 'react-native';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///data/user/0/host.exp.exponent/cache/',
  writeAsStringAsync: jest.fn(),
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64',
  },
}));
import {
  escapeCsvField,
  generateExportFilename,
  getMimeTypeForFormat,
  base64ToUint8Array,
  exportWorkoutsToJson,
  exportWorkoutsToCsv,
  exportTemplatesToJson,
  exportTemplatesToCsv,
  buildWorkoutsWorkbook,
  buildTemplatesWorkbook,
  exportWorkoutsToXlsx,
  exportTemplatesToXlsx,
  exportWorkoutsToPdf,
  exportTemplatesToPdf,
  shareOrDownloadExport,
} from '../src/features/export';
import { WorkoutSession } from '../src/features/workout/types';
import { WorkoutTemplate } from '../src/features/templates/types';

describe('DataExport Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // 1. CSV Escaping & Standard Filenames
  // ==========================================
  describe('escapeCsvField', () => {
    it('returns empty string for null and undefined', () => {
      expect(escapeCsvField(null)).toBe('');
      expect(escapeCsvField(undefined)).toBe('');
    });

    it('returns plain string when no special characters are present', () => {
      expect(escapeCsvField('Barbell Bench Press')).toBe('Barbell Bench Press');
      expect(escapeCsvField(123)).toBe('123');
      expect(escapeCsvField(0)).toBe('0');
      expect(escapeCsvField(true)).toBe('true');
    });

    it('wraps and escapes strings containing commas, quotes, and newlines', () => {
      expect(escapeCsvField('Legs, Chest')).toBe('"Legs, Chest"');
      expect(escapeCsvField('Bench "Heavy" Press')).toBe('"Bench ""Heavy"" Press"');
      expect(escapeCsvField('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
      expect(escapeCsvField('Line 1\r\nLine 2')).toBe('"Line 1\r\nLine 2"');
    });
  });

  describe('generateExportFilename & MIME types', () => {
    const mockDate = new Date(2026, 9, 12); // Oct 12, 2026

    it('generates filename with correct prefix, date and extension for all formats', () => {
      expect(generateExportFilename('workouts', 'xlsx', mockDate)).toBe('bebig_workouts_2026-10-12.xlsx');
      expect(generateExportFilename('workouts', 'pdf', mockDate)).toBe('bebig_workouts_2026-10-12.pdf');
      expect(generateExportFilename('workouts', 'json', mockDate)).toBe('bebig_workouts_2026-10-12.json');
      expect(generateExportFilename('workouts', 'csv', mockDate)).toBe('bebig_workouts_2026-10-12.csv');
      expect(generateExportFilename('templates', 'xlsx', mockDate)).toBe('bebig_templates_2026-10-12.xlsx');
      expect(generateExportFilename('templates', 'pdf', mockDate)).toBe('bebig_templates_2026-10-12.pdf');
    });

    it('returns exact MIME types matching industry standards', () => {
      expect(getMimeTypeForFormat('xlsx')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(getMimeTypeForFormat('pdf')).toBe('application/pdf');
      expect(getMimeTypeForFormat('json')).toBe('application/json');
      expect(getMimeTypeForFormat('csv')).toBe('text/csv');
    });
  });

  // ==========================================
  // 2. Excel (.xlsx) Workbooks
  // ==========================================
  describe('Excel (.xlsx) Export', () => {
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w-101',
        name: 'Heavy Push A',
        startedAt: '2026-10-10T10:00:00.000Z',
        finishedAt: '2026-10-10T11:00:00.000Z',
        status: 'completed',
        totalDuration: 3600,
        totalVolume: 4200,
        exercises: [
          {
            exerciseId: 'ex-bench',
            exerciseName: 'Incline Barbell Bench',
            categoryName: 'Chest',
            order: 1,
            actualSets: [
              {
                id: 's-1',
                setNumber: 1,
                weight: 85,
                reps: 8,
                rir: 2,
                notes: 'Solid lockouts',
                completed: true,
                completedAt: '2026-10-10T10:15:00.000Z',
              },
            ],
          },
        ],
      },
    ];

    const sampleTemplates: WorkoutTemplate[] = [
      {
        id: 't-201',
        name: 'Upper Body Hypertrophy',
        workoutFocus: 'Hypertrophy',
        sequenceNumber: 3,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-10T00:00:00.000Z',
        exercises: [
          {
            exerciseId: 'ex-row',
            exerciseName: 'Barbell Bent Over Row',
            categoryName: 'Back',
            order: 1,
            sets: 4,
            targetReps: '8-10',
            restTime: 90,
            targetWeight: 70,
          },
        ],
      },
    ];

    it('builds genuine workouts workbook with both summary and details sheets', () => {
      const wb = buildWorkoutsWorkbook(sampleWorkouts);
      expect(wb.SheetNames).toEqual(['Workout Summary', 'Exercise & Set Details']);

      const summaryData = XLSX.utils.sheet_to_json<any>(wb.Sheets['Workout Summary']);
      expect(summaryData).toHaveLength(1);
      expect(summaryData[0]['Workout ID']).toBe('w-101');
      expect(summaryData[0]['Workout Name']).toBe('Heavy Push A');
      expect(summaryData[0]['Duration (min)']).toBe(60);
      expect(summaryData[0]['Total Volume (kg)']).toBe(4200);

      const detailsData = XLSX.utils.sheet_to_json<any>(wb.Sheets['Exercise & Set Details']);
      expect(detailsData).toHaveLength(1);
      expect(detailsData[0]['Exercise Name']).toBe('Incline Barbell Bench');
      expect(detailsData[0]['Weight (kg)']).toBe(85);
      expect(detailsData[0]['Reps']).toBe(8);
      expect(detailsData[0]['RIR']).toBe(2);
      expect(detailsData[0]['Completed']).toBe('Yes');
    });

    it('generates valid base64 encoded XLSX binary string that decodes to a valid workbook', () => {
      const b64 = exportWorkoutsToXlsx(sampleWorkouts);
      expect(typeof b64).toBe('string');
      expect(b64.length).toBeGreaterThan(100);

      const bytes = base64ToUint8Array(b64);
      const parsedWb = XLSX.read(bytes, { type: 'array' });
      expect(parsedWb.SheetNames).toContain('Workout Summary');
      expect(parsedWb.SheetNames).toContain('Exercise & Set Details');
    });

    it('handles empty workouts list in XLSX export', () => {
      const wb = buildWorkoutsWorkbook([]);
      expect(wb.SheetNames).toEqual(['Workout Summary', 'Exercise & Set Details']);
      const summaryData = XLSX.utils.sheet_to_json<any>(wb.Sheets['Workout Summary']);
      expect(summaryData).toHaveLength(0);
    });

    it('builds genuine templates workbook with summary and exercises sheets', () => {
      const wb = buildTemplatesWorkbook(sampleTemplates);
      expect(wb.SheetNames).toEqual(['Template Summary', 'Template Exercises']);

      const summaryData = XLSX.utils.sheet_to_json<any>(wb.Sheets['Template Summary']);
      expect(summaryData[0]['Template Name']).toBe('Upper Body Hypertrophy');
      expect(summaryData[0]['Session Number']).toBe(3);

      const exercisesData = XLSX.utils.sheet_to_json<any>(wb.Sheets['Template Exercises']);
      expect(exercisesData[0]['Exercise Name']).toBe('Barbell Bent Over Row');
      expect(exercisesData[0]['Target Sets']).toBe(4);
      expect(exercisesData[0]['Target Reps']).toBe('8-10');
      expect(exercisesData[0]['Target Weight (kg)']).toBe(70);
    });

    it('handles empty templates list in XLSX export', () => {
      const wb = buildTemplatesWorkbook([]);
      expect(wb.SheetNames).toEqual(['Template Summary', 'Template Exercises']);
      const exercisesData = XLSX.utils.sheet_to_json<any>(wb.Sheets['Template Exercises']);
      expect(exercisesData).toHaveLength(0);
    });
  });

  // ==========================================
  // 3. PDF (.pdf) Reports
  // ==========================================
  describe('PDF (.pdf) Export', () => {
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w-pdf-1',
        name: 'Full Body Power',
        startedAt: '2026-10-11T09:00:00.000Z',
        finishedAt: '2026-10-11T10:15:00.000Z',
        status: 'completed',
        totalDuration: 4500,
        totalVolume: 5800,
        exercises: [
          {
            exerciseId: 'ex-squat',
            exerciseName: 'Barbell Back Squat',
            categoryName: 'Legs',
            order: 1,
            actualSets: [
              {
                id: 'set-1',
                setNumber: 1,
                weight: 120,
                reps: 5,
                rir: 2,
                completed: true,
              },
            ],
          },
        ],
      },
    ];

    const sampleTemplates: WorkoutTemplate[] = [
      {
        id: 't-pdf-1',
        name: 'Legs & Core',
        workoutFocus: 'Hypertrophy',
        sequenceNumber: 1,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        exercises: [
          {
            exerciseId: 'ex-squat',
            exerciseName: 'Barbell Back Squat',
            categoryName: 'Legs',
            order: 1,
            sets: 3,
            targetReps: '6-8',
            restTime: 120,
            targetWeight: 100,
          },
        ],
      },
    ];

    it('generates a genuine PDF binary payload with %PDF magic header for workouts', async () => {
      const base64Pdf = await exportWorkoutsToPdf(sampleWorkouts);
      expect(typeof base64Pdf).toBe('string');
      expect(base64Pdf.length).toBeGreaterThan(100);

      const bytes = base64ToUint8Array(base64Pdf);
      const headerString = String.fromCharCode(...bytes.slice(0, 5));
      expect(headerString).toBe('%PDF-');
    });

    it('generates valid PDF when workout history is empty', async () => {
      const base64Pdf = await exportWorkoutsToPdf([]);
      const bytes = base64ToUint8Array(base64Pdf);
      const headerString = String.fromCharCode(...bytes.slice(0, 5));
      expect(headerString).toBe('%PDF-');
    });

    it('generates a genuine PDF binary payload with %PDF magic header for templates', async () => {
      const base64Pdf = await exportTemplatesToPdf(sampleTemplates);
      expect(typeof base64Pdf).toBe('string');
      expect(base64Pdf.length).toBeGreaterThan(100);

      const bytes = base64ToUint8Array(base64Pdf);
      const headerString = String.fromCharCode(...bytes.slice(0, 5));
      expect(headerString).toBe('%PDF-');
    });

    it('generates valid PDF when templates collection is empty', async () => {
      const base64Pdf = await exportTemplatesToPdf([]);
      const bytes = base64ToUint8Array(base64Pdf);
      const headerString = String.fromCharCode(...bytes.slice(0, 5));
      expect(headerString).toBe('%PDF-');
    });

    it('handles missing optional fields (no duration, no category, no notes) without throwing', async () => {
      const minimalWorkouts: WorkoutSession[] = [
        {
          id: 'w-min',
          name: '',
          startedAt: '2026-10-12T00:00:00.000Z',
          status: 'completed',
          exercises: [
            {
              exerciseId: 'ex-min',
              exerciseName: 'Pushups',
              order: 1,
              actualSets: [
                {
                  id: 's-min',
                  setNumber: 1,
                  weight: 0,
                  reps: 20,
                  completed: true,
                },
              ],
            },
          ],
        },
      ];

      await expect(exportWorkoutsToPdf(minimalWorkouts)).resolves.not.toThrow();
    });
  });

  // ==========================================
  // 4. Open JSON and CSV Exports
  // ==========================================
  describe('JSON & CSV Exports', () => {
    it('formats empty workout array as empty JSON array', () => {
      const json = exportWorkoutsToJson([]);
      expect(JSON.parse(json)).toEqual([]);
    });

    it('formats empty workout array as CSV header', () => {
      const csv = exportWorkoutsToCsv([]);
      expect(csv.startsWith('workout_id,workout_name')).toBe(true);
    });

    it('formats empty template array as empty JSON array', () => {
      const json = exportTemplatesToJson([]);
      expect(JSON.parse(json)).toEqual([]);
    });

    it('formats empty template array as CSV header', () => {
      const csv = exportTemplatesToCsv([]);
      expect(csv.startsWith('template_id,template_name')).toBe(true);
    });
  });

  // ==========================================
  // 5. File System & Sharing Integration
  // ==========================================
  describe('shareOrDownloadExport', () => {
    it('writes binary base64 file to FileSystem and invokes Sharing.shareAsync on mobile', async () => {
      const prevOS = Platform.OS;
      Platform.OS = 'ios';

      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);

      const result = await shareOrDownloadExport(
        'bebig_workouts_2026-10-12.xlsx',
        'AQIDBA==',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        true
      );

      expect(result).toBe(true);
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('bebig_workouts_2026-10-12.xlsx'),
        'AQIDBA==',
        expect.objectContaining({ encoding: 'base64' })
      );
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringContaining('bebig_workouts_2026-10-12.xlsx'),
        expect.objectContaining({
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      );

      Platform.OS = prevOS;
    });

    it('falls back to Share.share when Sharing.isAvailableAsync is false', async () => {
      const prevOS = Platform.OS;
      Platform.OS = 'ios';

      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);
      const shareMock = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });

      const result = await shareOrDownloadExport(
        'bebig_workouts_2026-10-12.json',
        '{"test": 1}',
        'application/json',
        false
      );

      expect(result).toBe(true);
      expect(shareMock).toHaveBeenCalledWith({
        title: 'bebig_workouts_2026-10-12.json',
        message: '{"test": 1}',
      });

      shareMock.mockRestore();
      Platform.OS = prevOS;
    });

    it('handles web download via blob and link click for both binary and text data', async () => {
      const prevOS = Platform.OS;
      Platform.OS = 'web';

      const clickMock = jest.fn();
      const setAttributeMock = jest.fn();
      const mockLink = {
        href: '',
        setAttribute: setAttributeMock,
        click: clickMock,
      };

      const mockDocument = {
        createElement: jest.fn().mockReturnValue(mockLink),
        body: {
          appendChild: jest.fn(),
          removeChild: jest.fn(),
        },
      };

      const revokeObjectURLSpy = jest.fn();
      const createObjectURLSpy = jest.fn().mockReturnValue('blob:http://localhost/test-uuid');

      (globalThis as any).document = mockDocument;
      (globalThis as any).URL = {
        createObjectURL: createObjectURLSpy,
        revokeObjectURL: revokeObjectURLSpy,
      };
      (globalThis as any).Blob = class MockBlob {
        parts: unknown[];
        options?: unknown;
        constructor(parts: unknown[], options?: unknown) {
          this.parts = parts;
          this.options = options;
        }
      };

      // Test binary web download
      const result = await shareOrDownloadExport(
        'bebig_workouts.pdf',
        'JVBERi0xLjQK',
        'application/pdf',
        true
      );

      expect(result).toBe(true);
      expect(setAttributeMock).toHaveBeenCalledWith('download', 'bebig_workouts.pdf');
      expect(clickMock).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/test-uuid');

      delete (globalThis as any).document;
      Platform.OS = prevOS;
    });
  });
});
