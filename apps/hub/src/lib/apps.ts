import appsConfig from "../../config/apps.json";

export type AppVersion = "stable" | "previous" | "experimental";

export type AppColor =
  | "coral"
  | "teal"
  | "purple"
  | "amber"
  | "blue"
  | "pink"
  | "green"
  | "gray";

export type AppDefinition = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: AppColor;
  versions: Record<AppVersion, string>;
  added_at: string;
};

type AppsConfig = { apps: AppDefinition[] };

export function getApps(): AppDefinition[] {
  return (appsConfig as AppsConfig).apps;
}
