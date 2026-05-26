import type { AppDefinition } from "@/lib/apps";
import AppTile from "./AppTile";

export default function AppGrid({ apps }: { apps: AppDefinition[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {apps.map((app) => (
        <li key={app.slug}>
          <AppTile app={app} />
        </li>
      ))}
    </ul>
  );
}
