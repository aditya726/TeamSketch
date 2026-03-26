export interface StoredUserStats {
  version: 1;
  sketches: number;
  collaborations: number;
  whiteboardMs: number;
  activeWhiteboardSessionStartedAt?: number;
  updatedAt: number;
}

export interface UserStatsView {
  sketches: number;
  collaborations: number;
  whiteboardMsTotal: number;
  hoursTotal: number;
  isWhiteboardSessionActive: boolean;
}

const STORAGE_PREFIX = 'teamsketch:user-stats:';

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const storageKey = (userId: string) => `${STORAGE_PREFIX}${userId}`;

const defaultStats = (): StoredUserStats => ({
  version: 1,
  sketches: 0,
  collaborations: 0,
  whiteboardMs: 0,
  updatedAt: Date.now(),
});

const safeParse = (raw: string | null): StoredUserStats | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredUserStats>;
    if (parsed.version !== 1) return null;
    return {
      ...defaultStats(),
      ...parsed,
      sketches: Number(parsed.sketches ?? 0) || 0,
      collaborations: Number(parsed.collaborations ?? 0) || 0,
      whiteboardMs: Number(parsed.whiteboardMs ?? 0) || 0,
      activeWhiteboardSessionStartedAt:
        typeof parsed.activeWhiteboardSessionStartedAt === 'number'
          ? parsed.activeWhiteboardSessionStartedAt
          : undefined,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
      version: 1,
    };
  } catch {
    return null;
  }
};

const readStored = (userId: string): StoredUserStats => {
  if (!isBrowser()) return defaultStats();
  const raw = window.localStorage.getItem(storageKey(userId));
  return safeParse(raw) ?? defaultStats();
};

const writeStored = (userId: string, next: StoredUserStats) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
};

const withUpdatedAt = (stats: StoredUserStats): StoredUserStats => ({
  ...stats,
  updatedAt: Date.now(),
});

const finalizeAnyActiveSession = (stats: StoredUserStats, now = Date.now()): StoredUserStats => {
  if (!stats.activeWhiteboardSessionStartedAt) return stats;
  const delta = Math.max(0, now - stats.activeWhiteboardSessionStartedAt);
  return {
    ...stats,
    whiteboardMs: stats.whiteboardMs + delta,
    activeWhiteboardSessionStartedAt: undefined,
  };
};

export const getUserStatsView = (userId: string): UserStatsView => {
  const stats = readStored(userId);
  const now = Date.now();
  const isActive = typeof stats.activeWhiteboardSessionStartedAt === 'number';
  const activeDelta = isActive ? Math.max(0, now - (stats.activeWhiteboardSessionStartedAt as number)) : 0;
  const totalMs = stats.whiteboardMs + activeDelta;

  return {
    sketches: stats.sketches,
    collaborations: stats.collaborations,
    whiteboardMsTotal: totalMs,
    hoursTotal: totalMs / (1000 * 60 * 60),
    isWhiteboardSessionActive: isActive,
  };
};

export const incrementSketches = (userId: string, by = 1) => {
  const current = readStored(userId);
  const next: StoredUserStats = withUpdatedAt({
    ...current,
    sketches: Math.max(0, current.sketches + by),
  });
  writeStored(userId, next);
};

export const incrementCollaborations = (userId: string, by = 1) => {
  const current = readStored(userId);
  const next: StoredUserStats = withUpdatedAt({
    ...current,
    collaborations: Math.max(0, current.collaborations + by),
  });
  writeStored(userId, next);
};

export const startWhiteboardSession = (userId: string) => {
  const now = Date.now();
  const current = readStored(userId);

  // If a previous session start exists (e.g., refresh), finalize it first.
  const normalized = finalizeAnyActiveSession(current, now);

  const next: StoredUserStats = withUpdatedAt({
    ...normalized,
    activeWhiteboardSessionStartedAt: now,
  });
  writeStored(userId, next);
};

export const endWhiteboardSession = (userId: string) => {
  const now = Date.now();
  const current = readStored(userId);
  const finalized = finalizeAnyActiveSession(current, now);
  writeStored(userId, withUpdatedAt(finalized));
};
