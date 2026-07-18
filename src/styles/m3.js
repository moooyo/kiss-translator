export const M3_COLORS = {
  light: {
    primary: "#0B57D0",
    onPrimary: "#FFFFFF",
    primaryContainer: "#D3E3FD",
    onPrimaryContainer: "#041E49",
    secondaryContainer: "#C2E7FF",
    onSecondaryContainer: "#001D35",
    tertiaryContainer: "#C4EED0",
    onTertiaryContainer: "#072711",
    error: "#B3261E",
    errorContainer: "#F9DEDC",
    background: "#F8FAFD",
    surface: "#FFFFFF",
    surfaceLow: "#F3F6FB",
    surfaceContainer: "#F0F4F9",
    surfaceHigh: "#E9EEF6",
    onSurface: "#1F1F1F",
    onSurfaceVariant: "#444746",
    outline: "#747775",
    outlineVariant: "#C9CDD3",
  },
  dark: {
    primary: "#A8C7FA",
    onPrimary: "#062E6F",
    primaryContainer: "#0842A0",
    onPrimaryContainer: "#D3E3FD",
    secondaryContainer: "#004A77",
    onSecondaryContainer: "#C2E7FF",
    tertiaryContainer: "#0F5223",
    onTertiaryContainer: "#C4EED0",
    error: "#F2B8B5",
    errorContainer: "#601410",
    background: "#131314",
    surface: "#1E1F20",
    surfaceLow: "#232426",
    surfaceContainer: "#282A2C",
    surfaceHigh: "#2D2F31",
    onSurface: "#E3E3E3",
    onSurfaceVariant: "#C4C7C5",
    outline: "#8E918F",
    outlineVariant: "#3F4245",
  },
};

export const M3_BRAND_COLORS = {
  blue: { light: {}, dark: {} },
  cyan: {
    light: {
      primary: "#006874",
      onPrimary: "#FFFFFF",
      primaryContainer: "#97F0FF",
      onPrimaryContainer: "#001F24",
      secondaryContainer: "#CDE7EC",
      onSecondaryContainer: "#051F23",
    },
    dark: {
      primary: "#4FD8EB",
      onPrimary: "#00363D",
      primaryContainer: "#004F58",
      onPrimaryContainer: "#97F0FF",
      secondaryContainer: "#334B4F",
      onSecondaryContainer: "#CDE7EC",
    },
  },
  violet: {
    light: {
      primary: "#6750A4",
      onPrimary: "#FFFFFF",
      primaryContainer: "#EADDFF",
      onPrimaryContainer: "#21005D",
      secondaryContainer: "#E8DEF8",
      onSecondaryContainer: "#1D192B",
    },
    dark: {
      primary: "#D0BCFF",
      onPrimary: "#381E72",
      primaryContainer: "#4F378B",
      onPrimaryContainer: "#EADDFF",
      secondaryContainer: "#4A4458",
      onSecondaryContainer: "#E8DEF8",
    },
  },
};

export const M3_FONT_FAMILY =
  '"Google Sans Flex", "Google Sans", "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const M3_GLOBAL_CSS = String.raw`
:host,
.kt-m3-root {
  --kt-pri: #0b57d0;
  --kt-onpri: #ffffff;
  --kt-pric: #d3e3fd;
  --kt-onpric: #041e49;
  --kt-secc: #c2e7ff;
  --kt-onsecc: #001d35;
  --kt-terc: #c4eed0;
  --kt-onterc: #072711;
  --kt-grn: #146c2e;
  --kt-err: #b3261e;
  --kt-errc: #f9dedc;
  --kt-onerrc: #8c1d18;
  --kt-bg: #f8fafd;
  --kt-sf0: #ffffff;
  --kt-sf1: #f3f6fb;
  --kt-sf2: #f0f4f9;
  --kt-sf3: #e9eef6;
  --kt-sf4: #dde3ea;
  --kt-on: #1f1f1f;
  --kt-onv: #444746;
  --kt-line: #747775;
  --kt-linev: #c9cdd3;
  --kt-inv: #2f3033;
  --kt-oninv: #f1f1f1;
  --kt-spring: cubic-bezier(.3, 1.4, .4, 1);
  --kt-shadow-1: 0 1px 2px rgba(0, 0, 0, .14), 0 1px 6px 1px rgba(0, 0, 0, .08);
  --kt-shadow-2: 0 4px 8px 3px rgba(0, 0, 0, .1), 0 1px 3px rgba(0, 0, 0, .18);
  color: var(--kt-on);
  color-scheme: light;
  font-family: "Google Sans Flex", "Google Sans", "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.kt-m3-root[data-theme="dark"] {
  --kt-pri: #a8c7fa;
  --kt-onpri: #062e6f;
  --kt-pric: #0842a0;
  --kt-onpric: #d3e3fd;
  --kt-secc: #004a77;
  --kt-onsecc: #c2e7ff;
  --kt-terc: #0f5223;
  --kt-onterc: #c4eed0;
  --kt-grn: #6dd58c;
  --kt-err: #f2b8b5;
  --kt-errc: #601410;
  --kt-onerrc: #f9dedc;
  --kt-bg: #131314;
  --kt-sf0: #1e1f20;
  --kt-sf1: #232426;
  --kt-sf2: #282a2c;
  --kt-sf3: #2d2f31;
  --kt-sf4: #37393b;
  --kt-on: #e3e3e3;
  --kt-onv: #c4c7c5;
  --kt-line: #8e918f;
  --kt-linev: #3f4245;
  --kt-inv: #e3e3e3;
  --kt-oninv: #303030;
  --kt-shadow-1: 0 1px 2px rgba(0, 0, 0, .5), 0 1px 6px 1px rgba(0, 0, 0, .35);
  --kt-shadow-2: 0 4px 10px 3px rgba(0, 0, 0, .45), 0 1px 3px rgba(0, 0, 0, .5);
  color-scheme: dark;
}

.kt-m3-root[data-brand="cyan"] {
  --kt-pri: #006874;
  --kt-onpri: #ffffff;
  --kt-pric: #97f0ff;
  --kt-onpric: #001f24;
  --kt-secc: #cde7ec;
  --kt-onsecc: #051f23;
}

.kt-m3-root[data-brand="violet"] {
  --kt-pri: #6750a4;
  --kt-onpri: #ffffff;
  --kt-pric: #eaddff;
  --kt-onpric: #21005d;
  --kt-secc: #e8def8;
  --kt-onsecc: #1d192b;
}

.kt-m3-root[data-theme="dark"][data-brand="cyan"] {
  --kt-pri: #4fd8eb;
  --kt-onpri: #00363d;
  --kt-pric: #004f58;
  --kt-onpric: #97f0ff;
  --kt-secc: #334b4f;
  --kt-onsecc: #cde7ec;
}

.kt-m3-root[data-theme="dark"][data-brand="violet"] {
  --kt-pri: #d0bcff;
  --kt-onpri: #381e72;
  --kt-pric: #4f378b;
  --kt-onpric: #eaddff;
  --kt-secc: #4a4458;
  --kt-onsecc: #e8def8;
}

.kt-m3-root,
.kt-m3-root *,
.kt-m3-root *::before,
.kt-m3-root *::after {
  box-sizing: border-box;
}

.kt-m3-root button,
.kt-m3-root input,
.kt-m3-root select,
.kt-m3-root textarea {
  font: inherit;
}

.kt-m3-root input,
.kt-m3-root select,
.kt-m3-root textarea { color: inherit; }

.kt-m3-root .MuiInputBase-input {
  box-sizing: content-box;
}

.kt-m3-root button {
  -webkit-tap-highlight-color: transparent;
}

.kt-m3-root :focus-visible {
  outline: 3px solid color-mix(in srgb, var(--kt-pri) 55%, transparent);
  outline-offset: 2px;
}

.kt-m3-root ::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.kt-m3-root ::-webkit-scrollbar-thumb {
  background: var(--kt-sf4);
  background-clip: content-box;
  border: 3px solid transparent;
  border-radius: 999px;
}

.kt-m3-root ::-webkit-scrollbar-track {
  background: transparent;
}

.kt-m3-button {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 20px;
  border: 0;
  border-radius: 999px;
  background: var(--kt-pri);
  color: var(--kt-onpri);
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
  letter-spacing: .01em;
  transition: background .3s, color .3s, transform .15s;
}

.kt-m3-button:hover { filter: brightness(.97); }
.kt-m3-button:active { transform: scale(.98); }
.kt-m3-button:disabled { cursor: default; filter: none; opacity: .46; }
.kt-m3-button--tonal { background: var(--kt-pric); color: var(--kt-onpric); }
.kt-m3-button--text { background: transparent; color: var(--kt-pri); padding-inline: 13px; }
.kt-m3-button--outlined { background: transparent; color: var(--kt-pri); border: 1px solid var(--kt-linev); }
.kt-m3-button--danger { background: var(--kt-errc); color: var(--kt-onerrc); }

.kt-m3-icon-button {
  width: 40px;
  height: 40px;
  display: inline-grid;
  flex: none;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--kt-onv);
  cursor: pointer;
  transition: background .3s, color .3s, transform .15s;
}

.kt-m3-icon-button:hover { background: var(--kt-sf2); color: var(--kt-on); }
.kt-m3-icon-button:active { transform: scale(.94); }
.kt-m3-icon-button svg { width: 20px; height: 20px; }

.kt-m3-switch {
  width: 52px;
  height: 32px;
  display: inline-block;
  flex: none;
  position: relative;
  cursor: pointer;
}

.kt-m3-switch > input {
  width: 1px;
  height: 1px;
  position: absolute;
  opacity: 0;
}

.kt-m3-switch__track {
  position: absolute;
  inset: 0;
  border: 2px solid var(--kt-line);
  border-radius: 999px;
  background: var(--kt-sf3);
  transition: background .35s var(--kt-spring), border-color .35s var(--kt-spring);
}

.kt-m3-switch__thumb {
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  position: absolute;
  left: 6px;
  top: 50%;
  border-radius: 50%;
  background: var(--kt-line);
  color: transparent;
  transform: translateY(-50%);
  transition: width .35s var(--kt-spring), height .35s var(--kt-spring), left .35s var(--kt-spring), top .35s var(--kt-spring), background .35s;
}

.kt-m3-switch__thumb svg { width: 16px; height: 16px; }
.kt-m3-switch > input:checked + .kt-m3-switch__track { border-color: var(--kt-pri); background: var(--kt-pri); }
.kt-m3-switch > input:checked + .kt-m3-switch__track .kt-m3-switch__thumb { width: 24px; height: 24px; left: 24px; top: 50%; background: var(--kt-onpri); color: var(--kt-pri); }
.kt-m3-switch > input:focus-visible + .kt-m3-switch__track { outline: 3px solid color-mix(in srgb, var(--kt-pri) 45%, transparent); outline-offset: 2px; }
.kt-m3-switch > input:disabled + .kt-m3-switch__track { opacity: .38; cursor: default; }

.kt-m3-segmented {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: var(--kt-sf2);
}

.kt-m3-segmented > button {
  min-width: 0;
  min-height: 36px;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--kt-onv);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background .35s var(--kt-spring), color .35s var(--kt-spring), transform .15s;
}

.kt-m3-segmented > button[aria-selected="true"] { background: var(--kt-secc); color: var(--kt-onsecc); font-weight: 650; }
.kt-m3-segmented > button:active { transform: scale(.97); }
.kt-m3-segmented__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.kt-m3-card {
  border: 1px solid var(--kt-linev);
  border-radius: 22px;
  background: var(--kt-sf0);
}

.kt-m3-field {
  width: 100%;
  min-height: 48px;
  display: flex;
  align-items: center;
  position: relative;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 16px;
  background: var(--kt-sf2);
  transition: background .25s, border-color .25s;
}

.kt-m3-field:focus-within { border-color: var(--kt-pri); background: var(--kt-sf0); }
.kt-m3-field input,
.kt-m3-field select,
.kt-m3-field textarea { width: 100%; border: 0; outline: 0; background: transparent; font-size: 13px; }

.kt-m3-snackbar {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  position: fixed;
  left: 50%;
  bottom: 24px;
  z-index: 1600;
  max-width: min(480px, calc(100vw - 32px));
  padding: 11px 18px;
  border-radius: 14px;
  background: var(--kt-inv);
  box-shadow: var(--kt-shadow-2);
  color: var(--kt-oninv);
  font-size: 13px;
  font-weight: 500;
  transform: translateX(-50%);
  animation: kt-m3-up .35s var(--kt-spring);
}

.kt-m3-snackbar__check { color: var(--kt-grn); }
.kt-m3-snackbar__status-icon { width: 20px; height: 20px; flex: none; color: var(--kt-grn); }
.kt-m3-snackbar--error .kt-m3-snackbar__status-icon { color: var(--kt-err); }
.kt-m3-snackbar--warning .kt-m3-snackbar__status-icon { color: #f9ab00; }
.kt-m3-snackbar--info .kt-m3-snackbar__status-icon { color: var(--kt-pri); }

@keyframes kt-m3-up {
  from { opacity: 0; transform: translate(-50%, 14px) scale(.97); }
  to { opacity: 1; transform: translate(-50%, 0) scale(1); }
}

@keyframes kt-m3-pop {
  0% { opacity: 0; transform: scale(.5); }
  65% { opacity: 1; transform: scale(1.05); }
  100% { transform: scale(1); }
}

@keyframes kt-m3-rise {
  from { opacity: 0; transform: translateY(14px) scale(.97); }
  to { opacity: 1; transform: none; }
}

@keyframes kt-m3-spin { to { transform: rotate(360deg); } }

@keyframes kt-m3-sweep {
  0% { left: -40%; width: 40%; }
  55%, 100% { left: 100%; width: 55%; }
}

@keyframes kt-m3-glow {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

@media (prefers-reduced-motion: reduce) {
  .kt-m3-root *,
  .kt-m3-root *::before,
  .kt-m3-root *::after {
    scroll-behavior: auto !important;
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
`;
