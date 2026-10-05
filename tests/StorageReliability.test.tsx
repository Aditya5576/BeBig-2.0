import { platformStorage, idbStorage } from '../src/lib/storage/platformStorage';
import { Platform } from 'react-native';

describe('Storage Reliability', () => {
  const originalEnv = process.env.NODE_ENV;
  let mockLocalStorage: any;

  beforeEach(() => {
    process.env.NODE_ENV = 'production'; // Force platformStorage to enforce durable rules
    platformStorage.clearMemoryCache();
    jest.clearAllMocks();

    mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('TEST 1: Successful durable write resolves', async () => {
    Platform.OS = 'web';
    jest.spyOn(idbStorage, 'isAvailable').mockReturnValue(true);
    jest.spyOn(idbStorage, 'set').mockResolvedValue();

    await expect(platformStorage.setItem('test', 'val')).resolves.toBeUndefined();
    expect(idbStorage.set).toHaveBeenCalledWith('test', 'val');
  });

  it('TEST 2: IndexedDB fails but localStorage succeeds -> operation succeeds', async () => {
    Platform.OS = 'web';
    jest.spyOn(idbStorage, 'isAvailable').mockReturnValue(true);
    jest.spyOn(idbStorage, 'set').mockRejectedValue(new Error('IDB quota'));
    mockLocalStorage.setItem.mockImplementation(() => {}); // Success

    await expect(platformStorage.setItem('test', 'val')).resolves.toBeUndefined();
    expect(idbStorage.set).toHaveBeenCalled();
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('test', 'val');
  });

  it('TEST 3: IndexedDB fails AND localStorage fails -> operation rejects/throws', async () => {
    Platform.OS = 'web';
    jest.spyOn(idbStorage, 'isAvailable').mockReturnValue(true);
    jest.spyOn(idbStorage, 'set').mockRejectedValue(new Error('IDB fail'));
    mockLocalStorage.setItem.mockImplementation(() => {
      throw new Error('LS fail');
    });

    await expect(platformStorage.setItem('test', 'val')).rejects.toThrow('LS fail');
  });

  it('TEST 4: Memory cache must NOT make a fully failed durable write appear successful', async () => {
    Platform.OS = 'web';
    jest.spyOn(idbStorage, 'isAvailable').mockReturnValue(false); // IDB unavailable
    mockLocalStorage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });

    // Should throw despite memory cache attempting to intercept
    await expect(platformStorage.setItem('test', 'val')).rejects.toThrow('QuotaExceeded');
  });

  it('TEST 5: removeItem failure is observable when all durable deletion strategies fail', async () => {
    Platform.OS = 'web';
    jest.spyOn(idbStorage, 'isAvailable').mockReturnValue(true);
    jest.spyOn(idbStorage, 'remove').mockRejectedValue(new Error('IDB remove fail'));
    mockLocalStorage.removeItem.mockImplementation(() => {
      throw new Error('LS remove fail');
    });

    await expect(platformStorage.removeItem('test')).rejects.toThrow('LS remove fail');
  });
});
