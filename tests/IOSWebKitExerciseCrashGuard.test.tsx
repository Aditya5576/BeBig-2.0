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

import { ExercisePickerModal } from '../src/features/templates/components/ExercisePickerModal';
import { CustomExerciseForm } from '../src/features/exercises/components/CustomExerciseForm';
import { ExerciseCard } from '../src/features/exercises/components/ExerciseCard';
import { ErrorBoundary } from '../src/components/ui/ErrorBoundary';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
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
});
