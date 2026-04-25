const createMockQuery = (result, tracker) => {
  const builder = {
    select: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    upsert: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    single: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };

  tracker.builder = builder;
  return builder;
};

describe('supabase service helpers', () => {
  let mockSupabase;
  let services;
  let tableTrackers;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    tableTrackers = {};
    mockSupabase = {
      auth: {
        signInWithOAuth: jest.fn(),
        setSession: jest.fn(),
        exchangeCodeForSession: jest.fn(),
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        getSession: jest.fn(),
        getUser: jest.fn(),
      },
      from: jest.fn((table) => {
        const tracker = { table };
        tableTrackers[table] = tracker;
        return createMockQuery({ data: null, error: null }, tracker);
      }),
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn(),
          getPublicUrl: jest.fn(),
          createSignedUrl: jest.fn(),
        })),
      },
    };

    jest.doMock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => mockSupabase),
    }));

    jest.doMock('expo-linking', () => ({
      createURL: jest.fn((path) => `kore://${path}`),
    }));

    jest.doMock('expo-web-browser', () => ({
      maybeCompleteAuthSession: jest.fn(),
      openAuthSessionAsync: jest.fn(),
    }));

    jest.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }));

    services = require('../supabase');
  });

  test('getSession returns the session when present', async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1' } } },
    });

    await expect(services.getSession()).resolves.toEqual({ user: { id: 'user-1' } });
  });

  test('getCurrentUser returns null when no user exists', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
    });

    await expect(services.getCurrentUser()).resolves.toBeNull();
  });

  test('signOut throws when supabase auth returns an error', async () => {
    mockSupabase.auth.signOut.mockResolvedValueOnce({
      error: new Error('sign out failed'),
    });

    await expect(services.signOut()).rejects.toThrow('sign out failed');
  });

  test('getProfile returns null on query error', async () => {
    mockSupabase.from.mockImplementationOnce((table) => {
      const tracker = { table };
      tableTrackers[table] = tracker;
      return createMockQuery({ data: null, error: new Error('missing') }, tracker);
    });

    await expect(services.getProfile('user-1')).resolves.toBeNull();
  });

  test('getProfileState marks profile as missing for not-found responses', async () => {
    mockSupabase.from.mockImplementationOnce((table) => {
      const tracker = { table };
      tableTrackers[table] = tracker;
      return createMockQuery({
        data: null,
        error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
      }, tracker);
    });

    await expect(services.getProfileState('user-1')).resolves.toEqual({
      profile: null,
      missing: true,
    });
  });

  test('getProfileState throws on non-not-found query errors', async () => {
    mockSupabase.from.mockImplementationOnce((table) => {
      const tracker = { table };
      tableTrackers[table] = tracker;
      return createMockQuery({
        data: null,
        error: { code: '500', message: 'network failed' },
      }, tracker);
    });

    await expect(services.getProfileState('user-1')).rejects.toMatchObject({
      message: 'network failed',
    });
  });

  test('upsertProfile upserts by id conflict target', async () => {
    mockSupabase.from.mockImplementationOnce((table) => {
      const tracker = { table };
      tableTrackers[table] = tracker;
      return createMockQuery({ data: [{ id: 'user-1' }], error: null }, tracker);
    });

    await expect(services.upsertProfile({
      userId: 'user-1',
      username: 'lowbie',
      displayName: 'Lowbie',
      avatarColor: '#E8630A',
      avatarUrl: 'https://example.com/avatar.jpg',
    })).resolves.toEqual([{ id: 'user-1' }]);

    expect(tableTrackers.profiles.builder.upsert).toHaveBeenCalledWith(
      {
        id: 'user-1',
        username: 'lowbie',
        display_name: 'Lowbie',
        avatar_color: '#E8630A',
        avatar_url: 'https://example.com/avatar.jpg',
      },
      { onConflict: 'id' }
    );
  });

  test('getCloudHistory maps rows to entry data', async () => {
    mockSupabase.from.mockImplementationOnce((table) => {
      const tracker = { table };
      tableTrackers[table] = tracker;
      return createMockQuery({
        data: [{ data: { title: 'Frieren' } }, { data: { title: 'Dungeon Meshi' } }],
        error: null,
      }, tracker);
    });

    await expect(services.getCloudHistory('user-1')).resolves.toEqual([
      { title: 'Frieren' },
      { title: 'Dungeon Meshi' },
    ]);
  });

  test('getCloudRatings maps rows to title/rating objects', async () => {
    mockSupabase.from.mockImplementationOnce((table) => {
      const tracker = { table };
      tableTrackers[table] = tracker;
      return createMockQuery({
        data: [{ title: 'Frieren', rating: 'loved' }],
        error: null,
      }, tracker);
    });

    await expect(services.getCloudRatings('user-1')).resolves.toEqual([
      { title: 'Frieren', rating: 'loved' },
    ]);
  });

  test('checkUsernameAvailable lowercases and trims before querying', async () => {
    mockSupabase.from.mockImplementationOnce((table) => {
      const tracker = { table };
      tableTrackers[table] = tracker;
      return createMockQuery({ data: null, error: null }, tracker);
    });

    await expect(services.checkUsernameAvailable('  Lowbie  ')).resolves.toBe(true);
    expect(tableTrackers.profiles.builder.eq).toHaveBeenCalledWith('username', 'lowbie');
  });

  test('uploadAvatar returns the storage path for the saved avatar', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const getPublicUrl = jest.fn(() => ({
      data: { publicUrl: 'https://cdn.example.com/avatar.jpg' },
    }));
    const createSignedUrl = jest.fn();
    mockSupabase.storage.from.mockImplementation(() => ({ upload, getPublicUrl, createSignedUrl }));

    global.fetch = jest.fn().mockResolvedValueOnce({
      blob: async () => 'blob-data',
    });

    await expect(services.uploadAvatar('user-1', 'file://avatar.jpg')).resolves.toBe(
      'user-1/avatar.jpg'
    );
  });

  test('getRenderableAvatarUrl converts a storage path into a public avatar URL', () => {
    const getPublicUrl = jest.fn(() => ({
      data: { publicUrl: 'https://cdn.example.com/storage-avatar.jpg' },
    }));
    const createSignedUrl = jest.fn();
    mockSupabase.storage.from.mockImplementation(() => ({ upload: jest.fn(), getPublicUrl, createSignedUrl }));

    expect(services.getRenderableAvatarUrl('avatars/user-1/avatar.jpg')).toBe(
      'https://cdn.example.com/storage-avatar.jpg'
    );
    expect(getPublicUrl).toHaveBeenCalledWith('user-1/avatar.jpg');
  });

  test('getRenderableAvatarUrl preserves a signed avatar URL without downgrading it', () => {
    const getPublicUrl = jest.fn(() => ({
      data: { publicUrl: 'https://cdn.example.com/storage-avatar.jpg' },
    }));
    const createSignedUrl = jest.fn();
    mockSupabase.storage.from.mockImplementation(() => ({ upload: jest.fn(), getPublicUrl, createSignedUrl }));

    const signedUrl = 'https://cdn.example.com/storage-avatar.jpg?token=abc123&t=1';

    expect(services.getRenderableAvatarUrl(signedUrl)).toBe(signedUrl);
    expect(getPublicUrl).not.toHaveBeenCalled();
  });

  test('resolveAvatarUrl prefers a signed URL for stored avatars', async () => {
    const upload = jest.fn();
    const getPublicUrl = jest.fn(() => ({
      data: { publicUrl: 'https://cdn.example.com/storage-avatar.jpg' },
    }));
    const createSignedUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://cdn.example.com/storage-avatar.jpg?token=abc' },
      error: null,
    });
    mockSupabase.storage.from.mockImplementation(() => ({ upload, getPublicUrl, createSignedUrl }));

    await expect(services.resolveAvatarUrl('user-1/avatar.jpg')).resolves.toBe(
      'https://cdn.example.com/storage-avatar.jpg?token=abc'
    );
    expect(createSignedUrl).toHaveBeenCalledWith('user-1/avatar.jpg', 2592000);
  });

  test('uploadAvatar accepts a file-like object without refetching it', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const getPublicUrl = jest.fn(() => ({
      data: { publicUrl: 'https://cdn.example.com/avatar.jpg' },
    }));
    const createSignedUrl = jest.fn();
    mockSupabase.storage.from.mockImplementation(() => ({ upload, getPublicUrl, createSignedUrl }));

    global.fetch = jest.fn();

    const file = { name: 'avatar.png', type: 'image/png' };
    await expect(services.uploadAvatar('user-1', file, 'image/png')).resolves.toBe(
      'user-1/avatar.png'
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(upload).toHaveBeenCalledWith(
      'user-1/avatar.png',
      file,
      expect.objectContaining({ upsert: true, contentType: 'image/png' })
    );
  });

  test('uploadAvatar throws when storage upload fails', async () => {
    const upload = jest.fn().mockResolvedValue({ error: new Error('upload failed') });
    const getPublicUrl = jest.fn();
    const createSignedUrl = jest.fn();
    mockSupabase.storage.from.mockImplementation(() => ({ upload, getPublicUrl, createSignedUrl }));

    global.fetch = jest.fn().mockResolvedValueOnce({
      blob: async () => 'blob-data',
    });

    await expect(services.uploadAvatar('user-1', 'file://avatar.jpg')).rejects.toThrow('upload failed');
  });

  test('signInWithGoogle exchanges a callback code for a session on native', async () => {
    const WebBrowser = require('expo-web-browser');
    const Linking = require('expo-linking');

    mockSupabase.auth.signInWithOAuth.mockResolvedValueOnce({
      data: { url: 'https://supabase.example.com/auth/v1/authorize' },
      error: null,
    });
    WebBrowser.openAuthSessionAsync.mockResolvedValueOnce({
      type: 'success',
      url: 'kore:///auth/callback?code=oauth-code-123',
    });
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'google-user' } } },
      error: null,
    });

    await expect(services.signInWithGoogle()).resolves.toEqual({
      url: 'https://supabase.example.com/auth/v1/authorize',
      session: { user: { id: 'google-user' } },
    });

    expect(Linking.createURL).toHaveBeenCalledWith('auth/callback', { scheme: 'kore' });
    expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'kore://auth/callback', skipBrowserRedirect: true },
    });
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://supabase.example.com/auth/v1/authorize',
      'kore://auth/callback'
    );
    expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('oauth-code-123');
    expect(mockSupabase.auth.setSession).not.toHaveBeenCalled();
  });

  test('signInWithGoogle falls back to token session parsing when tokens are returned', async () => {
    const WebBrowser = require('expo-web-browser');
    const Linking = require('expo-linking');

    mockSupabase.auth.signInWithOAuth.mockResolvedValueOnce({
      data: { url: 'https://supabase.example.com/auth/v1/authorize' },
      error: null,
    });
    WebBrowser.openAuthSessionAsync.mockResolvedValueOnce({
      type: 'success',
      url: 'kore:///auth/callback#access_token=token-1&refresh_token=refresh-1',
    });
    mockSupabase.auth.setSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'token-user' } } },
      error: null,
    });

    await expect(services.signInWithGoogle()).resolves.toEqual({
      url: 'https://supabase.example.com/auth/v1/authorize',
      session: { user: { id: 'token-user' } },
    });

    expect(Linking.createURL).toHaveBeenCalledWith('auth/callback', { scheme: 'kore' });
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://supabase.example.com/auth/v1/authorize',
      'kore://auth/callback'
    );
    expect(mockSupabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'token-1',
      refresh_token: 'refresh-1',
    });
  });
});
