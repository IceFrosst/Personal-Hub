import type { AppDefinition } from "@/lib/apps";
import AppTile from "./AppTile";

export default function AppGrid({ apps }: { apps: AppDefinition[] }) {
  return (
    <ul className="grid grid-cols-4 gap-x-4 gap-y-6 sm:grid-cols-5 sm:gap-x-6">
      {apps.map((app) => (
        <li key={app.slug}>
          <AppTile app={app} />
        </li>
      ))}
    </ul>
  );
}
