import BrightnessAutoRoundedIcon from "@mui/icons-material/BrightnessAutoRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import { M3IconButton } from "../../components/M3";
import { useDarkMode } from "../../hooks/ColorMode";

export default function DarkModeButton() {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const Icon =
    darkMode === "dark"
      ? DarkModeRoundedIcon
      : darkMode === "light"
        ? LightModeRoundedIcon
        : BrightnessAutoRoundedIcon;

  return (
    <M3IconButton onClick={toggleDarkMode} aria-label="Change color theme">
      <Icon />
    </M3IconButton>
  );
}
