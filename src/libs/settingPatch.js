const DELETE_OPERATION_KEY = "__kissTranslatorSettingPatchOperation__";

export const SETTING_PATCH_DELETE = Object.freeze({
  [DELETE_OPERATION_KEY]: "delete",
});

function isPlainObject(value) {
  if (!value || Object.prototype.toString.call(value) !== "[object Object]") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

function isDeleteOperation(value) {
  return (
    isPlainObject(value) &&
    Object.keys(value).length === 1 &&
    value[DELETE_OPERATION_KEY] === "delete"
  );
}

function isEqualSettingValue(current, next) {
  if (Object.is(current, next)) return true;
  if (Array.isArray(current) || Array.isArray(next)) {
    if (!Array.isArray(current) || !Array.isArray(next)) return false;
    return (
      current.length === next.length &&
      current.every((value, index) => isEqualSettingValue(value, next[index]))
    );
  }
  if (!isPlainObject(current) || !isPlainObject(next)) return false;

  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  return (
    currentKeys.length === nextKeys.length &&
    currentKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(next, key) &&
        isEqualSettingValue(current[key], next[key])
    )
  );
}

export function createSettingPatch(current, next) {
  if (isEqualSettingValue(current, next)) return undefined;
  if (!isPlainObject(current) || !isPlainObject(next)) return next;

  const patch = {};
  const keys = new Set([...Object.keys(current), ...Object.keys(next)]);
  keys.forEach((key) => {
    if (
      !Object.prototype.hasOwnProperty.call(next, key) ||
      next[key] === undefined
    ) {
      patch[key] = SETTING_PATCH_DELETE;
      return;
    }

    const childPatch = createSettingPatch(current[key], next[key]);
    if (childPatch !== undefined) patch[key] = childPatch;
  });
  return Object.keys(patch).length > 0 ? patch : undefined;
}

export function mergeSettingPatch(current, patch) {
  // Root lists are atomic values, just like arrays inside an object patch.
  if (Array.isArray(patch)) return patch;
  if (!isPlainObject(patch) || isDeleteOperation(patch)) return current;

  const next = isPlainObject(current) ? { ...current } : {};
  Object.entries(patch).forEach(([key, value]) => {
    if (isDeleteOperation(value)) {
      delete next[key];
      return;
    }
    next[key] = isPlainObject(value)
      ? mergeSettingPatch(next[key], value)
      : value;
  });
  return next;
}
