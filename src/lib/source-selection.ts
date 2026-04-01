export function toggleSourceId(sourceIds: string[], assetId: string) {
  return sourceIds.includes(assetId)
    ? sourceIds.filter((sourceId) => sourceId !== assetId)
    : [...sourceIds, assetId];
}
