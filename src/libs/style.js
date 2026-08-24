import { APP_LCNAME } from "../config/app";
import {
  OPT_STYLE_NONE,
  OPT_STYLE_LINE,
  OPT_STYLE_DOTLINE,
  OPT_STYLE_DASHLINE,
  OPT_STYLE_WAVYLINE,
  OPT_STYLE_DASHBOX,
  OPT_STYLE_FUZZY,
  OPT_STYLE_HIGHLIGHT,
  OPT_STYLE_BLOCKQUOTE,
  OPT_STYLE_GRADIENT,
  OPT_STYLE_BLINK,
  OPT_STYLE_GLOW,
  OPT_STYLE_COLORFUL,
  OPT_STYLE_MARKER,
  OPT_STYLE_GRADIENT_MARKER,
  OPT_STYLE_DASHBOX_BOLD,
  OPT_STYLE_DASHLINE_BOLD,
  OPT_STYLE_WAVYLINE_BOLD,
} from "../config";
import { compileRuntimeCss } from "./cssCompiler";

const RUNTIME_KEYFRAMES = `
@keyframes kt-gradient-flow {
  to {
    background-position: 200% center;
  }
}

@keyframes kt-translation-blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

@keyframes kt-translation-glow {
  from {
    text-shadow: 0 0 10px #fff, 
    0 0 20px #fff, 
    0 0 30px #0073e6, 
    0 0 40px #0073e6;
  }
  to {
    text-shadow: 0 0 20px #fff, 
    0 0 30px #ff4da6, 
    0 0 40px #ff4da6, 
    0 0 50px #ff4da6;
  }
}
`;

const genLineStyle = (style, color, thickness = 1) => `
  text-decoration-line: underline;
  text-decoration-style: ${style};
  text-decoration-color: ${color};
  text-decoration-thickness: ${thickness}px;
  text-underline-offset: 0.3em;
`;

const genBuiltinStyles = (color = "#7CACF8") => ({
  // 无样式
  [OPT_STYLE_NONE]: ``,
  // 下划线
  [OPT_STYLE_LINE]: genLineStyle("solid", color),
  // 点状线
  [OPT_STYLE_DOTLINE]: genLineStyle("dotted", color),
  // 虚线
  [OPT_STYLE_DASHLINE]: genLineStyle("dashed", color),
  // 虚线加粗
  [OPT_STYLE_DASHLINE_BOLD]: genLineStyle("dashed", color, 2),
  // 波浪线
  [OPT_STYLE_WAVYLINE]: genLineStyle("wavy", color),
  // 波浪线加粗
  [OPT_STYLE_WAVYLINE_BOLD]: genLineStyle("wavy", color, 2),
  // 虚线框
  [OPT_STYLE_DASHBOX]: `
    border: 1px dashed ${color};
    display: block;
    padding: 0.2em 0.3em;
    box-sizing: border-box;
  `,
  // 虚线框加粗
  [OPT_STYLE_DASHBOX_BOLD]: `
    border: 2px dashed ${color};
    display: block;
    padding: 0.2em 0.3em;
    box-sizing: border-box;
  `,
  // 马克笔
  [OPT_STYLE_MARKER]: `
    background: linear-gradient(transparent 55%, rgba(255,214,90,.55) 55%);
  `,
  // 渐变马克笔
  [OPT_STYLE_GRADIENT_MARKER]: `
    background: linear-gradient(to top, transparent, ${color} 20%, transparent 60%);
  `,
  // 模糊
  [OPT_STYLE_FUZZY]: `
    filter: blur(0.2em);
    &:hover {
      filter: none;
    }
  `,
  // 高亮
  [OPT_STYLE_HIGHLIGHT]: `
    color: #fff;
    background-color: ${color};
  `,
  // 引用
  [OPT_STYLE_BLOCKQUOTE]: `
    opacity: 0.72;
    font-style: italic;
    &:hover {
      opacity: 1;
    }
  `,
  // 渐变
  [OPT_STYLE_GRADIENT]: `
    background-image: linear-gradient(
      90deg,
      #3b82f6,
      #9333ea,
      #ec4899,
      #3b82f6
    );
    background-size: 200% auto;
    color: transparent;
    background-clip: text;
    animation: kt-gradient-flow 4s linear infinite;
    & * {
      background-color: transparent !important;
    }
  `,
  // 闪现
  [OPT_STYLE_BLINK]: `
    animation: kt-translation-blink 1s infinite;
  `,
  // 发光
  [OPT_STYLE_GLOW]: `
    animation: kt-translation-glow 2s ease-in-out infinite alternate;
  `,
  // 多彩
  [OPT_STYLE_COLORFUL]: `
    color: #333;
    background: linear-gradient(
      45deg,
      LightGreen 20%,
      LightPink 20% 40%,
      LightSalmon 40% 60%,
      LightSeaGreen 60% 80%,
      LightSkyBlue 80%
    );
    &:hover {
      color: #111;
    };
  `,
});

function hashStyle(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function createStyleClassName(slug, styleCode) {
  const normalizedSlug = String(slug || "custom")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `kiss-style-${normalizedSlug || "custom"}-${hashStyle(styleCode)}`;
}

/**
 * Builds isolated class names and the stylesheet adopted by translated nodes.
 * Class rules are emitted only into the returned stylesheet, avoiding duplicate
 * Emotion insertion into the host document.
 *
 * @param {Array} customStyles user-defined translation styles
 * @returns {Array} class-name map and stylesheet text
 */
export const genTextClass = (customStyles = []) => {
  const styles = genBuiltinStyles();
  customStyles.forEach((style) => {
    styles[style.styleSlug] = style.styleCode;
  });

  const textClass = {};
  let textStyles = `${RUNTIME_KEYFRAMES}
    @keyframes kt-translation-up {
      from { opacity: 0; transform: translateY(14px) scale(.97); }
      to { opacity: 1; transform: none; }
    }
    .${APP_LCNAME}-inner {
      animation: kt-translation-up .5s cubic-bezier(.3,1.4,.4,1);
    }
    @media (prefers-reduced-motion: reduce) {
      .${APP_LCNAME}-inner { animation: none; }
    }
  `;
  Object.entries(styles).forEach(([k, v]) => {
    const styleCode = String(v || "");
    textClass[k] = createStyleClassName(k, styleCode);
    textStyles += `
      .${textClass[k]} {
        ${styleCode}
      }
    `;
  });
  return [textClass, compileRuntimeCss(textStyles)];
};

export const builtinStylesMap = genBuiltinStyles();
