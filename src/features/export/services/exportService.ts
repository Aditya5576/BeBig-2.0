/**
 * BeBig 2.0 — Workout History & Template Data Export Service
 *
 * Provides functions to export workout history and workout templates
 * into standard formats:
 * - Excel (.xlsx): Genuine multi-sheet workbooks (Summary and Details) using SheetJS (xlsx)
 * - PDF (.pdf): Formatted reports with headers, summaries, tables, and footers using pdf-lib
 * - JSON (.json) & CSV (.csv): Preserved for open data portability
 *
 * Handles native file storage & share sheet on iOS/Android, and HTML5 downloads on Web.
 */

import { Platform, Share } from 'react-native';
import * as XLSX from 'xlsx';
import type { RGB } from 'pdf-lib';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/**
 * Loads pdf-lib from its standalone pre-bundled distribution.
 * This completely isolates pdf-lib from external tslib resolution issues in Metro web/mobile bundler.
 */
function getPdfLib() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfLib = require('pdf-lib/dist/pdf-lib.min.js');
  return {
    PDFDocument: pdfLib.PDFDocument as typeof import('pdf-lib').PDFDocument,
    StandardFonts: pdfLib.StandardFonts as typeof import('pdf-lib').StandardFonts,
    rgb: pdfLib.rgb as typeof import('pdf-lib').rgb,
  };
}
import { WorkoutSession } from '../../workout/types';
import { WorkoutTemplate } from '../../templates/types';

export type ExportFormat = 'xlsx' | 'pdf' | 'json' | 'csv';

/**
 * Escapes a single CSV field following RFC 4180 standards.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates standardized export filename:
 * e.g. bebig_workouts_2026-10-12.xlsx
 */
export function generateExportFilename(
  type: 'workouts' | 'templates',
  format: ExportFormat,
  date: Date = new Date()
): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `bebig_${type}_${year}-${month}-${day}.${format}`;
}

/**
 * Returns the proper standard MIME type for each export format.
 */
export function getMimeTypeForFormat(format: ExportFormat): string {
  switch (format) {
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'pdf':
      return 'application/pdf';
    case 'json':
      return 'application/json';
    case 'csv':
      return 'text/csv';
  }
}

/**
 * Converts an array of WorkoutSession objects into a structured JSON string.
 */
export function exportWorkoutsToJson(workouts: WorkoutSession[]): string {
  return JSON.stringify(workouts, null, 2);
}

/**
 * Converts an array of WorkoutSession objects into a flattened RFC 4180 CSV string.
 */
export function exportWorkoutsToCsv(workouts: WorkoutSession[]): string {
  const headers = [
    'workout_id',
    'workout_name',
    'started_at',
    'finished_at',
    'total_duration_seconds',
    'total_volume_kg',
    'exercise_order',
    'exercise_id',
    'exercise_name',
    'category',
    'set_number',
    'weight_kg',
    'reps',
    'rir',
    'notes',
    'completed',
    'completed_at',
  ];

  const rows: string[] = [headers.join(',')];

  for (const session of workouts) {
    const baseCols = [
      escapeCsvField(session.id),
      escapeCsvField(session.name),
      escapeCsvField(session.startedAt),
      escapeCsvField(session.finishedAt ?? ''),
      escapeCsvField(session.totalDuration ?? ''),
      escapeCsvField(session.totalVolume ?? ''),
    ];

    if (!session.exercises || session.exercises.length === 0) {
      rows.push([...baseCols, '', '', '', '', '', '', '', '', '', '', ''].join(','));
      continue;
    }

    for (const ex of session.exercises) {
      const exCols = [
        escapeCsvField(ex.order),
        escapeCsvField(ex.exerciseId),
        escapeCsvField(ex.exerciseName),
        escapeCsvField(ex.categoryName ?? ''),
      ];

      if (!ex.actualSets || ex.actualSets.length === 0) {
        rows.push([...baseCols, ...exCols, '', '', '', '', '', '', ''].join(','));
        continue;
      }

      for (const s of ex.actualSets) {
        const setCols = [
          escapeCsvField(s.setNumber),
          escapeCsvField(s.weight),
          escapeCsvField(s.reps),
          escapeCsvField(s.rir !== undefined ? s.rir : ''),
          escapeCsvField(s.notes ?? ''),
          escapeCsvField(s.completed ? 'true' : 'false'),
          escapeCsvField(s.completedAt ?? ''),
        ];
        rows.push([...baseCols, ...exCols, ...setCols].join(','));
      }
    }
  }

  return rows.join('\n');
}

/**
 * Converts an array of WorkoutTemplate objects into a structured JSON string.
 */
export function exportTemplatesToJson(templates: WorkoutTemplate[]): string {
  return JSON.stringify(templates, null, 2);
}

/**
 * Converts an array of WorkoutTemplate objects into a flattened RFC 4180 CSV string.
 */
export function exportTemplatesToCsv(templates: WorkoutTemplate[]): string {
  const headers = [
    'template_id',
    'template_name',
    'workout_focus',
    'sequence_number',
    'created_at',
    'updated_at',
    'exercise_order',
    'exercise_id',
    'exercise_name',
    'category',
    'sets',
    'target_reps',
    'rest_time_seconds',
    'target_weight_kg',
  ];

  const rows: string[] = [headers.join(',')];

  for (const t of templates) {
    const baseCols = [
      escapeCsvField(t.id),
      escapeCsvField(t.name),
      escapeCsvField(t.workoutFocus ?? ''),
      escapeCsvField(t.sequenceNumber !== undefined ? t.sequenceNumber : ''),
      escapeCsvField(t.createdAt),
      escapeCsvField(t.updatedAt),
    ];

    if (!t.exercises || t.exercises.length === 0) {
      rows.push([...baseCols, '', '', '', '', '', '', '', ''].join(','));
      continue;
    }

    for (const ex of t.exercises) {
      const exCols = [
        escapeCsvField(ex.order),
        escapeCsvField(ex.exerciseId),
        escapeCsvField(ex.exerciseName),
        escapeCsvField(ex.categoryName ?? ''),
        escapeCsvField(ex.sets),
        escapeCsvField(ex.targetReps),
        escapeCsvField(ex.restTime),
        escapeCsvField(ex.targetWeight !== undefined ? ex.targetWeight : ''),
      ];
      rows.push([...baseCols, ...exCols].join(','));
    }
  }

  return rows.join('\n');
}

/**
 * Builds a genuine XLSX workbook for workout history containing:
 * 1. "Workout Summary" sheet: high-level session statistics
 * 2. "Exercise & Set Details" sheet: detailed per-set logged performance
 */
export function buildWorkoutsWorkbook(workouts: WorkoutSession[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Workout Summary
  const summaryHeaders = [
    'Workout ID',
    'Workout Name',
    'Started At',
    'Finished At',
    'Duration (min)',
    'Total Volume (kg)',
    'Total Sets Logged',
    'Status',
  ];

  const summaryRows = workouts.map((w) => {
    const durationMin = w.totalDuration ? Math.round((w.totalDuration / 60) * 10) / 10 : 0;
    const totalSets = (w.exercises || []).reduce(
      (sum, ex) => sum + (ex.actualSets ? ex.actualSets.length : 0),
      0
    );
    return [
      w.id,
      w.name || 'Untitled Workout',
      w.startedAt || '',
      w.finishedAt || '',
      durationMin,
      w.totalVolume ?? 0,
      totalSets,
      w.status || 'completed',
    ];
  });

  const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Workout Summary');

  // Sheet 2: Exercise & Set Details
  const detailsHeaders = [
    'Workout ID',
    'Workout Name',
    'Date',
    'Exercise Order',
    'Exercise ID',
    'Exercise Name',
    'Category',
    'Set Number',
    'Weight (kg)',
    'Reps',
    'RIR',
    'Notes',
    'Completed',
    'Completed At',
  ];

  const detailsRows: (string | number)[][] = [];

  for (const w of workouts) {
    const workoutDate = w.finishedAt
      ? w.finishedAt.split('T')[0]
      : w.startedAt
      ? w.startedAt.split('T')[0]
      : '';

    for (const ex of w.exercises || []) {
      for (const s of ex.actualSets || []) {
        detailsRows.push([
          w.id,
          w.name || 'Untitled Workout',
          workoutDate,
          ex.order,
          ex.exerciseId,
          ex.exerciseName,
          ex.categoryName || '',
          s.setNumber,
          s.weight ?? 0,
          s.reps ?? 0,
          s.rir !== undefined ? s.rir : '',
          s.notes || '',
          s.completed ? 'Yes' : 'No',
          s.completedAt || '',
        ]);
      }
    }
  }

  const detailsSheet = XLSX.utils.aoa_to_sheet([detailsHeaders, ...detailsRows]);
  XLSX.utils.book_append_sheet(wb, detailsSheet, 'Exercise & Set Details');

  return wb;
}

/**
 * Builds a genuine XLSX workbook for saved workout templates containing:
 * 1. "Template Summary" sheet: high-level template overview
 * 2. "Template Exercises" sheet: detailed exercise target configurations
 */
export function buildTemplatesWorkbook(templates: WorkoutTemplate[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Template Summary
  const summaryHeaders = [
    'Template ID',
    'Template Name',
    'Focus',
    'Session Number',
    'Exercise Count',
    'Created At',
    'Updated At',
  ];

  const summaryRows = templates.map((t) => [
    t.id,
    t.name || 'Untitled Template',
    t.workoutFocus || '',
    t.sequenceNumber !== undefined ? t.sequenceNumber : '',
    t.exercises ? t.exercises.length : 0,
    t.createdAt || '',
    t.updatedAt || '',
  ]);

  const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Template Summary');

  // Sheet 2: Template Exercises
  const detailsHeaders = [
    'Template ID',
    'Template Name',
    'Exercise Order',
    'Exercise ID',
    'Exercise Name',
    'Category',
    'Target Sets',
    'Target Reps',
    'Rest Interval (sec)',
    'Target Weight (kg)',
  ];

  const detailsRows: (string | number)[][] = [];

  for (const t of templates) {
    for (const ex of t.exercises || []) {
      detailsRows.push([
        t.id,
        t.name || 'Untitled Template',
        ex.order,
        ex.exerciseId,
        ex.exerciseName,
        ex.categoryName || '',
        ex.sets,
        ex.targetReps || '',
        ex.restTime ?? 0,
        ex.targetWeight !== undefined ? ex.targetWeight : '',
      ]);
    }
  }

  const detailsSheet = XLSX.utils.aoa_to_sheet([detailsHeaders, ...detailsRows]);
  XLSX.utils.book_append_sheet(wb, detailsSheet, 'Template Exercises');

  return wb;
}

/**
 * Generates an Excel (.xlsx) file in base64 string format.
 */
export function exportWorkoutsToXlsx(workouts: WorkoutSession[]): string {
  const wb = buildWorkoutsWorkbook(workouts);
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

export function exportTemplatesToXlsx(templates: WorkoutTemplate[]): string {
  const wb = buildTemplatesWorkbook(templates);
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

/**
 * Formats an ISO timestamp nicely for PDF reports (e.g., "Oct 12, 2026, 10:30 AM")
 */
function formatReportDate(isoString?: string): string {
  if (!isoString) return 'N/A';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * Generates a clean, readable, multi-page PDF report for completed workouts.
 */
export async function exportWorkoutsToPdf(workouts: WorkoutSession[]): Promise<string> {
  const { PDFDocument, StandardFonts, rgb } = getPdfLib();
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN_LEFT = 40;
  const MARGIN_RIGHT = 40;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  const colorGold: RGB = rgb(0.898, 0.663, 0.235);
  const colorDark: RGB = rgb(0.059, 0.09, 0.165);
  const colorMuted: RGB = rgb(0.392, 0.455, 0.545);
  const colorLine: RGB = rgb(0.886, 0.91, 0.941);
  const colorRowAlt: RGB = rgb(0.973, 0.98, 0.988);
  const colorHeaderBg: RGB = rgb(0.118, 0.161, 0.231);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let currentY = PAGE_HEIGHT - 50;

  // Header branding
  page.drawText('BeBig 2.0', { x: MARGIN_LEFT, y: currentY, size: 20, font: fontBold, color: colorGold });
  currentY -= 22;
  page.drawText('Workout History Report', { x: MARGIN_LEFT, y: currentY, size: 14, font: fontBold, color: colorDark });
  currentY -= 16;

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  page.drawText(`Generated on ${dateStr}  |  Total Workouts: ${workouts.length}`, {
    x: MARGIN_LEFT,
    y: currentY,
    size: 9,
    font: fontRegular,
    color: colorMuted,
  });
  currentY -= 12;

  page.drawLine({
    start: { x: MARGIN_LEFT, y: currentY },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: currentY },
    thickness: 1,
    color: colorLine,
  });
  currentY -= 20;

  if (workouts.length === 0) {
    page.drawText('No completed workout logs found to export.', {
      x: MARGIN_LEFT,
      y: currentY,
      size: 11,
      font: fontOblique,
      color: colorMuted,
    });
  } else {
    for (let wIndex = 0; wIndex < workouts.length; wIndex++) {
      const w = workouts[wIndex];

      // Check space for workout title card
      if (currentY < 120) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        currentY = PAGE_HEIGHT - 50;
      }

      // Workout Title
      page.drawText(`${wIndex + 1}. ${w.name || 'Completed Workout'}`, {
        x: MARGIN_LEFT,
        y: currentY,
        size: 12,
        font: fontBold,
        color: colorDark,
      });
      currentY -= 14;

      const durationMin = w.totalDuration ? Math.round(w.totalDuration / 60) : 0;
      const finishedDate = formatReportDate(w.finishedAt || w.startedAt);
      const subInfo = `Date: ${finishedDate}  |  Duration: ${durationMin} min  |  Volume: ${w.totalVolume ?? 0} kg`;

      page.drawText(subInfo, {
        x: MARGIN_LEFT,
        y: currentY,
        size: 8.5,
        font: fontRegular,
        color: colorMuted,
      });
      currentY -= 18;

      // Collect all set rows
      const tableRows: { exercise: string; category: string; setNum: string; weight: string; reps: string; rir: string; status: string; notes: string }[] = [];
      for (const ex of w.exercises || []) {
        for (const s of ex.actualSets || []) {
          tableRows.push({
            exercise: ex.exerciseName || 'Exercise',
            category: ex.categoryName || '-',
            setNum: `Set ${s.setNumber}`,
            weight: `${s.weight} kg`,
            reps: `${s.reps} reps`,
            rir: s.rir !== undefined ? `${s.rir}` : '-',
            status: s.completed ? 'Done' : 'Skipped',
            notes: s.notes || '-',
          });
        }
      }

      if (tableRows.length === 0) {
        page.drawText('No exercise sets logged for this session.', {
          x: MARGIN_LEFT + 10,
          y: currentY,
          size: 8.5,
          font: fontOblique,
          color: colorMuted,
        });
        currentY -= 20;
        continue;
      }

      // Draw Table Header
      const colWidths = [140, 75, 45, 55, 50, 35, 45, 70]; // sum = 515
      const colHeaders = ['Exercise', 'Category', 'Set', 'Weight', 'Reps', 'RIR', 'Status', 'Notes'];

      const drawTableHeader = () => {
        page.drawRectangle({
          x: MARGIN_LEFT,
          y: currentY - 14,
          width: CONTENT_WIDTH,
          height: 16,
          color: colorHeaderBg,
        });

        let colX = MARGIN_LEFT + 4;
        for (let c = 0; c < colHeaders.length; c++) {
          page.drawText(colHeaders[c], {
            x: colX,
            y: currentY - 10,
            size: 7.5,
            font: fontBold,
            color: rgb(1, 1, 1),
          });
          colX += colWidths[c];
        }
        currentY -= 16;
      };

      drawTableHeader();

      // Draw rows
      for (let r = 0; r < tableRows.length; r++) {
        if (currentY < 60) {
          page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          currentY = PAGE_HEIGHT - 50;
          drawTableHeader();
        }

        const row = tableRows[r];
        if (r % 2 === 1) {
          page.drawRectangle({
            x: MARGIN_LEFT,
            y: currentY - 12,
            width: CONTENT_WIDTH,
            height: 14,
            color: colorRowAlt,
          });
        }

        let colX = MARGIN_LEFT + 4;
        const values = [row.exercise, row.category, row.setNum, row.weight, row.reps, row.rir, row.status, row.notes];

        for (let c = 0; c < values.length; c++) {
          let textVal = values[c];
          // Truncate if too long for column
          if (c === 0 && textVal.length > 24) textVal = textVal.slice(0, 22) + '...';
          if (c === 1 && textVal.length > 12) textVal = textVal.slice(0, 10) + '..';
          if (c === 7 && textVal.length > 14) textVal = textVal.slice(0, 12) + '..';

          page.drawText(textVal, {
            x: colX,
            y: currentY - 9,
            size: 7.5,
            font: fontRegular,
            color: colorDark,
          });
          colX += colWidths[c];
        }

        currentY -= 14;
      }

      currentY -= 16;
    }
  }

  // Add Page Numbers
  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const p = pdfDoc.getPage(i);
    p.drawText(`Page ${i + 1} of ${totalPages}`, {
      x: PAGE_WIDTH / 2 - 25,
      y: 20,
      size: 8,
      font: fontRegular,
      color: colorMuted,
    });
  }

  return await pdfDoc.saveAsBase64();
}

/**
 * Generates a clean, readable, multi-page PDF report for saved templates.
 */
export async function exportTemplatesToPdf(templates: WorkoutTemplate[]): Promise<string> {
  const { PDFDocument, StandardFonts, rgb } = getPdfLib();
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN_LEFT = 40;
  const MARGIN_RIGHT = 40;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  const colorGold: RGB = rgb(0.898, 0.663, 0.235);
  const colorDark: RGB = rgb(0.059, 0.09, 0.165);
  const colorMuted: RGB = rgb(0.392, 0.455, 0.545);
  const colorLine: RGB = rgb(0.886, 0.91, 0.941);
  const colorRowAlt: RGB = rgb(0.973, 0.98, 0.988);
  const colorHeaderBg: RGB = rgb(0.118, 0.161, 0.231);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let currentY = PAGE_HEIGHT - 50;

  // Header branding
  page.drawText('BeBig 2.0', { x: MARGIN_LEFT, y: currentY, size: 20, font: fontBold, color: colorGold });
  currentY -= 22;
  page.drawText('Workout Templates Report', { x: MARGIN_LEFT, y: currentY, size: 14, font: fontBold, color: colorDark });
  currentY -= 16;

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  page.drawText(`Generated on ${dateStr}  |  Total Templates: ${templates.length}`, {
    x: MARGIN_LEFT,
    y: currentY,
    size: 9,
    font: fontRegular,
    color: colorMuted,
  });
  currentY -= 12;

  page.drawLine({
    start: { x: MARGIN_LEFT, y: currentY },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: currentY },
    thickness: 1,
    color: colorLine,
  });
  currentY -= 20;

  if (templates.length === 0) {
    page.drawText('No saved workout templates found to export.', {
      x: MARGIN_LEFT,
      y: currentY,
      size: 11,
      font: fontOblique,
      color: colorMuted,
    });
  } else {
    for (let tIndex = 0; tIndex < templates.length; tIndex++) {
      const t = templates[tIndex];

      if (currentY < 120) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        currentY = PAGE_HEIGHT - 50;
      }

      const sessionSuffix = t.sequenceNumber !== undefined ? ` (Session #${t.sequenceNumber})` : '';
      page.drawText(`${tIndex + 1}. ${t.name || 'Custom Template'}${sessionSuffix}`, {
        x: MARGIN_LEFT,
        y: currentY,
        size: 12,
        font: fontBold,
        color: colorDark,
      });
      currentY -= 14;

      const subInfo = `Focus: ${t.workoutFocus || 'General'}  |  Configured Exercises: ${t.exercises ? t.exercises.length : 0}`;
      page.drawText(subInfo, {
        x: MARGIN_LEFT,
        y: currentY,
        size: 8.5,
        font: fontRegular,
        color: colorMuted,
      });
      currentY -= 18;

      const exercises = t.exercises || [];
      if (exercises.length === 0) {
        page.drawText('No exercises configured in this template.', {
          x: MARGIN_LEFT + 10,
          y: currentY,
          size: 8.5,
          font: fontOblique,
          color: colorMuted,
        });
        currentY -= 20;
        continue;
      }

      const colWidths = [30, 180, 85, 55, 55, 55, 55]; // sum = 515
      const colHeaders = ['#', 'Exercise', 'Category', 'Target Sets', 'Target Reps', 'Rest Time', 'Target Wt'];

      const drawTableHeader = () => {
        page.drawRectangle({
          x: MARGIN_LEFT,
          y: currentY - 14,
          width: CONTENT_WIDTH,
          height: 16,
          color: colorHeaderBg,
        });

        let colX = MARGIN_LEFT + 4;
        for (let c = 0; c < colHeaders.length; c++) {
          page.drawText(colHeaders[c], {
            x: colX,
            y: currentY - 10,
            size: 7.5,
            font: fontBold,
            color: rgb(1, 1, 1),
          });
          colX += colWidths[c];
        }
        currentY -= 16;
      };

      drawTableHeader();

      for (let r = 0; r < exercises.length; r++) {
        if (currentY < 60) {
          page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          currentY = PAGE_HEIGHT - 50;
          drawTableHeader();
        }

        const ex = exercises[r];
        if (r % 2 === 1) {
          page.drawRectangle({
            x: MARGIN_LEFT,
            y: currentY - 12,
            width: CONTENT_WIDTH,
            height: 14,
            color: colorRowAlt,
          });
        }

        let colX = MARGIN_LEFT + 4;
        const values = [
          String(ex.order),
          ex.exerciseName || 'Exercise',
          ex.categoryName || '-',
          `${ex.sets} sets`,
          ex.targetReps || '-',
          `${ex.restTime}s`,
          ex.targetWeight !== undefined ? `${ex.targetWeight} kg` : '-',
        ];

        for (let c = 0; c < values.length; c++) {
          let textVal = values[c];
          if (c === 1 && textVal.length > 30) textVal = textVal.slice(0, 28) + '...';
          if (c === 2 && textVal.length > 14) textVal = textVal.slice(0, 12) + '..';

          page.drawText(textVal, {
            x: colX,
            y: currentY - 9,
            size: 7.5,
            font: fontRegular,
            color: colorDark,
          });
          colX += colWidths[c];
        }

        currentY -= 14;
      }

      currentY -= 16;
    }
  }

  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const p = pdfDoc.getPage(i);
    p.drawText(`Page ${i + 1} of ${totalPages}`, {
      x: PAGE_WIDTH / 2 - 25,
      y: 20,
      size: 8,
      font: fontRegular,
      color: colorMuted,
    });
  }

  return await pdfDoc.saveAsBase64();
}

/**
 * Converts a base64 encoded string into a Uint8Array byte buffer without Node Buffer.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Triggers file download (Web) or native OS share sheet (Mobile).
 * For binary files (xlsx, pdf), base64 content is written to a temporary cache file
 * so native share sheets receive a real file URI.
 */
export async function shareOrDownloadExport(
  filename: string,
  content: string,
  mimeType: string,
  isBase64: boolean = false
): Promise<boolean> {
  // Web browser download
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    let blob: Blob;
    if (isBase64) {
      const bytes = base64ToUint8Array(content);
      blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
    } else {
      blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  }

  // Native Mobile (iOS / Android)
  const isSharingAvailable = await Sharing.isAvailableAsync().catch(() => false);

  if (isSharingAvailable && FileSystem.cacheDirectory) {
    const fileUri = `${FileSystem.cacheDirectory}${filename}`;
    if (isBase64) {
      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } else {
      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }

    await Sharing.shareAsync(fileUri, {
      mimeType,
      dialogTitle: filename,
      UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined,
    });
    return true;
  }

  // Fallback if sharing is not available
  await Share.share({
    title: filename,
    message: isBase64 ? `BeBig Export: ${filename}` : content,
  });
  return true;
}
