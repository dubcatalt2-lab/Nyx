// Provider IDs remain stable when an upstream document gets a new revision name.
export function currentGnPath(requested, catalog) {
  const match = /^(\d+)(?:[-_.][a-z0-9_.-]*)?\.html(?:-[a-z0-9]+)?$/i.exec(requested);
  if (!match) return requested;
  const games = Array.isArray(catalog) ? catalog : catalog?.games;
  const current = games?.find(game => String(game.id) === match[1])?.path;
  return typeof current === 'string' && /^[a-z0-9_.-]+\.html(?:-[a-z0-9]+)?$/i.test(current)
    ? current : requested;
}
