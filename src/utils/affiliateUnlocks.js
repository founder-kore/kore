export const AFFILIATE_UNLOCKS = {
  amazon: { milestoneId: 'directors_cut', unlockDay: 45, placements: ['profile'] },
  cdjapan: { milestoneId: 'mood_insights', unlockDay: 7, placements: ['profile', 'home', 'result'] },
  nordvpn: { milestoneId: 'kore_score', unlockDay: 25, placements: ['profile', 'home', 'result'] },
};

function getStreakValue(source) {
  if (typeof source === 'number' && Number.isFinite(source)) {
    return source;
  }

  if (!source || typeof source !== 'object') {
    return null;
  }

  const candidates = [source.streak, source.currentStreak, source.days];
  const streak = candidates.find(value => typeof value === 'number' && Number.isFinite(value));
  return streak ?? null;
}

function getMilestoneList(source) {
  if (!source) {
    return [];
  }

  if (Array.isArray(source)) {
    return source.filter(Boolean);
  }

  if (source instanceof Set) {
    return Array.from(source).filter(Boolean);
  }

  const list = source.milestones_seen
    ?? source.milestonesSeen
    ?? source.unlockedMilestones
    ?? source.unlocked_perks
    ?? source.unlockedPerks
    ?? [];

  if (Array.isArray(list)) {
    return list.filter(Boolean);
  }

  return [];
}

function hasExplicitUnlock(source, keys) {
  if (!source || typeof source !== 'object') {
    return false;
  }

  const containers = [
    source,
    source.affiliateUnlocks,
    source.unlockedPerks,
    source.unlocked_perks,
    source.profile,
    source.preferences,
  ].filter(Boolean);

  return containers.some(container =>
    keys.some(key => container[key] === true)
  );
}

function isUnlocked(source, config, explicitKeys) {
  if (!source) {
    return false;
  }

  const seenMilestones = getMilestoneList(source);
  if (seenMilestones.includes(config.milestoneId)) {
    return true;
  }

  if (hasExplicitUnlock(source, explicitKeys)) {
    return true;
  }

  const streak = getStreakValue(source);
  return typeof streak === 'number' && streak >= config.unlockDay;
}

export function isAffiliatePlacementEnabled(affiliateKey, placement) {
  const config = AFFILIATE_UNLOCKS[affiliateKey];
  if (!config || !placement) {
    return false;
  }

  return Array.isArray(config.placements) && config.placements.includes(placement);
}

export function isAmazonUnlocked(source) {
  return isUnlocked(source, AFFILIATE_UNLOCKS.amazon, [
    'amazonUnlocked',
    'amazon_unlocked',
    'amazonShelfUnlocked',
    'amazon_shelf_unlocked',
  ]);
}

export function isCdJapanUnlocked(source) {
  return isUnlocked(source, AFFILIATE_UNLOCKS.cdjapan, [
    'cdJapanUnlocked',
    'cdjapanUnlocked',
    'cdjapan_unlocked',
  ]);
}

export function isNordVpnUnlocked(source) {
  return isUnlocked(source, AFFILIATE_UNLOCKS.nordvpn, [
    'nordVpnUnlocked',
    'nordvpnUnlocked',
    'nordvpn_unlocked',
  ]);
}
