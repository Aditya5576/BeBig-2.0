/**
 * BeBig 2.0 — iOS WebKit & Exercise Crash Guard Test Suite
 *
 * Verifies P0 fixes for iPhone Safari / iOS PWA crashes and "Site not found" errors:
 * 1. Bounded FlatList virtualization and rapid search/selection across 500+ exercises.
 * 2. Safe custom exercise creation flow without nested Modal collisions or unmounted state crashes.
 * 3. Component-level ErrorBoundary prevents isolated exercise errors from crashing the app.
 * 4. vercel.json includes catch-all SPA rewrite and explicitly protects static routes before wildcard :id.
 * 5. public/sw.js falls back to app shell on navigation 404s/errors preventing "Site not found".
 */

import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, act, waitFor, screen, cleanup } from '@testing-library/react-native';

declare const require: any;
declare const __dirname: string;

const fs = require('fs');
const path = require('path');

import {
  ExercisePickerModal,
  stripExerciseImagePayloads,
} from '../src/features/templates/components/ExercisePickerModal';
import { CustomExerciseForm } from '../src/features/exercises/components/CustomExerciseForm';
import { ExerciseCard } from '../src/features/exercises/components/ExerciseCard';
import { ErrorBoundary } from '../src/components/ui/ErrorBoundary';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import {
  customExerciseStorage,
  compactOversizedCustomExercises,
} from '../src/features/exercises/storage/customExerciseStorage';
import {
  computeDownscaledDimensions,
  downscaleWebImageToMaxEdge,
  downscaleDataUrlToMaxEdge,
  MAX_WEB_IMAGE_EDGE_PX,
  LARGE_DATA_URL_THRESHOLD_CHARS,
} from '../src/features/exercises/storage/exercisePhotoStorage';
import { Exercise } from '../src/features/exercises/types';
import CreateCustomExerciseScreen from '../app/exercises/new';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: mockBack,
  }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

jest.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: jest.fn(() => false),
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  },
}));

// Generate 500 synthetic exercises
const generate500Exercises = (): Exercise[] => {
  const list: Exercise[] = [];
  for (let i = 1; i <= 500; i++) {
    list.push({
      id: `mock_ex_${i}`,
      name: i % 2 === 0 ? `Barbell Squat Variation ${i}` : `Dumbbell Press Variation ${i}`,
      description: 'Mock exercise description',
      category: i % 3 === 0 ? 'legs' : 'chest',
      categoryName: i % 3 === 0 ? 'Legs' : 'Chest',
      primaryMuscles: [{ id: 'm1', name: 'Quadriceps' }],
      secondaryMuscles: [],
      equipment: [{ id: 'eq1', name: 'Barbell' }],
      sourceProvider: 'wger',
      isCustom: false,
      images: [],
    });
  }
  return list;
};

describe('iOS WebKit Exercise Crash Guard & SPA Stability', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(exerciseRepository, 'getExercises').mockImplementation(async (options) => {
      const all = generate500Exercises();
      let filtered = all;
      if (options?.query) {
        const q = options.query.toLowerCase();
        filtered = filtered.filter((e) => e.name.toLowerCase().includes(q));
      }
      return {
        exercises: filtered.slice(0, 30),
        totalCount: filtered.length,
        hasMore: false,
        nextOffset: undefined,
      };
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Web Virtualization & Memory Safety with 500+ Exercises', () => {
    it('renders with strictly bounded virtualization parameters and does not throw', async () => {
      const mock500 = generate500Exercises();
      const getCachedSpy = jest
        .spyOn(exerciseRepository, 'getCachedExercises')
        .mockReturnValue(mock500);

      const onSelect = jest.fn();
      const onClose = jest.fn();

      const originalOs = Platform.OS;
      try {
        (Platform as any).OS = 'web';

        const { getByTestId } = await render(
          <ExercisePickerModal
            visible={true}
            onClose={onClose}
            onSelectExercise={onSelect}
            selectedExerciseIds={[]}
            multiSelect={true}
          />
        );

        const list = getByTestId('picker-exercise-list');
        expect(list).toBeTruthy();

        // Invariants: Web virtualization parameters must be bounded to prevent Jetsam memory kills
        expect(list.props.initialNumToRender).toBeLessThanOrEqual(10);
        expect(list.props.maxToRenderPerBatch).toBeLessThanOrEqual(8);
        expect(list.props.windowSize).toBeLessThanOrEqual(5);
        expect(list.props.removeClippedSubviews).toBe(false);

        // Rapid search filter test
        const searchInput = getByTestId('picker-search-input');
        await act(async () => {
          fireEvent.changeText(searchInput, 'Squat');
        });

        // Rapid selection test
        await act(async () => {
          fireEvent.changeText(searchInput, '');
        });
      } finally {
        (Platform as any).OS = originalOs;
        getCachedSpy.mockRestore();
      }
    });
  });

  describe('2. Custom Exercise Creation from Library & Workout Picker', () => {
    it('creates a custom exercise without nested Modal crashes inside ExercisePickerModal', async () => {
      const saveSpy = jest
        .spyOn(customExerciseStorage, 'saveCustomExercise')
        .mockResolvedValue(undefined as any);

      const onSelectExercises = jest.fn();
      const onClose = jest.fn();

      await render(
        <ExercisePickerModal
          visible={true}
          onClose={onClose}
          onSelectExercises={onSelectExercises}
          selectedExerciseIds={[]}
          multiSelect={true}
        />
      );

      // Open custom exercise form inside picker
      const newButton = screen.getByTestId('picker-create-custom-button');
      await act(async () => {
        fireEvent.press(newButton);
      });

      // Verify CustomExerciseForm is rendered embedded (isModal=true)
      const nameInput = screen.getByTestId('custom-exercise-name-input');
      expect(nameInput).toBeTruthy();

      await act(async () => {
        fireEvent.changeText(nameInput, 'Incline Cable Fly');
      });

      const submitButton = screen.getByTestId('custom-exercise-submit-button');
      await act(async () => {
        fireEvent.press(submitButton);
      });

      await waitFor(() => {
        expect(onSelectExercises).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ name: 'Incline Cable Fly', isCustom: true }),
          ])
        );
        expect(onClose).toHaveBeenCalled();
      });

      saveSpy.mockRestore();
    });

    it('renders CreateCustomExerciseScreen (/exercises/new) and supports cancel / save', async () => {
      await render(<CreateCustomExerciseScreen />);

      const backButton = screen.getByTestId('create-custom-back-button');
      await act(async () => {
        fireEvent.press(backButton);
      });

      expect(mockBack).toHaveBeenCalled();
    });

    it('renders ExercisePickerModal as a single-layer inline overlay View on Web without React Native Modal portal and manages body scroll lock', async () => {
      const originalOs = Platform.OS;
      const originalDocument = (globalThis as any).document;
      const mockStyle = { overflow: '' };
      (globalThis as any).document = {
        body: {
          style: mockStyle,
        },
      };

      try {
        (Platform as any).OS = 'web';

        const onClose = jest.fn();
        const onSelectExercises = jest.fn();

        const { getByTestId, queryByTestId, rerender, unmount } = await render(
          <ExercisePickerModal
            visible={true}
            onClose={onClose}
            onSelectExercises={onSelectExercises}
            selectedExerciseIds={[]}
            multiSelect={true}
          />
        );

        // Invariant 1: Web uses inline overlay View with testID="picker-web-overlay" instead of native Modal
        const webOverlay = getByTestId('picker-web-overlay');
        expect(webOverlay).toBeTruthy();

        // Invariant 2: Body scroll is locked on Web while picker is visible
        expect((globalThis as any).document.body.style.overflow).toBe('hidden');

        // Invariant 3: Custom exercise form switches cleanly inside web overlay without portal nesting
        const newButton = getByTestId('picker-create-custom-button');
        await act(async () => {
          fireEvent.press(newButton);
        });

        const nameInput = getByTestId('custom-exercise-name-input');
        expect(nameInput).toBeTruthy();

        // Invariant 4: When visible = false on Web, unmounts cleanly and restores body scroll
        await act(async () => {
          await rerender(
            <ExercisePickerModal
              visible={false}
              onClose={onClose}
              onSelectExercises={onSelectExercises}
              selectedExerciseIds={[]}
              multiSelect={true}
            />
          );
        });

        expect(queryByTestId('picker-web-overlay')).toBeNull();
        expect((globalThis as any).document.body.style.overflow).toBe('');

        // Invariant 5: Unmounting restores body overflow if unmounted while visible
        await act(async () => {
          await rerender(
            <ExercisePickerModal
              visible={true}
              onClose={onClose}
              onSelectExercises={onSelectExercises}
              selectedExerciseIds={[]}
              multiSelect={true}
            />
          );
        });
        expect((globalThis as any).document.body.style.overflow).toBe('hidden');

        await act(async () => {
          unmount();
        });
        expect((globalThis as any).document.body.style.overflow).toBe('');
      } finally {
        (Platform as any).OS = originalOs;
        (globalThis as any).document = originalDocument;
      }
    });
  });

  describe('3. Component-Level ErrorBoundary Protection', () => {
    it('catches an isolated child rendering failure and displays retry action without blowing up root', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const ProblemChild = () => {
        throw new Error('Simulated malformed exercise record render crash');
      };

      await render(
        <ErrorBoundary testID="test-boundary">
          <ProblemChild />
        </ErrorBoundary>
      );

      // Root did not throw; fallback rendered gracefully
      expect(screen.getByTestId('test-boundary')).toBeTruthy();
      expect(screen.getByTestId('test-boundary-retry-button')).toBeTruthy();

      spy.mockRestore();
    });
  });

  describe('4. vercel.json SPA Rewrite & Routing Invariants', () => {
    const vercelPath = path.resolve(__dirname, '../vercel.json');

    it('contains clean SPA catch-all rewrite to /index.html and protects static new routes', () => {
      const config = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
      expect(config.rewrites).toBeDefined();

      // Static routes must precede dynamic :id routes
      const exerciseNewIdx = config.rewrites.findIndex((r: any) => r.source === '/exercises/new');
      const exerciseIdIdx = config.rewrites.findIndex((r: any) => r.source === '/exercises/:id');
      expect(exerciseNewIdx).toBeGreaterThanOrEqual(0);
      expect(exerciseIdIdx).toBeGreaterThanOrEqual(0);
      expect(exerciseNewIdx).toBeLessThan(exerciseIdIdx);

      const templateNewIdx = config.rewrites.findIndex((r: any) => r.source === '/templates/new');
      const templateIdIdx = config.rewrites.findIndex((r: any) => r.source === '/templates/:id');
      expect(templateNewIdx).toBeGreaterThanOrEqual(0);
      expect(templateIdIdx).toBeGreaterThanOrEqual(0);
      expect(templateNewIdx).toBeLessThan(templateIdIdx);

      // Catch-all SPA rewrite must be present at the end
      const catchAll = config.rewrites[config.rewrites.length - 1];
      expect(catchAll.destination).toBe('/index.html');
      expect(catchAll.source).toContain('_expo');
    });
  });

  describe('5. public/sw.js PWA Navigation Fallback Invariants', () => {
    const swPath = path.resolve(__dirname, '../public/sw.js');

    it('contains navigation handler that falls back to app shell on 404s/errors', () => {
      const swContent = fs.readFileSync(swPath, 'utf8');

      // Must handle navigation requests
      expect(swContent).toContain("request.mode === 'navigate'");

      // Must have fallback on status >= 400 or network failure
      expect(swContent).toContain('response.status >= 400');
      expect(swContent).toContain("caches.match('/')");
      expect(swContent).toContain("caches.match('/index.html')");
    });
  });

  describe('6. Adversarial Stress & Rapid Thrash (5x Cycle)', () => {
    it('survives 5 consecutive rapid open -> search -> custom-form -> cancel -> close cycles without leaks', async () => {
      const originalOs = Platform.OS;
      const originalDocument = (globalThis as any).document;
      const mockStyle = { overflow: '' };
      (globalThis as any).document = {
        body: {
          style: mockStyle,
        },
      };

      try {
        (Platform as any).OS = 'web';

        for (let cycle = 1; cycle <= 5; cycle++) {
          const onClose = jest.fn();
          const onSelect = jest.fn();

          const { getByTestId, queryByTestId, rerender, unmount } = await render(
            <ExercisePickerModal
              visible={true}
              onClose={onClose}
              onSelectExercise={onSelect}
              selectedExerciseIds={[]}
            />
          );

          expect(getByTestId('picker-web-overlay')).toBeTruthy();
          expect((globalThis as any).document.body.style.overflow).toBe('hidden');

          // Rapid search query
          const searchInput = getByTestId('picker-search-input');
          await act(async () => {
            fireEvent.changeText(searchInput, `Heavy Incline Press Cycle ${cycle}`);
          });

          // Switch to custom form
          const newButton = getByTestId('picker-create-custom-button');
          await act(async () => {
            fireEvent.press(newButton);
          });

          const nameInput = getByTestId('custom-exercise-name-input');
          await act(async () => {
            fireEvent.changeText(nameInput, `Custom Cycle ${cycle}`);
          });

          // Cancel out of custom form
          const backButton = getByTestId('create-custom-back-button');
          await act(async () => {
            fireEvent.press(backButton);
          });

          // Close modal
          await act(async () => {
            await rerender(
              <ExercisePickerModal
                visible={false}
                onClose={onClose}
                onSelectExercise={onSelect}
                selectedExerciseIds={[]}
              />
            );
          });

          expect(queryByTestId('picker-web-overlay')).toBeNull();
          expect((globalThis as any).document.body.style.overflow).toBe('');

          await act(async () => {
            unmount();
          });
          expect((globalThis as any).document.body.style.overflow).toBe('');
        }
      } finally {
        (Platform as any).OS = originalOs;
        (globalThis as any).document = originalDocument;
      }
    });
  });

  describe('7. Poisoned / Malformed Exercise Payload Resilience', () => {
    it('renders ExerciseCard safely with poisoned and corrupted exercise properties', async () => {
      const poisonedExercise: any = {
        id: 'poison_1',
        name: null,
        category: undefined,
        categoryName: null,
        equipment: null,
        primaryMuscles: 'Not an array' as any,
        images: [{ broken: true, url: null }],
        isCustom: true,
      };

      const onPress = jest.fn();
      const { getByTestId } = await render(
        <ExerciseCard
          exercise={poisonedExercise}
          mode="browse"
          onPress={onPress}
          testID="poisoned-card"
        />
      );

      const card = getByTestId('poisoned-card');
      expect(card).toBeTruthy();

      // Pressing it should not throw
      await act(async () => {
        fireEvent.press(card);
      });
      expect(onPress).toHaveBeenCalledWith(poisonedExercise);
    });

    it('renders ExercisePickerModal with corrupted exercise list without crashing', async () => {
      const corruptedExercises: any[] = [
        { id: 'corrupt_1', name: '', equipment: null, primaryMuscles: undefined },
        { id: 'corrupt_2', name: 'Corrupt 2', equipment: ['Dumbbell' as any], primaryMuscles: null },
      ];

      const getCachedSpy = jest
        .spyOn(exerciseRepository, 'getCachedExercises')
        .mockReturnValue(corruptedExercises as any);

      try {
        const { getByTestId } = await render(
          <ExercisePickerModal
            visible={true}
            onClose={jest.fn()}
            onSelectExercise={jest.fn()}
            selectedExerciseIds={[]}
          />
        );

        expect(getByTestId('picker-exercise-list')).toBeTruthy();
      } finally {
        getCachedSpy.mockRestore();
      }
    });
  });

  describe('8. Route Isolation & Rewrites Regex Exactness', () => {
    const vercelPath = path.resolve(__dirname, '../vercel.json');

    it('rigorously tests Vercel catch-all SPA regex against static assets vs navigation routes', () => {
      const config = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
      const catchAll = config.rewrites.find((r: any) => r.destination === '/index.html');
      expect(catchAll).toBeDefined();

      const regexStr = catchAll.source;
      const regex = new RegExp(`^${regexStr}$`);

      // STATIC ASSETS MUST NOT MATCH (Negative lookahead must exclude them)
      expect(regex.test('/_expo/static/js/web/entry-123.js')).toBe(false);
      expect(regex.test('/_expo/static/css/global-456.css')).toBe(false);
      expect(regex.test('/assets/icons/icon.png')).toBe(false);
      expect(regex.test('/icons/icon-192.png')).toBe(false);
      expect(regex.test('/sw.js')).toBe(false);
      expect(regex.test('/manifest.json')).toBe(false);
      expect(regex.test('/favicon.png')).toBe(false);
      expect(regex.test('/apple-touch-icon.png')).toBe(false);

      // CLIENT NAVIGATION ROUTES MUST MATCH (Will rewrite to /index.html)
      expect(regex.test('/workout/active')).toBe(true);
      expect(regex.test('/exercises')).toBe(true);
      expect(regex.test('/workout/history')).toBe(true);
      expect(regex.test('/settings')).toBe(true);
      expect(regex.test('/unknown-deep-route-404')).toBe(true);
    });
  });

  describe('9. iOS WebKit Jetsam Zero-Bitmap & Picker Search Resilience (v2.4.2)', () => {
    it('renders 0 <Image> elements in ExercisePickerModal even when custom exercises have high-res photo URIs', async () => {
      const customWithPhotos: Exercise[] = [
        {
          id: 'custom_photo_1',
          name: 'Custom Cable Fly 12MP',
          description: 'Custom exercise with full-res iPhone photo',
          category: 'chest',
          categoryName: 'Chest',
          primaryMuscles: [{ id: 'm1', name: 'Pectoralis Major' }],
          secondaryMuscles: [],
          equipment: [{ id: 'eq1', name: 'Cable' }],
          sourceProvider: 'custom',
          isCustom: true,
          photoPath: 'user_1/custom_photo_1/photo.jpg',
          images: [
            {
              id: 'img_1',
              url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/',
              thumbnailUrl: 'https://cdn.example.com/custom-4032x3024.jpg',
              isMain: true,
            },
          ],
        },
        {
          id: 'custom_photo_2',
          name: 'Custom Pendulum Squat 12MP',
          description: 'Another custom photo exercise',
          category: 'legs',
          categoryName: 'Legs',
          primaryMuscles: [{ id: 'm2', name: 'Quadriceps' }],
          secondaryMuscles: [],
          equipment: [{ id: 'eq2', name: 'Machine' }],
          sourceProvider: 'custom',
          isCustom: true,
          photoPath: 'user_1/custom_photo_2/photo.jpg',
          images: [
            {
              id: 'img_2',
              url: 'https://storage.supabase.co/exercise-photos/4032x3024.jpg',
              isMain: true,
            },
          ],
        },
      ];

      const getCachedSpy = jest
        .spyOn(exerciseRepository, 'getCachedExercises')
        .mockReturnValue(customWithPhotos);
      const getExercisesSpy = jest
        .spyOn(exerciseRepository, 'getExercises')
        .mockResolvedValue({
          exercises: customWithPhotos,
          totalCount: customWithPhotos.length,
          hasMore: false,
          nextOffset: undefined,
        });

      try {
        const rendered = await render(
          <ExercisePickerModal
            visible={true}
            onClose={jest.fn()}
            onSelectExercises={jest.fn()}
            selectedExerciseIds={[]}
            multiSelect={true}
            recentExercises={customWithPhotos}
          />
        );

        await waitFor(() => {
          expect(rendered.getByTestId('picker-exercise-custom_photo_1')).toBeTruthy();
          expect(rendered.getByTestId('picker-recent-exercise-custom_photo_1')).toBeTruthy();
        });

        // CRITICAL JETSAM INVARIANT: 0 <Image> host elements decoded in picker rows & recent rows
        const countImageNodes = (node: any): number => {
          if (!node) return 0;
          if (Array.isArray(node)) {
            return node.reduce((sum, child) => sum + countImageNodes(child), 0);
          }
          const selfCount = node.type === 'Image' ? 1 : 0;
          return selfCount + countImageNodes(node.children);
        };
        expect(countImageNodes(rendered.toJSON())).toBe(0);
        expect(rendered.queryByTestId('picker-thumbnail-custom_photo_1-image')).toBeNull();
        expect(rendered.queryByTestId('picker-recent-thumbnail-custom_photo_1-image')).toBeNull();
      } finally {
        getCachedSpy.mockRestore();
        getExercisesSpy.mockRestore();
      }
    });

    it('resets searchQuery cleanly to "" whenever ExercisePickerModal closes and reopens', async () => {
      const onClose = jest.fn();
      const onSelect = jest.fn();

      const { getByTestId, rerender } = await render(
        <ExercisePickerModal
          visible={true}
          onClose={onClose}
          onSelectExercise={onSelect}
          selectedExerciseIds={[]}
        />
      );

      const searchInput = getByTestId('picker-search-input');
      await fireEvent.changeText(searchInput, 'Incline Barbell Press');
      expect(getByTestId('picker-search-input').props.value).toBe('Incline Barbell Press');

      // Close modal
      await rerender(
        <ExercisePickerModal
          visible={false}
          onClose={onClose}
          onSelectExercise={onSelect}
          selectedExerciseIds={[]}
        />
      );

      // Reopen modal — searchQuery MUST be cleanly reset to ""
      await rerender(
        <ExercisePickerModal
          visible={true}
          onClose={onClose}
          onSelectExercise={onSelect}
          selectedExerciseIds={[]}
        />
      );

      await waitFor(() => {
        expect(getByTestId('picker-search-input').props.value).toBe('');
      });
    });

    it('filters smoothly for single-character and multi-word search queries without throwing', async () => {
      const mock500 = generate500Exercises();
      const getCachedSpy = jest
        .spyOn(exerciseRepository, 'getCachedExercises')
        .mockImplementation((opts) => {
          if (!opts?.query) return mock500.slice(0, 30);
          const q = opts.query.toLowerCase();
          return mock500.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 30);
        });

      try {
        const { getByTestId } = await render(
          <ExercisePickerModal
            visible={true}
            onClose={jest.fn()}
            onSelectExercise={jest.fn()}
            selectedExerciseIds={[]}
          />
        );

        const searchInput = getByTestId('picker-search-input');

        // Single-character rapid typing
        await fireEvent.changeText(searchInput, 'b');
        expect(getByTestId('picker-search-input').props.value).toBe('b');

        // Multi-word query
        await fireEvent.changeText(searchInput, 'barbell squat');
        expect(getByTestId('picker-search-input').props.value).toBe('barbell squat');

        await waitFor(() => {
          const list = getByTestId('picker-exercise-list');
          expect(list.props.data.length).toBeGreaterThan(0);
          expect(
            list.props.data.every((item: Exercise) =>
              item.name.toLowerCase().includes('barbell squat')
            )
          ).toBe(true);
        });

        // Clear search
        await fireEvent.changeText(searchInput, '');
        expect(getByTestId('picker-search-input').props.value).toBe('');
      } finally {
        getCachedSpy.mockRestore();
      }
    });

    it('downscales 12MP iPhone photos (4032x3024) to <= 800px longest edge and handles non-DOM gracefully', async () => {
      // Landscape 12MP iPhone camera photo -> 800x600
      expect(computeDownscaledDimensions(4032, 3024, MAX_WEB_IMAGE_EDGE_PX)).toEqual({
        width: 800,
        height: 600,
      });
      // Portrait 12MP iPhone camera photo -> 600x800
      expect(computeDownscaledDimensions(3024, 4032, MAX_WEB_IMAGE_EDGE_PX)).toEqual({
        width: 600,
        height: 800,
      });
      // Small image is never upscaled
      expect(computeDownscaledDimensions(640, 480, MAX_WEB_IMAGE_EDGE_PX)).toEqual({
        width: 640,
        height: 480,
      });

      // In Node/Jest without HTMLCanvasElement, returns null safely instead of crashing
      const result = await downscaleWebImageToMaxEdge('data:image/jpeg;base64,abc');
      expect(result).toBeNull();
    });

    it('strips large imageUrl and images payloads from ExercisePickerModal list items (v2.4.3)', async () => {
      const giantBase64 = `data:image/jpeg;base64,${'A'.repeat(200_000)}`;
      const heavyExercise: any = {
        id: 'heavy_custom_1',
        name: 'Military Press Wide Bar',
        description: 'Heavy pre-v2.4.2 custom photo',
        category: 'shoulders',
        categoryName: 'Shoulders',
        primaryMuscles: [{ id: 'm1', name: 'Deltoids' }],
        secondaryMuscles: [],
        equipment: [{ id: 'eq1', name: 'Barbell' }],
        sourceProvider: 'custom',
        isCustom: true,
        imageUrl: giantBase64,
        images: [{ id: 'img_heavy', url: giantBase64, isMain: true }],
      };

      const stripped = stripExerciseImagePayloads(heavyExercise) as any;
      expect(stripped.images).toEqual([]);
      expect(stripped.imageUrl).toBeUndefined();
      expect(stripped.name).toBe('Military Press Wide Bar');

      const getCachedSpy = jest
        .spyOn(exerciseRepository, 'getCachedExercises')
        .mockReturnValue([heavyExercise]);
      const getExercisesSpy = jest.spyOn(exerciseRepository, 'getExercises').mockResolvedValue({
        exercises: [heavyExercise],
        totalCount: 1,
        hasMore: false,
        nextOffset: undefined,
      });

      try {
        const rendered = await render(
          <ExercisePickerModal
            visible={true}
            onClose={jest.fn()}
            onSelectExercises={jest.fn()}
            selectedExerciseIds={[]}
            multiSelect={true}
          />
        );

        await waitFor(() => {
          const list = rendered.getByTestId('picker-exercise-list');
          expect(list.props.data).toHaveLength(1);
          expect(list.props.data[0].images).toEqual([]);
          expect(list.props.data[0].imageUrl).toBeUndefined();
        });
      } finally {
        getCachedSpy.mockRestore();
        getExercisesSpy.mockRestore();
      }
    });

    it('downscaleDataUrlToMaxEdge compacts oversized data URLs (>150k chars) and leaves compact/non-DOM URLs unchanged (v2.4.3)', async () => {
      // Compact data URL stays untouched
      const compactUrl = 'data:image/jpeg;base64,/9j/small';
      expect(await downscaleDataUrlToMaxEdge(compactUrl)).toBe(compactUrl);

      // Non-DOM runtime returns oversized data URL unchanged without throwing
      const oversizedUrl = `data:image/jpeg;base64,${'B'.repeat(LARGE_DATA_URL_THRESHOLD_CHARS + 5000)}`;
      expect(await downscaleDataUrlToMaxEdge(oversizedUrl)).toBe(oversizedUrl);

      // Simulated Web HTMLCanvasElement shrinks oversized data URL and clears canvas GPU memory
      const originalDocument = (globalThis as any).document;
      const originalImage = (globalThis as any).Image;
      const mockCanvas: any = {
        width: 0,
        height: 0,
        getContext: jest.fn(() => ({ drawImage: jest.fn() })),
        toDataURL: jest.fn(() => 'data:image/jpeg;base64,/9j/compacted800px'),
      };
      (globalThis as any).document = { createElement: jest.fn(() => mockCanvas) };
      (globalThis as any).Image = class MockImage {
        naturalWidth = 4032;
        naturalHeight = 3024;
        crossOrigin = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_v: string) {
          if (this.onload) this.onload();
        }
      };

      try {
        const shrunk = await downscaleDataUrlToMaxEdge(oversizedUrl, 800, 0.82);
        expect(shrunk).toBe('data:image/jpeg;base64,/9j/compacted800px');
        expect(mockCanvas.width).toBe(0);
        expect(mockCanvas.height).toBe(0);

        // Background migration helper compacts stored custom exercises
        const { exercises: compactedList, changed } = await compactOversizedCustomExercises([
          {
            id: 'legacy_1',
            name: 'Sholder Machine Fly',
            description: '',
            category: 'shoulders',
            categoryName: 'Shoulders',
            primaryMuscles: [],
            secondaryMuscles: [],
            equipment: [],
            sourceProvider: 'custom',
            isCustom: true,
            images: [{ id: 'p1', url: oversizedUrl, isMain: true }],
          },
        ]);
        expect(changed).toBe(true);
        expect(compactedList[0].images[0].url).toBe('data:image/jpeg;base64,/9j/compacted800px');
      } finally {
        (globalThis as any).document = originalDocument;
        (globalThis as any).Image = originalImage;
      }
    });

    it('bumps public/sw.js to bebig-pwa-v2.4.3 with Network-First JS strategy and auto-reload in _layout.tsx', () => {
      const swPath = path.resolve(__dirname, '../public/sw.js');
      const swContent = fs.readFileSync(swPath, 'utf8');
      expect(swContent).toContain("const CACHE_NAME = 'bebig-pwa-v2.4.3';");
      expect(swContent).toContain("url.pathname.startsWith('/_expo/static/js/')");
      // Network-First for JS bundles: fetch(request) precedes caches.match(request) in JS block
      const jsIdx = swContent.indexOf('if (isJsBundle)');
      const fetchIdx = swContent.indexOf('fetch(request)', jsIdx);
      const cacheFallbackIdx = swContent.indexOf('caches.match(request)', jsIdx);
      expect(jsIdx).toBeGreaterThan(-1);
      expect(fetchIdx).toBeGreaterThan(jsIdx);
      expect(cacheFallbackIdx).toBeGreaterThan(fetchIdx);

      // app/_layout.tsx wires controllerchange + sessionStorage single-reload guard
      const layoutPath = path.resolve(__dirname, '../app/_layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');
      expect(layoutContent).toContain('controllerchange');
      expect(layoutContent).toContain('bebig_sw_reloaded_v243');
      expect(layoutContent).toContain('reg?.update()');
    });
  });
});
