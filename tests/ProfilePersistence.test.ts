import { profileService } from '../src/features/profile/services/profileService';
import { supabase, isSupabaseConfigured } from '../src/lib/supabase';
import { useAuthStore } from '../src/features/auth/store/useAuthStore';

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      updateUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
    },
  },
  isSupabaseConfigured: jest.fn(() => true),
}));

jest.mock('../src/features/auth/store/useAuthStore', () => ({
  useAuthStore: {
    getState: jest.fn().mockReturnValue({
      user: null,
      updateUserProfile: jest.fn(),
    }),
  },
}));

describe('profileService Persistence', () => {
  let mockUpdateUserProfile: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    profileService.clearMemoryCache();
    
    // Reset local storage for tests
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    
    const { useAuthStore } = require('../src/features/auth/store/useAuthStore');
    mockUpdateUserProfile = jest.fn();
    useAuthStore.getState.mockReturnValue({
      user: null,
      updateUserProfile: mockUpdateUserProfile,
    });
  });

  it('TEST 1 - SUCCESS: persists profile to cloud DB successfully, updates local & auth state', async () => {
    const singleSpy = jest.fn().mockResolvedValue({
      data: { id: 'test-user', display_name: 'Success' },
      error: null,
    });
    
    (supabase.from as jest.Mock).mockReturnValue({
      upsert: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: singleSpy }) }),
    });

    const result = await profileService.upsertProfile('test-user', { display_name: 'Success' });
    expect(result?.display_name).toBe('Success');
    
    // Auth metadata SHOULD be updated if DB upsert succeeds
    expect(supabase.auth.updateUser).toHaveBeenCalled();
    expect(mockUpdateUserProfile).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Success' }));
    
    // Memory cache should have it
    const cached = profileService.getCachedProfile('test-user');
    expect(cached?.display_name).toBe('Success');
  });

  it('TEST 2 - CLOUD FAILURE: function rejects, local & auth state remain unchanged', async () => {
    // Setup a known-good previous profile
    const singleSpy1 = jest.fn().mockResolvedValue({
      data: { id: 'test-user', display_name: 'Previous', onboarding_completed: true },
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValue({
      upsert: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: singleSpy1 }) }),
    });
    await profileService.upsertProfile('test-user', { display_name: 'Previous' });
    jest.clearAllMocks();

    // Now fail the next write
    const singleSpy2 = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Cloud Error' },
    });
    (supabase.from as jest.Mock).mockReturnValue({
      upsert: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: singleSpy2 }) }),
    });

    await expect(
      profileService.upsertProfile('test-user', { display_name: 'FailedUpdate' })
    ).rejects.toThrow('Cloud Error');
    
    // Auth metadata SHOULD NOT be updated if DB upsert fails
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    
    // Memory cache should remain the PREVIOUS profile
    const cached = profileService.getCachedProfile('test-user');
    expect(cached?.display_name).toBe('Previous');
  });

  it('TEST 3 - RETRY AFTER FAILURE: failed write does not poison state for next success', async () => {
    // Fail first write
    const singleSpyFail = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Cloud Error' },
    });
    (supabase.from as jest.Mock).mockReturnValueOnce({
      upsert: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: singleSpyFail }) }),
    });
    
    await expect(
      profileService.upsertProfile('test-user', { display_name: 'A' })
    ).rejects.toThrow('Cloud Error');

    expect(profileService.getCachedProfile('test-user')).toBeNull();

    // Succeed second write
    const singleSpySuccess = jest.fn().mockResolvedValue({
      data: { id: 'test-user', display_name: 'B' },
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValueOnce({
      upsert: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: singleSpySuccess }) }),
    });

    await profileService.upsertProfile('test-user', { display_name: 'B' });
    
    const cached = profileService.getCachedProfile('test-user');
    expect(cached?.display_name).toBe('B');
  });

  it('TEST 4 - CLOUD FIRST HYDRATION: getProfile queries public.profiles and fetches updated avatar_url even if local cache previously had null avatar', async () => {
    // Populate local storage with a stale profile that has no avatar
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        'bebig.profile.test-user-avatar',
        JSON.stringify({
          id: 'test-user-avatar',
          display_name: 'Stale Local User',
          avatar_url: null,
          onboarding_completed: true,
        })
      );
    }

    // Cloud has updated avatar_url
    const maybeSingleSpy = jest.fn().mockResolvedValue({
      data: {
        id: 'test-user-avatar',
        display_name: 'Cloud User',
        avatar_url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48',
        onboarding_completed: true,
      },
      error: null,
    });

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: maybeSingleSpy,
        }),
      }),
    });

    const result = await profileService.getProfile('test-user-avatar');

    expect(result?.avatar_url).toBe('https://images.unsplash.com/photo-1534438327276-14e5300c3a48');
    expect(result?.display_name).toBe('Cloud User');
  });
});
