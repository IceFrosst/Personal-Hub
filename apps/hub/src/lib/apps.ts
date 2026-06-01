import appsConfig from "../../config/apps.json";

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
  /** Optional real app-icon image (served from the hub's /public). Falls back to the Tabler `icon`. */
  iconImage?: string;
  color: AppColor;
  versions: { stable: string };
  added_at: string;
};

type AppsConfig = { apps: AppDefinition[] };

export function getApps(): AppDefinition[] {
  return (appsConfig as AppsConfig).apps;
}
