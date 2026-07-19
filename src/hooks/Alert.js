import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";

const AlertContext = createContext(null);

export function AlertProvider({ children }) {
  const [alert, setAlert] = useState(null);

  const showAlert = useCallback((message, severity) => {
    setAlert({ message, severity });
  }, []);

  const handleClose = useCallback((_event, reason) => {
    if (reason === "clickaway") return;
    setAlert(null);
  }, []);

  const value = useMemo(
    () => ({
      error: (message) => showAlert(message, "error"),
      warning: (message) => showAlert(message, "warning"),
      info: (message) => showAlert(message, "info"),
      success: (message) => showAlert(message, "success"),
    }),
    [showAlert]
  );

  return (
    <AlertContext.Provider value={value}>
      {children}
      <Snackbar
        open={Boolean(alert)}
        autoHideDuration={2600}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        onClose={handleClose}
      >
        <Alert
          severity={alert?.severity || "info"}
          variant="filled"
          onClose={handleClose}
          sx={{ maxWidth: "min(480px, calc(100vw - 32px))" }}
        >
          {alert?.message || ""}
        </Alert>
      </Snackbar>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  return useContext(AlertContext);
}
