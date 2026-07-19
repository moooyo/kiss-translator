import { useEffect, useState } from "react";
import { M3Segmented, M3Switch } from "../../components/M3";

export function SettingsSection({ title, children, className = "" }) {
  return (
    <section className={`kt-settings-section ${className}`.trim()}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

export function SettingsCard({ children, className = "" }) {
  return (
    <div className={`kt-settings-card ${className}`.trim()}>{children}</div>
  );
}

export function SettingsRow({
  label,
  description,
  children,
  stacked = false,
  className = "",
}) {
  return (
    <div
      className={`kt-settings-row ${stacked ? "kt-settings-row--stacked" : ""} ${className}`.trim()}
    >
      <div className="kt-settings-row__copy">
        <strong>{label}</strong>
        {description && <span>{description}</span>}
      </div>
      <div className="kt-settings-row__control">{children}</div>
    </div>
  );
}

export function SettingsSwitch({ checked, onChange, label, disabled = false }) {
  return (
    <M3Switch
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={label}
    />
  );
}

export function SettingsSegmented({
  value,
  onChange,
  items,
  label,
  className = "",
}) {
  return (
    <M3Segmented
      className={`kt-settings-segmented ${className}`.trim()}
      value={value}
      onChange={onChange}
      items={items}
      ariaLabel={label}
      mode="radio"
    />
  );
}

export function SettingsSelect({
  value,
  onChange,
  options,
  label,
  multiple = false,
  disabled = false,
}) {
  return (
    <select
      className="kt-settings-select"
      value={value}
      multiple={multiple}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => {
        const nextValue = multiple
          ? Array.from(event.target.selectedOptions, (option) => option.value)
          : event.target.value;
        onChange(nextValue);
      }}
    >
      {options.map((option) => {
        const normalized = Array.isArray(option)
          ? { value: option[0], label: option[1] }
          : option;
        return (
          <option key={normalized.value} value={normalized.value}>
            {normalized.label}
          </option>
        );
      })}
    </select>
  );
}

export function SettingsRange({
  value,
  min,
  max,
  step = 1,
  unit = "",
  label,
  onChange,
}) {
  return (
    <div className="kt-settings-range">
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{`${value}${unit}`}</output>
    </div>
  );
}

export function ShortcutKeys({ keys }) {
  return (
    <span className="kt-settings-keys" aria-label={keys.join("+")}>
      {keys.map((key) => (
        <kbd key={key}>{key}</kbd>
      ))}
    </span>
  );
}

export function SettingsAdvanced({
  label,
  children,
  open = false,
  className = "",
}) {
  const [expanded, setExpanded] = useState(open);

  useEffect(() => {
    setExpanded(open);
  }, [open]);

  return (
    <details
      className={`kt-settings-advanced ${className}`.trim()}
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>{label}</summary>
      {expanded && (
        <div className="kt-settings-advanced__content">{children}</div>
      )}
    </details>
  );
}
