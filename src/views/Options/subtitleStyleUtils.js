function visitTopLevelCharacters(source, start, end, visitor) {
  let quote = "";
  let escaped = false;
  let inComment = false;
  let parenthesesDepth = 0;
  let bracketsDepth = 0;
  let bracesDepth = 0;

  for (let index = start; index < end; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (inComment) {
      if (character === "*" && nextCharacter === "/") {
        inComment = false;
        index += 1;
      }
      continue;
    }
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === "/" && nextCharacter === "*") {
      inComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(") parenthesesDepth += 1;
    if (character === ")") parenthesesDepth = Math.max(0, parenthesesDepth - 1);
    if (character === "[") bracketsDepth += 1;
    if (character === "]") bracketsDepth = Math.max(0, bracketsDepth - 1);
    if (character === "{") bracesDepth += 1;
    if (character === "}") bracesDepth = Math.max(0, bracesDepth - 1);
    if (
      parenthesesDepth === 0 &&
      bracketsDepth === 0 &&
      bracesDepth === 0 &&
      visitor(character, index) === false
    ) {
      return;
    }
  }
}

function scanCssDeclarationRanges(cssString) {
  const source = String(cssString || "");
  const declarations = [];
  let start = 0;

  visitTopLevelCharacters(source, 0, source.length, (character, index) => {
    if (character === ";") {
      declarations.push({ start, end: index, separatorEnd: index + 1 });
      start = index + 1;
    }
    return true;
  });

  declarations.push({ start, end: source.length, separatorEnd: source.length });
  return declarations;
}

function findTopLevelColon(source, start, end) {
  let colonIndex = -1;
  visitTopLevelCharacters(source, start, end, (character, index) => {
    if (character === ":") {
      colonIndex = index;
      return false;
    }
    return true;
  });
  return colonIndex;
}

function removeCssComments(value) {
  return value.replace(/\/\*[\s\S]*?\*\//g, "");
}

function extractCssComments(source, start, end) {
  const comments = [];
  let quote = "";
  let escaped = false;

  for (let index = start; index < end; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character !== "/" || nextCharacter !== "*") continue;

    const commentEnd = source.indexOf("*/", index + 2);
    const boundedEnd =
      commentEnd < 0 || commentEnd >= end ? end : commentEnd + 2;
    comments.push(source.slice(index, boundedEnd));
    index = boundedEnd - 1;
  }

  return comments;
}

function findPropertyStart(source, start, end) {
  let cursor = start;
  while (cursor < end) {
    while (cursor < end && /\s/.test(source[cursor])) cursor += 1;
    if (source.slice(cursor, cursor + 2) !== "/*") break;
    const commentEnd = source.indexOf("*/", cursor + 2);
    if (commentEnd < 0 || commentEnd >= end) break;
    cursor = commentEnd + 2;
  }
  return cursor;
}

function parseCssDeclaration(source, range) {
  const colonIndex = findTopLevelColon(source, range.start, range.end);
  if (colonIndex < 0) return null;

  const propertySource = source.slice(range.start, colonIndex);
  const property = removeCssComments(propertySource).trim();
  if (!/^--[^\s:;]+$/.test(property) && !/^-?[_a-z][\w-]*$/i.test(property)) {
    return null;
  }

  return {
    ...range,
    colonIndex,
    property,
    propertyStart: findPropertyStart(source, range.start, colonIndex),
  };
}

function normalizeCssProperty(property) {
  return property.startsWith("--") ? property : property.toLowerCase();
}

function findCssDeclarations(cssString, property) {
  const source = String(cssString || "");
  const normalizedProperty = normalizeCssProperty(property);
  return scanCssDeclarationRanges(source)
    .map((range) => parseCssDeclaration(source, range))
    .filter(
      (declaration) =>
        declaration &&
        normalizeCssProperty(declaration.property) === normalizedProperty
    );
}

function findTrailingTriviaStart(source, start, end) {
  let cursor = end;

  while (cursor > start) {
    const previousCursor = cursor;
    while (cursor > start && /\s/.test(source[cursor - 1])) cursor -= 1;
    if (cursor >= start + 2 && source.slice(cursor - 2, cursor) === "*/") {
      const commentStart = source.lastIndexOf("/*", cursor - 2);
      if (commentStart >= start) {
        cursor = commentStart;
        continue;
      }
    }
    if (cursor === previousCursor) break;
  }

  return cursor;
}

function appendCssProperty(source, property, value) {
  if (!source) return `${property}: ${value};`;

  const ranges = scanCssDeclarationRanges(source);
  const trailingRange = ranges[ranges.length - 1];
  const trailingSource = source.slice(trailingRange.start, trailingRange.end);
  const needsSemicolon = Boolean(removeCssComments(trailingSource).trim());
  const lineBreak = source.includes("\r\n") ? "\r\n" : "\n";
  const separator = /[\r\n]$/.test(source) ? "" : lineBreak;
  return `${source}${needsSemicolon ? ";" : ""}${separator}${property}: ${value};`;
}

export function parseCssToObject(cssString) {
  const source = String(cssString || "");
  return Object.fromEntries(
    scanCssDeclarationRanges(source).flatMap((range) => {
      const declaration = parseCssDeclaration(source, range);
      return declaration
        ? [
            [
              declaration.property,
              source.slice(declaration.colonIndex + 1, declaration.end).trim(),
            ],
          ]
        : [];
    })
  );
}

export function patchCssProperty(cssString, property, value) {
  const source = String(cssString || "");
  const normalizedProperty = String(property || "").trim();
  if (!normalizedProperty) return source;

  const declarations = findCssDeclarations(source, normalizedProperty);
  if (value === undefined || value === null || value === "") {
    return declarations.reduceRight((css, declaration) => {
      const preservedComments = extractCssComments(
        css,
        declaration.propertyStart,
        declaration.end
      ).join(" ");
      return (
        css.slice(0, declaration.propertyStart) +
        preservedComments +
        css.slice(declaration.separatorEnd)
      );
    }, source);
  }

  if (!declarations.length) {
    return appendCssProperty(source, normalizedProperty, value);
  }

  const declaration = declarations[declarations.length - 1];
  let valueStart = declaration.colonIndex + 1;
  while (valueStart < declaration.end && /\s/.test(source[valueStart])) {
    valueStart += 1;
  }

  let valueEnd = findTrailingTriviaStart(source, valueStart, declaration.end);
  const priorityMatch = source
    .slice(valueStart, valueEnd)
    .match(/\s*!\s*important\s*$/i);
  if (priorityMatch) {
    valueEnd = findTrailingTriviaStart(
      source,
      valueStart,
      valueStart + priorityMatch.index
    );
  }

  return source.slice(0, valueStart) + value + source.slice(valueEnd);
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
