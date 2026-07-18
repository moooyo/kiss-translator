import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import Logo from "../../components/Logo";
import { M3IconButton } from "../../components/M3";
import { useI18n } from "../../hooks/I18n";
import DarkModeButton from "./DarkModeButton";

export default function Header({ onDrawerToggle }) {
  const i18n = useI18n();
  return (
    <header className="kt-options-mobile-header">
      <M3IconButton onClick={onDrawerToggle} aria-label="Open navigation">
        <MenuRoundedIcon />
      </M3IconButton>
      <Logo size={25} />
      <span className="kt-options-mobile-header__name">{i18n("app_name")}</span>
      <DarkModeButton />
    </header>
  );
}
