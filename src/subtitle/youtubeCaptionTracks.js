import { logger } from "../libs/log.js";

/**
 * YouTube 字幕轨道数据层。
 * 只负责识别、选择和拉取 YouTube timedtext/captionTrack 数据，不参与字幕断句、翻译或页面渲染。
 */

/**
 * 简易判断两种语言编码是否属于同一语言大类。
 *
 * @param {string} lang1 第一种语言编码，如 zh-CN。
 * @param {string} lang2 第二种语言编码，如 zh-TW。
 * @returns {boolean} 前两个字符一致时返回 true。
 */
export function isSameLang(lang1, lang2) {
  if (!lang1 || !lang2) return false;
  return lang1.slice(0, 2) === lang2.slice(0, 2);
}

/**
 * 检测字幕轨是否是 Live Chat（弹幕）类型。
 *
 * @param {object|null} track YouTube captionTrack 配置项。
 * @returns {boolean} 是弹幕轨时返回 true。
 */
export function isChatCaptionTrack(track) {
  if (!track) return false;
  const name = track.name?.simpleText || track.name?.runs?.[0]?.text || "";
  return /chat/i.test(name);
}

/**
 * 根据 timedtext URL 查询参数生成字幕轨唯一 Key。
 *
 * @param {URL} potUrl 当前拦截到的 YouTube timedtext 请求 URL。
 * @returns {string} 由视频、语言、轨道类型等字段拼接的轨道标识。
 */
export function buildTrackKey(potUrl) {
  const p = potUrl.searchParams;
  return [
    p.get("v") || "",
    p.get("lang") || "",
    p.get("kind") || "",
    p.get("name") || "",
    p.get("tlang") || "",
  ].join("|");
}

/**
 * Selects a caption track only when YouTube exposes unambiguous default-track
 * metadata. A single available caption track is also safe to recover.
 *
 * @param {object} trackData Parsed player caption metadata.
 * @param {Array<object>} trackData.captionTracks Available caption tracks.
 * @param {Array<object>} [trackData.audioTracks] Available audio-track metadata.
 * @param {number} [trackData.defaultAudioTrackIndex] Default audio-track index.
 * @param {number} [trackData.defaultCaptionTrackIndex] Direct default caption index.
 * @returns {object|null} The reliable default track, or null when ambiguous.
 */
export function findDefaultCaptionTrack({
  captionTracks,
  audioTracks,
  defaultAudioTrackIndex,
  defaultCaptionTrackIndex,
} = {}) {
  if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
    return null;
  }

  const isValidCaptionIndex = (index) =>
    Number.isInteger(index) && index >= 0 && index < captionTracks.length;

  if (isValidCaptionIndex(defaultCaptionTrackIndex)) {
    return captionTracks[defaultCaptionTrackIndex];
  }

  const availableAudioTracks = Array.isArray(audioTracks) ? audioTracks : [];
  let selectedAudioTrack = null;
  if (
    Number.isInteger(defaultAudioTrackIndex) &&
    defaultAudioTrackIndex >= 0 &&
    defaultAudioTrackIndex < availableAudioTracks.length
  ) {
    selectedAudioTrack = availableAudioTracks[defaultAudioTrackIndex];
  } else {
    const defaultAudioTracks = availableAudioTracks.filter(
      (audioTrack) => audioTrack?.hasDefaultTrack === true
    );
    if (defaultAudioTracks.length === 1) {
      selectedAudioTrack = defaultAudioTracks[0];
    } else if (availableAudioTracks.length === 1) {
      selectedAudioTrack = availableAudioTracks[0];
    }
  }

  if (isValidCaptionIndex(selectedAudioTrack?.defaultCaptionTrackIndex)) {
    return captionTracks[selectedAudioTrack.defaultCaptionTrackIndex];
  }

  const audioDefaultIndices = new Set(
    availableAudioTracks
      .map((audioTrack) => audioTrack?.defaultCaptionTrackIndex)
      .filter(isValidCaptionIndex)
  );
  if (audioDefaultIndices.size === 1) {
    const [sharedDefaultIndex] = audioDefaultIndices;
    return captionTracks[sharedDefaultIndex];
  }

  return captionTracks.length === 1 ? captionTracks[0] : null;
}

/**
 * 寻找与当前拦截请求最匹配的 YouTube 字幕轨。
 *
 * @param {Array<object>} captionTracks YouTube 页面提供的字幕轨配置列表。
 * @param {string} lang 当前 timedtext 请求的语言编码。
 * @param {string|null} kind 当前 timedtext 请求的轨道类型。
 * @returns {object|null} 匹配到的 captionTrack；无法匹配时返回 null。
 */
export function findCaptionTrack(captionTracks, lang, kind) {
  logger.debug("Youtube Provider: find caption track", {
    captionTracks,
    lang,
    kind,
  });

  if (!captionTracks?.length) {
    return null;
  }

  // 优先匹配用户选择的字幕轨（语言 + kind 完全一致）。
  // 手动字幕没有 kind 字段，统一转成 null，避免 undefined !== null 导致无法匹配。
  let captionTrack = captionTracks.find(
    (item) =>
      item.languageCode === lang && (item.kind || null) === (kind || null)
  );
  if (!captionTrack) {
    captionTrack = captionTracks.find((item) => item.languageCode === lang);
  }
  if (!captionTrack) {
    const asrTrack = captionTracks.find((item) => item.kind === "asr");
    if (asrTrack) {
      captionTrack = captionTracks.find(
        (item) =>
          item.kind !== "asr" &&
          isSameLang(item.languageCode, asrTrack.languageCode)
      );
      if (!captionTrack) {
        captionTrack = asrTrack;
      }
    }
  }

  if (!captionTrack) {
    // Keep cached track metadata immutable.
    captionTrack = captionTracks[captionTracks.length - 1];
  }

  // Chat/弹幕字幕轨道自动降级为正常字幕轨道。
  if (captionTrack && isChatCaptionTrack(captionTrack)) {
    logger.debug(
      "Youtube Provider: detected chat subtitle track, switching to normal subtitle"
    );

    const nonChatSameLang = captionTracks.find(
      (item) => isSameLang(item.languageCode, lang) && !isChatCaptionTrack(item)
    );

    if (nonChatSameLang) {
      logger.debug(
        "Youtube Provider: switched to same-language non-chat track"
      );
      captionTrack = nonChatSameLang;
    } else {
      const anyNonChat = captionTracks.find(
        (item) => !isChatCaptionTrack(item)
      );
      if (anyNonChat) {
        logger.debug("Youtube Provider: switched to fallback non-chat track");
        captionTrack = anyNonChat;
      }
    }
  }

  return captionTrack;
}

let captionTracksCache = null;

async function fetchCaptionTracks(videoId) {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const html = await fetch(url).then((r) => r.text());
    const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/s);
    if (!match) return {};
    const data = JSON.parse(match[1]);
    const tracklistRenderer =
      data.captions?.playerCaptionsTracklistRenderer || {};
    return {
      captionTracks: tracklistRenderer.captionTracks,
      audioTracks: tracklistRenderer.audioTracks,
      defaultAudioTrackIndex: tracklistRenderer.defaultAudioTrackIndex,
      defaultCaptionTrackIndex: tracklistRenderer.defaultCaptionTrackIndex,
      fullDescription: data.videoDetails?.shortDescription || "",
    };
  } catch (err) {
    logger.info("Youtube Provider: get captionTracks", err);
    return {};
  }
}

function waitForCaptionTracks(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.resolve({});

  return new Promise((resolve) => {
    const handleAbort = () => {
      cleanup();
      resolve({});
    };
    const cleanup = () => {
      signal.removeEventListener("abort", handleAbort);
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    promise.then(
      (result) => {
        cleanup();
        resolve(result);
      },
      () => {
        cleanup();
        resolve({});
      }
    );
  });
}

/**
 * Fetch and cache the current video's caption metadata.
 * The shared request is independent from each caller's abort signal so a stale
 * recovery request cannot cancel metadata needed by a real caption intercept.
 *
 * @param {string} videoId Current video ID.
 * @param {object} [options] Optional request controls.
 * @param {AbortSignal} [options.signal] Cancels only this caller's wait.
 * @returns {Promise<{captionTracks?: Array<object>, audioTracks?: Array<object>, defaultAudioTrackIndex?: number, defaultCaptionTrackIndex?: number, fullDescription?: string}>}
 */
export async function getCaptionTracks(videoId, { signal } = {}) {
  if (signal?.aborted) return {};

  let promise =
    captionTracksCache?.videoId === videoId ? captionTracksCache.promise : null;

  if (!promise) {
    promise = fetchCaptionTracks(videoId);
    captionTracksCache = { videoId, promise };
    void promise.then((result) => {
      if (
        !result.captionTracks?.length &&
        captionTracksCache?.promise === promise
      ) {
        captionTracksCache = null;
      }
    });
  }

  return waitForCaptionTracks(promise, signal);
}

/**
 * 获取字幕详细事件数组。
 * 当前拦截响应已经是目标原文字幕时直接解析，否则按选中轨道重新请求 JSON3 字幕。
 *
 * @param {URL} capUrl 最终选中的字幕轨 baseUrl。
 * @param {URL} potUrl 当前拦截到的 timedtext 请求 URL。
 * @param {string|null} responseText 当前拦截请求的响应文本。
 * @returns {Promise<Array<object>|null>} YouTube json3 events 数组。
 */
export async function getSubtitleEvents(capUrl, potUrl, responseText) {
  if (
    typeof responseText === "string" &&
    responseText.length > 0 &&
    !potUrl.searchParams.get("tlang") &&
    potUrl.searchParams.get("kind") === capUrl.searchParams.get("kind") &&
    isSameLang(potUrl.searchParams.get("lang"), capUrl.searchParams.get("lang"))
  ) {
    try {
      const json = JSON.parse(responseText);
      return json?.events;
    } catch (err) {
      logger.info("Youtube Provider: parse responseText", err);
      return null;
    }
  }

  try {
    // REVIEW: 这里沿用原有就地修改 potUrl.searchParams 的行为。
    // 如果 potUrl 被其他调用方共享，可能产生副作用；本次拆分不改变该行为。
    potUrl.searchParams.delete("tlang");
    potUrl.searchParams.delete("name");
    potUrl.searchParams.set("lang", capUrl.searchParams.get("lang"));
    potUrl.searchParams.set("fmt", "json3");
    if (capUrl.searchParams.get("kind")) {
      potUrl.searchParams.set("kind", capUrl.searchParams.get("kind"));
    } else {
      potUrl.searchParams.delete("kind");
    }

    const res = await fetch(potUrl.href);
    if (res?.ok) {
      const json = await res.json();
      return json?.events;
    }
    logger.info(`Youtube Provider: Failed to fetch subtitles: ${res.status}`);
    return null;
  } catch (error) {
    logger.info("Youtube Provider: fetching subtitles error", error);
    return null;
  }
}
