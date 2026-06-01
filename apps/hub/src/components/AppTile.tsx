import Image from "next/image";
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

// A home-screen-style app icon: rounded squircle + label underneath, no card chrome.
// Uses the app's real PWA icon when `iconImage` is set; otherwise falls back to the
// Tabler glyph on a colored tile so a newly-added app still renders.
export default function AppTile({ app }: { app: AppDefinition }) {
  const Icon = getIcon(app.icon);
  const stableUrl = app.versions.stable;

  return (
    <a
      href={stableUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col items-center gap-2 rounded-2xl p-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
    >
      <div className="aspect-square w-full overflow-hidden rounded-[22%] shadow-[0_8px_24px_rgba(0,0,0,0.5)] ring-1 ring-white/10 transition-transform duration-150 ease-out group-active:scale-95">
        {app.iconImage ? (
          <Image
            src={app.iconImage}
            alt={app.name}
            width={120}
            height={120}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center ${tileBg[app.color]} ${tileFg[app.color]}`}
          >
            <Icon size={40} stroke={1.5} />
          </div>
        )}
      </div>
      <p className="w-full truncate text-xs font-medium text-text">{app.name}</p>
    </a>
  );
}
