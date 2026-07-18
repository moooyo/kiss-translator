import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";

const AlertContext = createContext(null);

const ALERT_ICONS = {
  error: ErrorRoundedIcon,
  warning: WarningRoundedIcon,
  info: InfoRoundedIcon,
  success: CheckCircleRoundedIcon,
};

export function AlertProvider({ children }) {
  const [alert, setAlert] = useState(null);

  const showAlert = useCallback((message, severity) => {
    setAlert({ id: Date.now(), message, severity });
  }, []);

  useEffect(() => {
    if (!alert) return undefined;
    const timer = window.setTimeout(() => setAlert(null), 2600);
    return () => window.clearTimeout(timer);
  }, [alert]);

  const value = useMemo(
    () => ({
      error: (message) => showAlert(message, "error"),
      warning: (message) => showAlert(message, "warning"),
      info: (message) => showAlert(message, "info"),
      success: (message) => showAlert(message, "success"),
    }),
    [showAlert]
  );

  const Icon = alert ? ALERT_ICONS[alert.severity] || InfoRoundedIcon : null;

  return (
    <AlertContext.Provider value={value}>
      {children}
      {alert && (
        <div
          className={`kt-m3-snackbar kt-m3-snackbar--${alert.severity}`}
          role={alert.severity === "error" ? "alert" : "status"}
          onClick={() => setAlert(null)}
        >
          <Icon className="kt-m3-snackbar__status-icon" />
          <span>{alert.message}</span>
        </div>
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  return useContext(AlertContext);
}
