import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.maxumschaden.inventory",
  appName: "Inventory",
  webDir: "out",
  ios: {
    contentInset: "always",
  },
};

export default config;
