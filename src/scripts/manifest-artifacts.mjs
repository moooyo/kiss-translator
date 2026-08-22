const normalizePath = (value) => String(value || "").replaceAll("\\", "/");

function addIconPaths(references, icons) {
  if (typeof icons === "string") {
    references.add(normalizePath(icons));
    return;
  }
  Object.values(icons || {}).forEach((icon) => addIconPaths(references, icon));
}

export function getManifestArtifactReferences(manifest) {
  const references = new Set(["manifest.json"]);
  const add = (value) => {
    if (value) references.add(normalizePath(value));
  };

  add(manifest.background?.service_worker);
  add(manifest.background?.page);
  (manifest.background?.scripts || []).forEach(add);
  (manifest.content_scripts || []).forEach((contentScript) => {
    (contentScript.js || []).forEach(add);
    (contentScript.css || []).forEach(add);
  });
  add(manifest.action?.default_popup);
  add(manifest.browser_action?.default_popup);
  add(manifest.page_action?.default_popup);
  add(manifest.options_ui?.page);
  add(manifest.options_page);
  add(manifest.side_panel?.default_path);
  add(manifest.sidebar_action?.default_panel);
  Object.values(manifest.chrome_url_overrides || {}).forEach(add);

  addIconPaths(references, manifest.icons);
  addIconPaths(references, manifest.action?.default_icon);
  addIconPaths(references, manifest.browser_action?.default_icon);
  addIconPaths(references, manifest.page_action?.default_icon);

  (manifest.web_accessible_resources || []).forEach((resourceGroup) => {
    if (typeof resourceGroup === "string") add(resourceGroup);
    else (resourceGroup.resources || []).forEach(add);
  });

  if (manifest.default_locale) {
    add(`_locales/${manifest.default_locale}/messages.json`);
  }
  return [...references];
}

function globToRegExp(pattern) {
  const escaped = normalizePath(pattern)
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`);
}

export function findMissingManifestArtifacts(manifest, artifactPaths) {
  const normalizedPaths = artifactPaths.map(normalizePath);
  return getManifestArtifactReferences(manifest).filter((reference) => {
    const matcher = globToRegExp(reference);
    return !normalizedPaths.some((artifactPath) => matcher.test(artifactPath));
  });
}
