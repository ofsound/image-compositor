export const DEFAULT_SOURCE_WEIGHT = 1;
export const MIN_SOURCE_WEIGHT = 0;
export const MAX_SOURCE_WEIGHT = 4;

function clampSourceWeight(value: number) {
  return Math.min(MAX_SOURCE_WEIGHT, Math.max(MIN_SOURCE_WEIGHT, value));
}

export function normalizeSourceWeight(
  value: number | null | undefined,
  fallback = DEFAULT_SOURCE_WEIGHT,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? clampSourceWeight(value)
    : fallback;
}

export function normalizeSourceWeights(input: unknown) {
  if (!input || typeof input !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).flatMap(([assetId, value]) => {
      if (typeof assetId !== "string" || assetId.length === 0) {
        return [];
      }

      const normalizedWeight = normalizeSourceWeight(
        typeof value === "number" ? value : Number.NaN,
        DEFAULT_SOURCE_WEIGHT,
      );

      return normalizedWeight === DEFAULT_SOURCE_WEIGHT
        ? []
        : [[assetId, normalizedWeight] as const];
    }),
  );
}

export function getSourceWeight(
  sourceWeights: Record<string, number> | undefined,
  assetId: string,
) {
  return normalizeSourceWeight(sourceWeights?.[assetId], DEFAULT_SOURCE_WEIGHT);
}

export function setSourceWeight(
  sourceWeights: Record<string, number> | undefined,
  assetId: string,
  value: number,
) {
  const normalizedWeight = normalizeSourceWeight(value, DEFAULT_SOURCE_WEIGHT);
  const nextWeights = { ...(sourceWeights ?? {}) };

  if (normalizedWeight === DEFAULT_SOURCE_WEIGHT) {
    delete nextWeights[assetId];
    return nextWeights;
  }

  nextWeights[assetId] = normalizedWeight;
  return nextWeights;
}
