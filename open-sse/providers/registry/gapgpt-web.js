import { STATIC_GAPGPT_WEB_MODELS } from "../../services/gapgptWebModels.js";

export default {
  id: "gapgpt-web",
  priority: 215,
  alias: "gapgpt-web",
  aliases: [
    "gg-web",
  ],
  uiAlias: "gapgpt-web",
  display: {
    name: "GapGPT Web",
    icon: "auto_awesome",
    color: "#00B8A9",
    textIcon: "GGW",
    website: "https://gapgpt.app",
    notice: {
      signupUrl: "https://gapgpt.app",
    },
  },
  category: "webCookie",
  authType: "cookie",
  serviceKinds: ["llm", "image", "video"],
  authHint: "Paste full Cookie header from DevTools Network tab (must include accessToken and __Host-gap_dk), or use Login via Browser",
  modelsFetcher: { url: "https://gapgpt.app/", type: "gapgpt-web" },
  passthroughModels: true,
  transport: {
    baseUrl: "https://gapgpt.app",
    format: "openai",
    authType: "cookie",
  },
  models: STATIC_GAPGPT_WEB_MODELS,
};
