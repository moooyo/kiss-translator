import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiTranslate } from "../../apis";
import {
  API_SPE_TYPES,
  OPT_TRANS_BUILTINAI,
  OPT_TRANS_GOOGLE,
} from "../../config";
import { useI18n } from "../../hooks/I18n";
import CopyBtn from "./CopyBtn";
import { BrowserTtsBtn } from "./AudioBtn";

/**
 * 判断划词翻译结果是否允许进行可见的流式渲染。
 *
 * @param {Object} apiSetting 翻译接口配置。
 * @returns {boolean} 当前接口是否应把增量 chunk 直接写入划词翻译输出框。
 */
const canRenderStream = (apiSetting) =>
  Boolean(
    apiSetting?.useStream &&
      API_SPE_TYPES.stream.has(apiSetting.apiType) &&
      (apiSetting.streamRenderMode || "disabled") !== "disabled"
  );

/**
 * 归一化流式回调中的文本载荷。
 *
 * @param {string|string[]} text 流式回调返回的局部文本或最终翻译结果。
 * @returns {string} 可直接写入 UI 的译文字符串。
 */
const normalizeChunkText = (text) => {
  if (Array.isArray(text)) {
    return text[0] || "";
  }

  return text || "";
};

/**
 * 将接口响应转换为文本框可直接显示和复制的纯文本。
 *
 * @param {string} text 翻译接口返回的文本。
 * @param {string} apiType 翻译接口类型。
 * @param {string} sourceText 原始待翻译文本。
 * @returns {string} 供文本 UI 使用的译文。
 */
const normalizeTranslationText = (text, apiType, sourceText) => {
  const normalizedText = normalizeChunkText(text);
  if (apiType === OPT_TRANS_GOOGLE) {
    return normalizedText.replace(/[\t ]*(\r\n|\r|\n)[\t ]*/g, "\n");
  }

  if (API_SPE_TYPES.ai.has(apiType) && /\r\n|\r|\n/.test(sourceText)) {
    return normalizedText.replace(/\\r\\n|\\n|\\r/g, "\n");
  }

  return normalizedText;
};

/**
 * BuiltinAI does not preserve input line breaks reliably. Translate each
 * non-empty text fragment separately, then rejoin the original separators.
 *
 * @param {string} text Original text to translate.
 * @param {string} fromLang Requested source language.
 * @param {string} detectedLang Source language detected from the complete input.
 * @param {Function} translate Translation function for one text fragment.
 * @returns {Promise<{trText: string, isSame: boolean}>} Rejoined translated text.
 */
const translateBuiltinText = async (
  text,
  fromLang,
  detectedLang,
  translate
) => {
  const parts = text.split(/(\r\n|\r|\n)/);
  const translatableIndexes = parts.reduce((indexes, part, index) => {
    if (index % 2 === 0 && part.trim()) indexes.push(index);
    return indexes;
  }, []);
  if (translatableIndexes.length === 0) {
    return { trText: text, isSame: false };
  }

  const results = [];
  const translatedParts = [...parts];
  let requestFromLang =
    fromLang === "auto" && detectedLang ? detectedLang : fromLang;
  let remainingIndexes = translatableIndexes;

  // 完整文本检测仍未解析出语言时，只允许首个片段走 auto/fallback。
  // 成功后复用其源语言，避免其余片段并发触发远程检测。
  if (requestFromLang === "auto") {
    const [firstIndex, ...restIndexes] = translatableIndexes;
    const firstResult = await translate(parts[firstIndex], "auto");
    results.push(firstResult);
    translatedParts[firstIndex] = firstResult.trText;
    remainingIndexes = restIndexes;
    requestFromLang = firstResult.srCode || firstResult.srLang;
    if (remainingIndexes.length > 0 && !requestFromLang) {
      throw new Error(
        "BuiltinAI could not resolve the source language for multiline translation"
      );
    }
  }

  await Promise.all(
    remainingIndexes.map(async (index) => {
      const result = await translate(parts[index], requestFromLang);
      results.push(result);
      translatedParts[index] = result.trText;
    })
  );

  return {
    trText: translatedParts.join(""),
    isSame: results.length > 0 && results.every((result) => result.isSame),
  };
};

/**
 * 单个划词翻译结果组件，负责发起指定服务商的翻译请求并渲染译文。
 *
 * @param {Object} props 组件参数。
 * @param {string} props.text 需要翻译的原始文本。
 * @param {string} props.fromLang 源语言代码。
 * @param {string} props.toLang 目标语言代码。
 * @param {string} props.apiSlug 选用的翻译 API 唯一标识。
 * @param {Array<Object>} props.transApis 可用翻译 API 配置列表。
 * @param {boolean} [props.simpleStyle=false] 是否使用极简文本样式渲染。
 * @param {boolean} [props.isPlayground=false] Whether to render the full Playground result surface.
 * @param {boolean} [props.popupStyle=false] Whether to use the Popup M3 result card.
 * @param {number} [props.requestRevision=0] Explicit submission revision for retrying unchanged input.
 * @returns {JSX.Element|null} Result view for one translation provider.
 */
export default function TranCont({
  text,
  fromLang,
  toLang,
  apiSlug,
  transApis,
  translateVariants = true,
  detectedLang = "",
  sourceDetectionPending = false,
  simpleStyle = false,
  isPlayground = false,
  popupStyle = false,
  requestRevision = 0,
}) {
  const i18n = useI18n();
  const [trText, setTrText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [elapsedMs, setElapsedMs] = useState(null);
  const [attemptRevision, setAttemptRevision] = useState(requestRevision);
  const requestPendingRef = useRef(false);

  // 根据 slug 找到当前组件实例负责调用的翻译接口配置。
  const apiSetting = useMemo(
    () => transApis.find((api) => api.apiSlug === apiSlug),
    [transApis, apiSlug]
  );
  const coordinatesBuiltinSource =
    apiSetting?.apiType === OPT_TRANS_BUILTINAI && fromLang === "auto";
  const builtinDetectedLang = coordinatesBuiltinSource ? detectedLang : "";
  const waitForBuiltinDetection =
    coordinatesBuiltinSource && sourceDetectionPending;

  useEffect(() => {
    requestPendingRef.current = false;
    if (!text?.trim() || !apiSetting) {
      setTrText("");
      setLoading(false);
      setError("");
      return;
    }

    if (waitForBuiltinDetection) {
      requestPendingRef.current = true;
      setTrText("");
      setLoading(true);
      setError("");
      return;
    }

    let active = true;
    requestPendingRef.current = true;
    const controller = new AbortController();
    const enableStreamRender = canRenderStream(apiSetting);
    const startedAt = Date.now();

    /**
     * 接收底层翻译队列吐出的流式增量文本，并同步到当前输出框。
     *
     * @param {Object} chunk 流式翻译分块。
     * @param {string|string[]} chunk.text 当前分块中已经解析出的译文。
     */
    const handleStreamChunk = enableStreamRender
      ? ({ text: chunkText }) => {
          // 旧请求被切换或取消后，晚到的流式分块不能再覆盖当前划词结果。
          if (!active || controller.signal.aborted) {
            return;
          }

          const nextText = normalizeTranslationText(
            chunkText,
            apiSetting.apiType,
            text
          );
          if (nextText) {
            setTrText(nextText);
          }
        }
      : undefined;

    (async () => {
      try {
        setLoading(true);
        setTrText("");
        setError("");
        setElapsedMs(null);

        const translate = (requestText, requestFromLang = fromLang) =>
          apiTranslate({
            text: requestText,
            fromLang: requestFromLang,
            toLang,
            apiSetting,
            textFormat: "text",
            translateVariants,
            onStreamChunk: handleStreamChunk,
            // 将组件生命周期的取消信号下传，避免划词内容变化后旧请求继续占用网络与回写 UI。
            signal: controller.signal,
          });
        const { trText, isSame } =
          apiSetting.apiType === OPT_TRANS_BUILTINAI
            ? await translateBuiltinText(
                text,
                fromLang,
                builtinDetectedLang,
                translate
              )
            : await translate(text);

        if (active) {
          setTrText(
            isSame
              ? ""
              : normalizeTranslationText(trText, apiSetting.apiType, text)
          );
          setElapsedMs(Date.now() - startedAt);
        }
      } catch (err) {
        if (err?.name === "AbortError") {
          return;
        }

        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          requestPendingRef.current = false;
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      requestPendingRef.current = false;
      // Abort on unmount or dependency changes to stop streaming data for stale selections.
      controller.abort();
    };
  }, [
    text,
    fromLang,
    toLang,
    apiSetting,
    translateVariants,
    builtinDetectedLang,
    waitForBuiltinDetection,
    attemptRevision,
  ]);

  // Keep pending requests, including queued batches, intact on repeated submits.
  // Input changes are handled above and must not trigger a second attempt here.
  useEffect(() => {
    if (!requestPendingRef.current) setAttemptRevision(requestRevision);
  }, [requestRevision]);

  if (!apiSetting) {
    return null;
  }

  if (simpleStyle) {
    return (
      <Box aria-live="polite" aria-busy={loading}>
        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : trText ? (
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Box sx={{ width: 12, height: 12, flex: "0 0 auto", mt: "0.35em" }}>
              {loading && (
                <CircularProgress
                  size={12}
                  aria-label={i18n("popup_translating")}
                />
              )}
            </Box>
            <Typography style={{ whiteSpace: "pre-line" }}>{trText}</Typography>
          </Stack>
        ) : loading ? (
          <CircularProgress size={16} />
        ) : null}
      </Box>
    );
  }

  if (popupStyle) {
    return (
      <article className="kt-popup-translation-result">
        <header>
          <strong>{apiSetting.apiName || apiSetting.apiSlug}</strong>
          {elapsedMs !== null && <span>{elapsedMs}ms</span>}
          <div>
            {trText && (
              <CopyBtn
                text={trText}
                title={i18n("copy")}
                copiedLabel={i18n("copy_success", "Copied")}
              />
            )}
            <BrowserTtsBtn
              text={trText}
              lang={toLang}
              title={i18n("read_aloud")}
            />
          </div>
        </header>
        <div
          className="kt-popup-translation-result__body"
          aria-live="polite"
          aria-busy={loading}
        >
          {loading && !trText ? (
            <CircularProgress size={18} />
          ) : error ? (
            <span className="kt-popup-translation-result__error">{error}</span>
          ) : trText ? (
            <span>{trText}</span>
          ) : (
            <span className="kt-popup-translation-result__empty">
              {i18n("popup_enter_text")}
            </span>
          )}
        </div>
      </article>
    );
  }

  return (
    <Box
      className={isPlayground ? "kt-playground-translator__result" : undefined}
    >
      <TextField
        className={
          isPlayground
            ? "kt-resizable-text-field kt-translation-text-field kt-translation-text-field--result"
            : "kt-resizable-text-field"
        }
        size="small"
        label={`${i18n("translated_text")} - ${apiSetting.apiName}`}
        InputLabelProps={isPlayground ? { shrink: true } : undefined}
        fullWidth
        multiline
        minRows={isPlayground ? 4 : undefined}
        maxRows={10}
        inputProps={{
          className: "kt-resizable-textarea",
          style: { resize: "vertical" },
          "aria-busy": loading,
        }}
        placeholder={
          isPlayground && !text
            ? i18n(
                "playground_translation_empty_result",
                "输入原文后，译文将在这里显示"
              )
            : undefined
        }
        sx={{
          "& .MuiInputBase-root": {
            overflow: "visible",
          },
          '& textarea:not([aria-hidden="true"])': {
            resize: "vertical",
          },
        }}
        value={trText}
        helperText={error}
        InputProps={{
          readOnly: true,
          startAdornment: (
            <Box
              sx={{
                width: 16,
                height: 16,
                display: "grid",
                placeItems: "center",
              }}
            >
              {loading && (
                <CircularProgress
                  size={16}
                  aria-label={i18n("popup_translating")}
                />
              )}
            </Box>
          ),
          endAdornment: (
            <Stack
              className={
                isPlayground ? "kt-translation-text-field__actions" : undefined
              }
              direction="row"
              sx={
                isPlayground
                  ? undefined
                  : {
                      position: "absolute",
                      right: 0,
                      top: 0,
                    }
              }
            >
              {/* 复制当前译文；流式渲染期间复制到的是已经到达的部分文本。 */}
              {trText && (
                <CopyBtn
                  text={trText}
                  title={i18n("copy")}
                  copiedLabel={i18n("copy_success", "Copied")}
                />
              )}
            </Stack>
          ),
        }}
      />
    </Box>
  );
}
