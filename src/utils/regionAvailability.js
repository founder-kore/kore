function normalizeRegion(region) {
  if (typeof region !== 'string') {
    return '';
  }

  return region.trim().toUpperCase();
}

function toRegionList(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeRegion).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map(normalizeRegion)
      .filter(Boolean);
  }

  return [];
}

function parseAvailabilityValue(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['available', 'yes', 'supported', 'watchable'].includes(normalized)) {
      return true;
    }
    if (['unavailable', 'blocked', 'restricted', 'geo_blocked', 'not_available'].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function resolveRegionalAvailability(source, region) {
  if (!source) {
    return null;
  }

  if (Array.isArray(source)) {
    const matchingRegion = source.find(entry =>
      normalizeRegion(entry?.region || entry?.country || entry?.code) === region
    );
    if (!matchingRegion) {
      return null;
    }

    const available = parseAvailabilityValue(
      matchingRegion.available
      ?? matchingRegion.isAvailable
      ?? matchingRegion.status
      ?? (typeof matchingRegion.unavailable === 'boolean' ? !matchingRegion.unavailable : null)
    );

    return available;
  }

  if (typeof source !== 'object') {
    return null;
  }

  const availableRegions = toRegionList(
    source.availableRegions
    ?? source.available_regions
    ?? source.supportedRegions
    ?? source.supported_regions
  );
  if (availableRegions.length > 0) {
    return availableRegions.includes(region);
  }

  const unavailableRegions = toRegionList(
    source.unavailableRegions
    ?? source.unavailable_regions
    ?? source.blockedRegions
    ?? source.blocked_regions
    ?? source.restrictedRegions
    ?? source.restricted_regions
  );
  if (unavailableRegions.includes(region)) {
    return false;
  }

  const byRegion = source.byRegion ?? source.by_region ?? source.regions ?? source.regionMap ?? source.region_map;
  if (byRegion && typeof byRegion === 'object' && !Array.isArray(byRegion)) {
    const regionValue = byRegion[region] ?? byRegion[region.toLowerCase()];
    const available = parseAvailabilityValue(regionValue?.available ?? regionValue?.isAvailable ?? regionValue?.status ?? regionValue);
    if (available !== null) {
      return available;
    }
  }

  const matchingRegion = normalizeRegion(source.region || source.country || source.code);
  if (matchingRegion === region) {
    const available = parseAvailabilityValue(
      source.available
      ?? source.isAvailable
      ?? source.status
      ?? (typeof source.unavailable === 'boolean' ? !source.unavailable : null)
    );
    if (available !== null) {
      return available;
    }
  }

  return null;
}

export function isAnimeUnavailableInRegion(anime, userRegion) {
  const region = normalizeRegion(
    userRegion
    ?? anime?.userRegion
    ?? anime?.user_region
    ?? anime?.region
  );

  if (!region || !anime || typeof anime !== 'object') {
    return false;
  }

  const availabilitySources = [
    anime.availability,
    anime.regionAvailability,
    anime.region_availability,
    anime.streamingAvailability,
    anime.streaming_availability,
    anime.streaming?.availability,
    anime.streaming?.regions,
  ];

  // TODO: Swap this out for a dedicated streaming-availability provider when one is added.
  for (const source of availabilitySources) {
    const available = resolveRegionalAvailability(source, region);
    if (available !== null) {
      return available === false;
    }
  }

  return false;
}
