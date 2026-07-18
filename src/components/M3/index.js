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
}) {
  return (
    <div
      className={`kt-m3-segmented ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const itemValue = typeof item === "string" ? item : item.value;
        const label = typeof item === "string" ? item : item.label;
        const selected = itemValue === value;
        return (
          <button
            type="button"
            role="tab"
            aria-selected={selected}
            key={itemValue}
            title={typeof label === "string" ? label : undefined}
            onClick={() => onChange(itemValue)}
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
