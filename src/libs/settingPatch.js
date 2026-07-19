function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function mergeSettingPatch(current, patch) {
  if (!isPlainObject(patch)) return current;
  const next = { ...(current || {}) };
  Object.entries(patch).forEach(([key, value]) => {
    next[key] =
      isPlainObject(value) && isPlainObject(next[key])
        ? mergeSettingPatch(next[key], value)
        : value;
  });
  return next;
}
