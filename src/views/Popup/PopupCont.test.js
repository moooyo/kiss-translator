import { getVisibleServices } from "./services";

describe("getVisibleServices", () => {
  const services = [
    { key: "builtin", name: "BuiltinAI" },
    { key: "google", name: "Google" },
    { key: "microsoft", name: "Microsoft" },
    { key: "deepl", name: "DeepL" },
  ];

  test("shows two services while preserving an active service outside the first two", () => {
    expect(getVisibleServices(services, "microsoft", false)).toEqual([
      services[0],
      services[2],
    ]);
  });

  test("shows every service after expanding more", () => {
    expect(getVisibleServices(services, "microsoft", true)).toEqual(services);
  });
});
