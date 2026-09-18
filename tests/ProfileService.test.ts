import { profileService } from '../src/features/profile/services/profileService';
import { supabase } from '../src/lib/supabase';

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    },
  },
  isSupabaseConfigured: jest.fn(() => true),
}));

describe('profileService', () => {
  it('does not retry if RLS blocks access (42501)', async () => {
    const maybeSingleSpy = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42501' },
    });
    
    const fromSpy = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: maybeSingleSpy,
        }),
      }),
    });
    (supabase.from as jest.Mock).mockImplementation(fromSpy);

    await profileService.getProfile('test-user');
    
    expect(maybeSingleSpy).toHaveBeenCalledTimes(1);
  });
});
