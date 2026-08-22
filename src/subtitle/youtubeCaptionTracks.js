import { logger } from "../libs/log.js";
import {
  isSameTranslationLanguage,
  normalizeLanguageCode,
} from "../libs/language.js";

/**
 * YouTube 字幕轨道数据层。
 * 只负责识别、选择和拉取 YouTube timedtext/captionTrack 数据，不参与字幕断句、翻译或页面渲染。
 */

/**
 * 简易判断两种语言编码是否属于同一语言大类。
 *
 * @param {string} lang1 第一种语言编码，如 zh-CN。
 * @param {string} lang2 第二种语言编码，如 zh-TW。
 * @param {boolean} translateVariants 是否区分同一语言的不同变体。
 * @returns {boolean} 两个轨道语言是否可视为相同。
 */
export function isSameLang(lang1, lang2, translateVariants = false) {
  const source = normalizeLanguageCode(lang1);
  const target = normalizeLanguageCode(lang2);
  if (source && target) {
    return isSameTranslationLanguage(source, target, translateVariants);
  }

  const rawSource = String(lang1 || "")
    .trim()
    .replaceAll("_", "-")
    .toLowerCase();
  const rawTarget = String(lang2 || "")
    .trim()
    .replaceAll("_", "-")
    .toLowerCase();
  if (!rawSource || !rawTarget) return false;

  return translateVariants
    ? rawSource === rawTarget
    : rawSource.split("-")[0] === rawTarget.split("-")[0];
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
 * 依据 YouTube 播放器响应里的默认轨元数据，判断应当加载哪条字幕轨。
 *
 * 只在没有拦截到 timedtext 请求时用得上——那时无从得知用户选的是哪条。
 * **无法确定时返回 null,而不是挑一条**：一个视频可能有多条语言的字幕，
 * 猜错的代价是加载并翻译一条用户没选的轨。宁可等真实拦截。
 *
 * @param {Object} [trackData] 播放器响应中的字幕轨元数据
 * @param {Array<object>} [trackData.captionTracks] 字幕轨列表
 * @param {Array<object>} [trackData.audioTracks] 音轨列表
 * @param {number} [trackData.defaultAudioTrackIndex] 默认音轨下标
 * @param {number} [trackData.defaultCaptionTrackIndex] 直接给出的默认字幕轨下标
 * @returns {object|null} 可确定的默认字幕轨；无法确定时为 null
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

  // 1. 播放器直接给出了默认字幕轨
  if (isValidCaptionIndex(defaultCaptionTrackIndex)) {
    return captionTracks[defaultCaptionTrackIndex];
  }

  // 2. 通过默认音轨间接确定
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

  // 3. 所有音轨都指向同一条字幕轨
  const audioDefaultIndices = new Set(
    availableAudioTracks
      .map((audioTrack) => audioTrack?.defaultCaptionTrackIndex)
      .filter(isValidCaptionIndex)
  );
  if (audioDefaultIndices.size === 1) {
    const [sharedDefaultIndex] = audioDefaultIndices;
    return captionTracks[sharedDefaultIndex];
  }

  // 4. 只有一条轨时没有歧义；多条则不猜
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
    const tracklist = data.captions?.playerCaptionsTracklistRenderer;
    return {
      captionTracks: tracklist?.captionTracks,
      // 恢复路径需要知道 YouTube 自己认为哪条是默认轨，否则只能靠猜
      audioTracks: tracklist?.audioTracks,
      defaultAudioTrackIndex: tracklist?.defaultAudioTrackIndex,
      defaultCaptionTrackIndex: tracklist?.defaultCaptionTrackIndex,
      fullDescription: data.videoDetails?.shortDescription || "",
    };
  } catch (err) {
    logger.info("Youtube Provider: get captionTracks", err);
    return {};
  }
}

/**
 * Fetch and cache the current video's caption metadata.
 * Reuses an in-flight request when multiple tracks arrive for the same video.
 *
 * @param {string} videoId Current video ID.
 * @returns {Promise<{captionTracks?: Array<object>, fullDescription?: string}>}
 */
export async function getCaptionTracks(videoId) {
  if (captionTracksCache?.videoId === videoId) {
    return captionTracksCache.promise;
  }

  const promise = fetchCaptionTracks(videoId);
  captionTracksCache = { videoId, promise };
  const result = await promise;

  // Do not retain failed or incomplete metadata; a later request can retry.
  if (
    !result.captionTracks?.length &&
    captionTracksCache?.promise === promise
  ) {
    captionTracksCache = null;
  }

  return result;
}

/**
 * 获取字幕详细事件数组。
 * 当前拦截响应已经是目标原文字幕时直接解析，否则按选中轨道重新请求 JSON3 字幕。
 *
 * @param {URL} capUrl 最终选中的字幕轨 baseUrl。
 * @param {URL} potUrl 当前拦截到的 timedtext 请求 URL。
 * @param {string} responseText 当前拦截请求的响应文本。
 * @returns {Promise<Array<object>|null>} YouTube json3 events 数组。
 */
export async function getSubtitleEvents(capUrl, potUrl, responseText) {
  if (
    // 没有响应体时不能走解析快路径：JSON.parse(null) 得到 null，
    // json?.events 是 undefined，调用方据此判定「没有字幕」而不是去取。
    // 恢复路径(拦截器装载晚于 timedtext 请求)就是没有响应体的。
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
