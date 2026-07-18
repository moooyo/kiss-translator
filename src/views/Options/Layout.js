import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Navigator from "./Navigator";
import { useI18n } from "../../hooks/I18n";
import { OPTIONS_STYLES } from "./styles";

export default function Layout() {
  const location = useLocation();
  const i18n = useI18n();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`${process.env.REACT_APP_VERSION_URL}?t=${Date.now()}`)
      .then((response) => response.text())
      .then((text) => {
        const version = text.trim();
        if (
          active &&
          version &&
          process.env.REACT_APP_VERSION &&
          version !== process.env.REACT_APP_VERSION
        ) {
          setLatestVersion(version);
        }
      })
      .catch((error) => console.error("fetch version error:", error));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setNavigationOpen(false);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  const page = useMemo(() => {
    const pages = {
      "/": [i18n("options_overview"), i18n("options_overview_description")],
      "/styles": [
        i18n("options_appearance"),
        i18n("options_appearance_description"),
      ],
      "/rules": [
        i18n("options_web_translation"),
        i18n("options_web_description"),
      ],
      "/tranbox": [
        i18n("selection_translate"),
        i18n("options_selection_description"),
      ],
      "/mousehover": [
        i18n("mousehover_translate"),
        i18n("options_hover_description"),
      ],
      "/input": [i18n("input_translate"), i18n("options_input_description")],
      "/subtitle": [
        i18n("subtitle_translate"),
        i18n("options_subtitle_description"),
      ],
      "/apis": [
        i18n("options_translation_services"),
        i18n("options_services_description"),
      ],
      "/prompts": [
        i18n("prompt_management"),
        i18n("options_prompts_description"),
      ],
      "/sync": [i18n("options_data_sync"), i18n("options_sync_description")],
      "/words": [i18n("favorite_words"), i18n("options_words_description")],
      "/playground": ["Playground", ""],
      "/about": [i18n("about"), ""],
    };
    return pages[location.pathname] || pages["/"];
  }, [i18n, location.pathname]);

  return (
    <div className="kt-options-shell">
      <style>{OPTIONS_STYLES}</style>
      <Header onDrawerToggle={() => setNavigationOpen(true)} />
      <div className="kt-options-layout">
        <Navigator open={navigationOpen} />
        <button
          type="button"
          className={`kt-options-overlay ${
            navigationOpen ? "kt-options-overlay--open" : ""
          }`}
          aria-label="Close navigation"
          onClick={() => setNavigationOpen(false)}
        />
        <main className="kt-options-main">
          <div className="kt-options-main__inner">
            <header className="kt-options-page-header">
              <h1>{page[0]}</h1>
              {page[1] && <p>{page[1]}</p>}
            </header>
            {latestVersion && (
              <div className="kt-options-version-alert" role="status">
                <span>
                  {i18n("version_warning")
                    .replace("{0}", process.env.REACT_APP_VERSION)
                    .replace("{1}", latestVersion)}
                </span>
                <a
                  href={process.env.REACT_APP_RELEASES_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  {i18n("download_update")}
                </a>
              </div>
            )}
            <div className="kt-options-page">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
