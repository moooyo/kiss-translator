import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { API_SPE_TYPES } from "../config";

/**
 * Single-line label with overflow truncation.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children Label content.
 */
function Label({ children }) {
  return (
    <span
      style={{
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/**
 * Accessible menu-row button with hover feedback.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children Row content.
 * @param {Function} props.onClick Activation callback.
 * @param {Function} props.onKeyDown Optional keyboard callback.
 * @param {React.RefObject<HTMLButtonElement>} props.buttonRef Button ref.
 * @param {boolean} [props.disabled=false] Whether the row is disabled.
 * @param {string} [props.role="button"] ARIA role for the button.
 */
function MenuItem({
  children,
  onClick,
  onKeyDown,
  buttonRef,
  disabled = false,
  role = "button",
  ...buttonProps
}) {
  const [hover, setHover] = useState(false);
  const highlighted = hover && !disabled;

  const handleClick = useCallback(
    (event) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    },
    [disabled, onClick]
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (disabled) {
        event.preventDefault();
        return;
      }

      if (event.repeat && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        return;
      }

      onKeyDown?.(event);
      if (event.defaultPrevented) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick?.(event);
      }
    },
    [disabled, onClick, onKeyDown]
  );

  return (
    <button
      {...buttonProps}
      ref={buttonRef}
      type="button"
      role={role}
      disabled={disabled}
      aria-disabled={disabled}
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0px 8px",
        margin: 0,
        border: 0,
        opacity: disabled ? 0.5 : highlighted ? 1 : 0.8,
        background: `rgba(255, 255, 255, ${highlighted ? 0.1 : 0})`,
        color: "inherit",
        cursor: disabled ? "default" : "pointer",
        font: "inherit",
        lineHeight: "inherit",
        textAlign: "left",
        appearance: "none",
        transition: "background 0.2s, opacity 0.2s",
        borderRadius: 5,
      }}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </button>
  );
}

/**
 * Toggle switch used by the in-player settings menu.
 *
 * @param {object} props
 * @param {string} props.label Visible and accessible label.
 * @param {string} props.name Settings field name.
 * @param {boolean} props.value Current checked state.
 * @param {Function} props.onChange State-change callback.
 * @param {boolean} props.disabled Whether the switch is disabled.
 */
function Switch({ label, name, value, onChange, disabled }) {
  const handleClick = useCallback(() => {
    if (disabled) return;

    onChange({ name, value: !value });
  }, [disabled, onChange, name, value]);

  return (
    <MenuItem
      onClick={handleClick}
      disabled={disabled}
      role="switch"
      aria-checked={Boolean(value)}
      aria-label={label}
    >
      <Label>{label}</Label>
      {/* Track */}
      <span
        aria-hidden="true"
        style={{
          width: 40,
          height: 24,
          display: "block",
          flex: "0 0 auto",
          borderRadius: 12,
          background: value ? "rgba(32,156,238,.8)" : "rgba(255,255,255,.3)",
          position: "relative",
          transition: "background 180ms ease",
        }}
      >
        {/* Thumb */}
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            position: "absolute",
            left: 2,
            top: 2,
            background: "rgba(255,255,255,.9)",
            transform: `translateX(${value ? 16 : 0}px)`,
            transition: "transform 180ms ease",
          }}
        />
      </span>
    </MenuItem>
  );
}

/**
 * Custom select control used by the in-player settings menu.
 *
 * @param {object} props
 * @param {string} props.label Visible and accessible label.
 * @param {string} props.name - 表单字段 Key 名
 * @param {*} props.value - 当前选中的值
 * @param {Array<object>} props.options - 下拉选项数组，每一项为 { value, label }
 * @param {Function} props.onChange - 选项改变时的回调
 * @param {boolean} props.disabled - 是否禁用下拉框
 */
function Select({ label, name, value, options, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false); // 控制下拉菜单面板的展开/收起状态
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const listboxId = useId();

  // 查找当前被选中的选项，若没匹配到则回退至第一个可选项以做安全兜底
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) || options[0],
    [options, value]
  );
  const selectedIndex = useMemo(
    () =>
      Math.max(
        0,
        options.findIndex((option) => option.value === value)
      ),
    [options, value]
  );

  useEffect(() => {
    optionRefs.current.length = options.length;
    if (isOpen) {
      setActiveIndex(selectedIndex);
      optionRefs.current[selectedIndex]?.focus();
    }
  }, [isOpen, options.length, selectedIndex]);

  useEffect(() => {
    if (disabled && isOpen) setIsOpen(false);
  }, [disabled, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isOpen]);

  // 切换下拉菜单展开收起
  const handleToggle = useCallback(() => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  }, [disabled]);

  const closeAndFocusTrigger = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  // 选中下拉具体选项时，派发 onChange 事件，随后关闭下拉选择面板
  const handleSelect = useCallback(
    (optionValue) => {
      if (disabled) return;
      onChange({ name, value: optionValue });
      closeAndFocusTrigger();
    },
    [closeAndFocusTrigger, disabled, onChange, name]
  );

  const focusOption = useCallback(
    (index) => {
      if (options.length === 0) return;
      const nextIndex = (index + options.length) % options.length;
      setActiveIndex(nextIndex);
      optionRefs.current[nextIndex]?.focus();
    },
    [options.length]
  );

  const handleTriggerKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleToggle();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          focusOption(selectedIndex);
        }
        return;
      }

      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        closeAndFocusTrigger();
      }
    },
    [closeAndFocusTrigger, focusOption, handleToggle, isOpen, selectedIndex]
  );

  const handleOptionKeyDown = useCallback(
    (event, index, optionValue) => {
      switch (event.key) {
        case "Enter":
        case " ":
          event.preventDefault();
          if (!event.repeat) handleSelect(optionValue);
          break;
        case "Escape":
          event.preventDefault();
          closeAndFocusTrigger();
          break;
        case "ArrowDown":
          event.preventDefault();
          focusOption(index + 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          focusOption(index - 1);
          break;
        case "Home":
          event.preventDefault();
          focusOption(0);
          break;
        case "End":
          event.preventDefault();
          focusOption(options.length - 1);
          break;
        default:
      }
    },
    [closeAndFocusTrigger, focusOption, handleSelect, options.length]
  );

  return (
    <div
      ref={containerRef}
      style={{ position: "relative" }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <MenuItem
        buttonRef={triggerRef}
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        role="button"
        aria-label={`${label}: ${selectedOption?.label || ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        tabIndex={isOpen ? -1 : 0}
      >
        <Label>{label}</Label>
        <span
          style={{
            fontSize: 12,
            opacity: 0.8,
            maxWidth: 130,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedOption?.label || ""}
        </span>
      </MenuItem>
      {/* 下拉浮出面板 */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={label}
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            background: "rgba(0,0,0,.8)",
            borderRadius: 5,
            minWidth: 250,
            maxHeight: 200,
            overflow: "auto",
            zIndex: 1000,
            marginTop: 4,
          }}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              role="option"
              disabled={disabled}
              aria-disabled={disabled}
              aria-selected={option.value === value}
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => handleSelect(option.value)}
              onKeyDown={(event) =>
                handleOptionKeyDown(event, index, option.value)
              }
              style={{
                width: "100%",
                display: "block",
                padding: "8px 12px",
                margin: 0,
                border: 0,
                cursor: "pointer",
                color: "inherit",
                font: "inherit",
                lineHeight: "inherit",
                textAlign: "left",
                appearance: "none",
                background:
                  option.value === value
                    ? "rgba(32,156,238,.3)"
                    : "transparent",
                opacity: option.value === value ? 1 : 0.8,
                transition: "background 0.2s, opacity 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  option.value === value
                    ? "rgba(32,156,238,.4)"
                    : "rgba(255,255,255,.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  option.value === value
                    ? "rgba(32,156,238,.3)"
                    : "transparent";
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Button 组件 - 简单按钮菜单项组件
 *
 * @param {object} props
 * @param {string} props.label - 按钮上的文本内容
 * @param {Function} props.onClick - 点击按钮的回调事件
 * @param {boolean} props.disabled - 是否禁用按钮
 */
function Button({ label, onClick, disabled }) {
  const handleClick = useCallback(() => {
    if (disabled) return;

    onClick();
  }, [disabled, onClick]);

  return (
    <MenuItem
      onClick={handleClick}
      disabled={disabled}
      role="button"
      aria-label={label}
    >
      <Label>{label}</Label>
    </MenuItem>
  );
}

/**
 * Menus 组件 - 视频字幕设置快捷快捷菜单浮动面板组件
 * 用于在视频网页播放器上层叠展示，控制 AI 智能分句、AI 上下文增强、双语显示等配置项
 *
 * @param {object} props
 * @param {Function} props.i18n - 国际化翻译转换函数
 * @param {object} props.formData - 表单绑定配置数据对象
 * @param {number} [props.progressed=0] - 字幕处理/下载进度百分比数值 (0 - 100)
 * @param {Function} props.updateSetting - 更新全局/字幕配置项的回调函数
 * @param {Function} props.downloadSubtitle - 点击触发下载双语字幕的回调函数
 * @param {Array<object>} props.transApis - 系统当前配置的翻译 API 列表
 */
export function Menus({
  i18n,
  formData,
  progressed = 0,
  updateSetting,
  downloadSubtitle,
  transApis,
  onClose = () => {},
}) {
  const dialogRef = useRef(null);
  // 当快捷菜单的任何子选项发生更改时，统一向上层派发更新事件
  const handleChange = useCallback(
    ({ name, value }) => {
      updateSetting({ name, value });
    },
    [updateSetting]
  );

  // 过滤并计算出当前所有未禁用的翻译 API 列表，用于 UI 下拉列表展示
  const enabledApis = useMemo(
    () => (transApis || []).filter((api) => !api.isDisabled),
    [transApis]
  );

  // 进一步过滤出其中属于 AI 大语言模型翻译类型的 API
  const aiEnabledApis = useMemo(
    () => enabledApis.filter((api) => API_SPE_TYPES.ai.has(api.apiType)),
    [enabledApis]
  );

  // 构造字幕翻译服务下拉列表，只展示当前启用的接口
  const transApiOptions = useMemo(
    () =>
      enabledApis.map((api) => ({
        value: api.apiSlug,
        label: api.apiName,
      })),
    [enabledApis]
  );

  // 构造 AI 智能断句服务下拉列表选项 (若没有启用的 AI 接口，则下拉项仅有禁用)
  const segOptions = useMemo(() => {
    const options = [{ value: "-", label: i18n("disable") || "禁用" }];
    aiEnabledApis.forEach((api) => {
      options.push({ value: api.apiSlug, label: api.apiName });
    });
    return options;
  }, [aiEnabledApis, i18n]);

  // 构造 AI 视频上下文增强服务下拉列表选项 (若没有启用的 AI 接口，则下拉项仅有禁用)
  const aiContextOptions = useMemo(() => {
    const options = [{ value: "-", label: i18n("disable") || "禁用" }];
    aiEnabledApis.forEach((api) => {
      options.push({ value: api.apiSlug, label: api.apiName });
    });
    return options;
  }, [aiEnabledApis, i18n]);

  // 双语字幕显示顺序的固定两项
  const displayOrderOptions = useMemo(
    () => [
      { value: "original-first", label: i18n("original_first") },
      { value: "translation-first", label: i18n("translation_first") },
    ],
    [i18n]
  );

  // 根据当前字幕处理/翻译进度值，动态计算快捷菜单底部的下载按钮状态文案
  const status = useMemo(() => {
    if (progressed === 0) return i18n("waiting_subtitles");
    if (progressed === 100) return i18n("download_subtitles");
    return i18n("processing_subtitles");
  }, [progressed, i18n]);

  useEffect(() => {
    dialogRef.current
      ?.querySelector("button:not(:disabled), [tabindex='0']")
      ?.focus();
  }, []);

  // 从表单配置对象中解构出字幕交互相关的控制值
  const {
    apiSlug, // 当前页面使用的字幕翻译服务 apiSlug
    segSlug, // 选中的智能断句大模型 apiSlug
    skipAd, // 是否开启自动跳过广告
    isBilingual, // 是否采用双语对照视图显示
    blurTranslation, // 是否启用模糊隐藏译文，悬浮时显示的背词模式
    displayOrder, // 双语字幕的显示顺序：原文在前或译文在前
    autoTranslate, // 当前视频是否开启字幕翻译
    aiContextSlug, // 选中的上下文增强服务 apiSlug
  } = formData;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={
        i18n("enable_subtitle_translate") || "Subtitle translation controls"
      }
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      style={{
        position: "absolute",
        left: 0,
        bottom: 100,
        background: "rgba(0,0,0,.6)",
        width: 250,
        lineHeight: "40px",
        fontSize: 16,
        padding: 8,
        borderRadius: 5,
      }}
    >
      {/* 当前视频的翻译开关 */}
      <Switch
        onChange={handleChange}
        name="autoTranslate"
        value={autoTranslate}
        label={i18n("enable_subtitle_translate")}
      />
      {/* 当前页面的字幕翻译服务，不修改持久化默认设置 */}
      <Select
        onChange={handleChange}
        name="apiSlug"
        value={apiSlug}
        options={transApiOptions}
        label={i18n("translate_service")}
        disabled={transApiOptions.length === 0}
      />
      {/* 智能断句下拉项：若可用 AI 大模型数量为 0 时禁用下拉 */}
      <Select
        onChange={handleChange}
        name="segSlug"
        value={segSlug || "-"}
        options={segOptions}
        label={i18n("ai_segmentation")}
        disabled={segOptions.length <= 1}
      />
      {/* 视频上下文增强下拉项：通过 AI 预分析视频内容，帮助更准确地进行专业词汇翻译 */}
      <Select
        onChange={handleChange}
        name="aiContextSlug"
        value={aiContextSlug || "-"}
        options={aiContextOptions}
        label={i18n("ai_enhanced_context")}
        disabled={aiContextOptions.length <= 1}
      />
      {/* 双语对照显示开关 */}
      <Switch
        onChange={handleChange}
        name="isBilingual"
        value={isBilingual}
        label={i18n("is_bilingual_view")}
      />
      {/* 双语字幕显示顺序：管路本来就是通的（provider 路由、manager 读取），
          此前只是菜单里没有这个控件 */}
      <Select
        onChange={handleChange}
        name="displayOrder"
        value={displayOrder || "original-first"}
        options={displayOrderOptions}
        label={i18n("trans_order")}
      />
      {/* 译文模糊背词开关 */}
      <Switch
        onChange={handleChange}
        name="blurTranslation"
        value={blurTranslation}
        label={i18n("is_blur_translation")}
      />
      {/* 广告跳过开关 */}
      <Switch
        onChange={handleChange}
        name="skipAd"
        value={skipAd}
        label={i18n("is_skip_ad")}
      />
      {/* 字幕下载动作按钮：按需 AI 断句下允许下载当前已处理的字幕 */}
      <Button
        label={`${status} [${progressed}%] `}
        onClick={downloadSubtitle}
        disabled={progressed === 0}
      />
    </div>
  );
}
