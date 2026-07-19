import { compile, middleware, prefixer, serialize, stringify } from "stylis";

/**
 * Compiles nested runtime CSS into a flat, vendor-prefixed stylesheet.
 *
 * Runtime translation styles are inserted into both documents and shadow
 * roots, so they cannot rely on Emotion's document-level style registry.
 *
 * @param {string} source nested CSS source
 * @returns {string} browser-ready CSS
 */
export function compileRuntimeCss(source) {
  return serialize(
    compile(String(source || "")),
    middleware([prefixer, stringify])
  );
}
