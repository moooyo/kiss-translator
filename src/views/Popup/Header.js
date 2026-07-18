import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import Logo from "../../components/Logo";
import { M3IconButton } from "../../components/M3";
import { useI18n } from "../../hooks/I18n";

export default function Header({ onClose, openSeparateWindow, openSettings }) {
  const i18n = useI18n();

  const handleHomepage = () => {
    window.open(process.env.REACT_APP_HOMEPAGE, "_blank");
  };

  return (
    <header className="kt-popup-header">
      {onClose && (
        <span className="kt-popup-header__drag" aria-hidden="true">
          <DragIndicatorRoundedIcon fontSize="small" />
        </span>
      )}
      <button
        type="button"
        className="kt-popup-brand-button"
        onClick={handleHomepage}
        aria-label={i18n("app_name")}
      >
        <Logo size={24} className="kt-popup-header__logo" />
      </button>
      <span className="kt-popup-header__title">{i18n("app_name")}</span>
      <span className="kt-popup-header__version">
        v{process.env.REACT_APP_VERSION}
      </span>
      <span className="kt-popup-header__spacer" />
      {onClose ? (
        <M3IconButton onClick={onClose} aria-label={i18n("close")}>
          <CloseRoundedIcon />
        </M3IconButton>
      ) : (
        <>
          <M3IconButton
            onClick={openSeparateWindow}
            aria-label={i18n("open_separate_window")}
          >
            <OpenInNewRoundedIcon />
          </M3IconButton>
          <M3IconButton onClick={openSettings} aria-label={i18n("setting")}>
            <SettingsRoundedIcon />
          </M3IconButton>
        </>
      )}
    </header>
  );
}
