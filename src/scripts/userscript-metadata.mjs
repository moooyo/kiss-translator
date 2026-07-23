export const REQUIRED_USERSCRIPT_VALUE_CHANGE_GRANTS = [
  "GM.addValueChangeListener",
  "GM_addValueChangeListener",
  "GM.removeValueChangeListener",
  "GM_removeValueChangeListener",
];

export const getUserscriptGrants = (source) => {
  const metadataStartMatch = source.match(
    /^\uFEFF?[^\S\r\n]*\/\/ ==UserScript==[^\S\r\n]*(?:\r?\n|$)/
  );
  if (!metadataStartMatch) return new Set();

  const metadataStart = metadataStartMatch[0].length;
  const metadataEnd = source.indexOf("// ==/UserScript==", metadataStart);
  if (metadataEnd < 0) return new Set();

  const metadata = source.slice(metadataStart, metadataEnd);
  return new Set(
    Array.from(
      metadata.matchAll(/^\/\/[^\S\r\n]*@grant[^\S\r\n]+(\S+)[^\S\r\n]*$/gm),
      (match) => match[1]
    )
  );
};

export const findMissingUserscriptValueChangeGrants = (source) => {
  const grants = getUserscriptGrants(source);
  return REQUIRED_USERSCRIPT_VALUE_CHANGE_GRANTS.filter(
    (grant) => !grants.has(grant)
  );
};
