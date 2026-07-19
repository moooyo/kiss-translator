function splitCssDeclarations(cssString) {
  const declarations = [];
  let current = "";
  let quote = "";
  let escaped = false;
  let parenthesesDepth = 0;

  for (const character of String(cssString || "")) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      current += character;
      escaped = true;
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      current += character;
      quote = character;
      continue;
    }
    if (character === "(") parenthesesDepth += 1;
    if (character === ")") parenthesesDepth = Math.max(0, parenthesesDepth - 1);
    if (character === ";" && parenthesesDepth === 0) {
      if (current.trim()) declarations.push(current);
      current = "";
      continue;
    }
    current += character;
  }

  if (current.trim()) declarations.push(current);
  return declarations;
}

export function parseCssToObject(cssString) {
  return Object.fromEntries(
    splitCssDeclarations(cssString).flatMap((declaration) => {
      const colonIndex = declaration.indexOf(":");
      if (colonIndex <= 0) return [];
      return [
        [
          declaration.slice(0, colonIndex).trim(),
          declaration.slice(colonIndex + 1).trim(),
        ],
      ];
    })
  );
}

export function cssObjectToReactStyle(cssObject) {
  return Object.fromEntries(
    Object.entries(cssObject).map(([property, value]) => {
      if (property.startsWith("--")) return [property, value];
      const camelProperty = property.replace(/-([a-z])/g, (_, letter) =>
        letter.toUpperCase()
      );
      const reactProperty = camelProperty.startsWith("webkit")
        ? `W${camelProperty.slice(1)}`
        : camelProperty;
      return [reactProperty, value];
    })
  );
}

export function objectToCss(cssObject) {
  const entries = Object.entries(cssObject).filter(
    ([, value]) => value !== undefined && value !== ""
  );
  return entries.length
    ? `${entries.map(([key, value]) => `${key}: ${value}`).join(";\n")};`
    : "";
}

export function parseRgba(value) {
  const match = value?.match(
    /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
  );
  return match
    ? {
        r: Number.parseInt(match[1], 10),
        g: Number.parseInt(match[2], 10),
        b: Number.parseInt(match[3], 10),
        a: match[4] === undefined ? 1 : Number.parseFloat(match[4]),
      }
    : null;
}

export function resolveBackgroundRgba(
  cssObject,
  fallback = "rgba(0, 0, 0, 0.5)"
) {
  const explicitColor = cssObject["background-color"];
  const legacyBackground = cssObject.background;
  const legacyColor =
    legacyBackground && !/(?:gradient|url)\s*\(/i.test(legacyBackground)
      ? legacyBackground
      : "";
  return (
    parseRgba(explicitColor || legacyColor || fallback) || parseRgba(fallback)
  );
}

export function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((channel) => {
        const numericChannel = Number(channel);
        const value = Number.isNaN(numericChannel) ? 0 : numericChannel;
        return Math.min(255, Math.max(0, Math.round(value)))
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

export function hexToRgb(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match
    ? {
        r: Number.parseInt(match[1], 16),
        g: Number.parseInt(match[2], 16),
        b: Number.parseInt(match[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

export function parseFontSize(fontSize) {
  if (!fontSize) return { min: 1, preferred: 2, max: 3, unit: "rem" };
  const clampMatch = fontSize.match(
    /clamp\s*\(\s*([\d.]+)(\w+)\s*,\s*([\d.]+)(\w+)\s*,\s*([\d.]+)(\w+)\s*\)/
  );
  if (clampMatch) {
    return {
      min: Number.parseFloat(clampMatch[1]),
      preferred: Number.parseFloat(clampMatch[3]),
      max: Number.parseFloat(clampMatch[5]),
      unit: clampMatch[2],
    };
  }
  const simpleMatch = fontSize.match(/([\d.]+)(\w+)/);
  if (!simpleMatch) return { min: 1, preferred: 2, max: 3, unit: "rem" };
  const value = Number.parseFloat(simpleMatch[1]);
  return {
    min: value * 0.5,
    preferred: value,
    max: value * 1.5,
    unit: simpleMatch[2],
  };
}

export function parsePadding(padding) {
  if (!padding) return { vertical: 0.5, horizontal: 1, unit: "em" };
  const parts = padding.trim().split(/\s+/);
  const verticalMatch = parts[0]?.match(/([\d.]+)(\w+)/);
  const horizontalMatch = (parts[1] || parts[0])?.match(/([\d.]+)(\w+)/);
  return verticalMatch && horizontalMatch
    ? {
        vertical: Number.parseFloat(verticalMatch[1]),
        horizontal: Number.parseFloat(horizontalMatch[1]),
        unit: verticalMatch[2],
      }
    : { vertical: 0.5, horizontal: 1, unit: "em" };
}

export function colorToHex(color) {
  if (!color) return "#ffffff";
  const namedColors = {
    white: "#ffffff",
    black: "#000000",
    red: "#ff0000",
    green: "#00ff00",
    blue: "#0000ff",
    yellow: "#ffff00",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    gray: "#808080",
    grey: "#808080",
    orange: "#ffa500",
    transparent: "#ffffff",
  };
  const normalized = color.toLowerCase().trim();
  if (namedColors[normalized]) return namedColors[normalized];
  if (normalized.startsWith("#")) return normalized;
  const rgba = parseRgba(normalized);
  return rgba ? rgbToHex(rgba.r, rgba.g, rgba.b) : "#ffffff";
}
