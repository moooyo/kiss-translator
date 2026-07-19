import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

export function M3Button({ variant = "filled", className = "", ...props }) {
  const variantClass = variant === "filled" ? "" : ` kt-m3-button--${variant}`;
  return (
    <button
      type="button"
      className={`kt-m3-button${variantClass} ${className}`.trim()}
      {...props}
    />
  );
}

export function M3IconButton({ className = "", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={`kt-m3-icon-button ${className}`.trim()}
      {...props}
    />
  );
}

export function M3Switch({
  className = "",
  "aria-label": ariaLabel,
  ...props
}) {
  return (
    <label
      className={`kt-m3-switch ${className}`.trim()}
      onClick={(event) => event.stopPropagation()}
    >
      <input type="checkbox" aria-label={ariaLabel} {...props} />
      <span className="kt-m3-switch__track" aria-hidden="true">
        <span className="kt-m3-switch__thumb">
          <CheckRoundedIcon />
        </span>
      </span>
    </label>
  );
}

export function M3Segmented({
  items,
  value,
  onChange,
  ariaLabel,
  className = "",
  mode = "tabs",
}) {
  const selectedIndex = items.findIndex(
    (item) => (typeof item === "string" ? item : item.value) === value
  );

  const handleKeyDown = (event, index) => {
    const keys = [
      "ArrowRight",
      "ArrowDown",
      "ArrowLeft",
      "ArrowUp",
      "Home",
      "End",
    ];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % items.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    }
    const item = items[nextIndex];
    onChange(typeof item === "string" ? item : item.value);
    event.currentTarget.parentElement?.children[nextIndex]?.focus();
  };

  const isTabs = mode === "tabs";
  return (
    <div
      className={`kt-m3-segmented ${className}`.trim()}
      role={isTabs ? "tablist" : "radiogroup"}
      aria-label={ariaLabel}
    >
      {items.map((item, index) => {
        const itemValue = typeof item === "string" ? item : item.value;
        const label = typeof item === "string" ? item : item.label;
        const selected = itemValue === value;
        return (
          <button
            type="button"
            role={isTabs ? "tab" : "radio"}
            aria-selected={isTabs ? selected : undefined}
            aria-checked={isTabs ? undefined : selected}
            tabIndex={
              selected || (selectedIndex === -1 && index === 0) ? 0 : -1
            }
            key={itemValue}
            title={typeof label === "string" ? label : undefined}
            onClick={() => onChange(itemValue)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span className="kt-m3-segmented__label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function M3Snackbar({ open, message, onClose }) {
  if (!open) return null;
  return (
    <div className="kt-m3-snackbar" role="status" onClick={onClose}>
      <CheckRoundedIcon className="kt-m3-snackbar__check" />
      <span>{message}</span>
    </div>
  );
}

export function ServiceLogo({ src, alt = "", className = "" }) {
  return (
    <span className={`kt-service-logo ${className}`.trim()} aria-hidden={!alt}>
      {src ? <img src={src} alt={alt} /> : null}
    </span>
  );
}
