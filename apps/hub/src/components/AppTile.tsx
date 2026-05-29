import type { AppColor, AppDefinition } from "@/lib/apps";
import { getIcon } from "@/lib/icons";

const tileBg: Record<AppColor, string> = {
  coral: "bg-coral",
  teal: "bg-teal",
  purple: "bg-purple",
  amber: "bg-amber",
  blue: "bg-blue",
  pink: "bg-pink",
  green: "bg-green",
  gray: "bg-gray",
};

// Per Radix Colors' contrasted-text rule, amber pairs with a dark foreground;
// every other accent at step 9 takes white.
const tileFg: Record<AppColor, string> = {
  coral: "text-white",
  teal: "text-white",
  purple: "text-white",
  amber: "text-[var(--mauve-1)]",
  blue: "text-white",
  pink: "text-white",
  green: "text-white",
  gray: "text-white",
};

export default function AppTile({ app }: { app: AppDefinition }) {
  const Icon = getIcon(app.icon);
  const stableUrl = app.versions.stable;

  return (
    <a
      href={stableUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block min-h-11 rounded-2xl border border-border bg-surface p-3 transition-colors hover:bg-surface-elevated"
    >
      <div
        className={`mb-3 flex aspect-square items-center justify-center rounded-xl ${tileBg[app.color]} ${tileFg[app.color]}`}
      >
        <Icon size={36} stroke={1.5} />
      </div>
      <div className="space-y-0.5">
        <p className="truncate text-sm font-medium text-text">{app.name}</p>
        <p className="line-clamp-2 text-xs text-text-muted">{app.description}</p>
      </div>
    </a>
  );
}
