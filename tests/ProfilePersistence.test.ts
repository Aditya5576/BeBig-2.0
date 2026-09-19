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

describe('profileService Persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    profileService.clearMemoryCache();
  });

  it('distinguishes DB failure from local fallback (throws on cloud error)', async () => {
    const singleSpy = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'relation "profiles" does not exist' },
    });
    
    (supabase.from as jest.Mock).mockReturnValue({
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: singleSpy,
        }),
      }),
    });

    await expect(
      profileService.upsertProfile('test-user', { display_name: 'Test' })
    ).rejects.toThrow('relation "profiles" does not exist');
    
    // Auth metadata SHOULD NOT be updated if DB upsert fails
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('persists profile to cloud DB successfully', async () => {
    const singleSpy = jest.fn().mockResolvedValue({
      data: { id: 'test-user', display_name: 'Success' },
      error: null,
    });
    
    (supabase.from as jest.Mock).mockReturnValue({
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: singleSpy,
        }),
      }),
    });

    const result = await profileService.upsertProfile('test-user', { display_name: 'Success' });
    expect(result?.display_name).toBe('Success');
    expect(result?.onboarding_completed).toBe(false); // since we didn't specify
    
    // Auth metadata SHOULD be updated if DB upsert succeeds
    expect(supabase.auth.updateUser).toHaveBeenCalled();
  });
});
