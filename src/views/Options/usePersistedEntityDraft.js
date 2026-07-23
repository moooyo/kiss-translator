import { useLayoutEffect, useRef, useState } from "react";

function normalizeEntity(entity) {
  return entity ?? {};
}

function areEntitiesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }
  if (Array.isArray(left) !== Array.isArray(right)) return false;

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(right, key) &&
      areEntitiesEqual(left[key], right[key])
  );
}

/**
 * Keeps an editor draft separate from incoming persisted snapshots.
 * Clean drafts follow persisted changes, while dirty drafts survive them.
 */
export function usePersistedEntityDraft(
  entity,
  entityIdentity,
  normalize = normalizeEntity
) {
  const persistedEntity = normalize(entity);
  const identityRef = useRef(entityIdentity);
  const [baseline, setBaseline] = useState(() => persistedEntity);
  const [draft, setDraft] = useState(() => persistedEntity);

  useLayoutEffect(() => {
    if (identityRef.current !== entityIdentity) {
      identityRef.current = entityIdentity;
      setBaseline(persistedEntity);
      setDraft(persistedEntity);
      return;
    }

    if (areEntitiesEqual(baseline, persistedEntity)) return;

    const hasLocalChanges = !areEntitiesEqual(baseline, draft);
    setBaseline(persistedEntity);
    if (!hasLocalChanges) {
      setDraft(persistedEntity);
    }
  }, [baseline, draft, entityIdentity, persistedEntity]);

  return {
    draft,
    setDraft,
    isDirty: !areEntitiesEqual(baseline, draft),
  };
}
