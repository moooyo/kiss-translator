import { run } from "./common";

// Start the userscript runtime and surface startup failures to the console.
run(true).catch((error) => {
  console.error("[KISS-Translator] Failed to start userscript runtime", error);
});
