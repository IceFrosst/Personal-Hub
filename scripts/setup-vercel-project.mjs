#!/usr/bin/env node
/**
 * Creates a Vercel project for a new app in the icefrosst portfolio.
 *
 * What it does:
 *   1. Calls the Vercel API to create a project linked to a GitHub repo
 *   2. Sets the production branch to `stable` (per the three-branch convention)
 *   3. Pastes the standard Supabase env vars (NEXT_PUBLIC_SUPABASE_URL + anon key)
 *      onto all targets (production, preview, development)
 *   4. Prints the URLs you should see once Vercel finishes the first deploy
 *
 * Prerequisites:
 *   - GitHub repo IceFrosst/<repo> must already exist
 *   - Vercel GitHub App must have access to it (use "All repositories")
 *   - VERCEL_TOKEN and VERCEL_TEAM_ID env vars set in the running shell
 *     (in cloud sessions: set these in the Claude Code env vars panel)
 *
 * Usage:
 *   npm run setup-vercel -- --repo workout --name icefrosst-workout
 *   # or
 *   node scripts/setup-vercel-project.mjs --repo workout --name icefrosst-workout
 *
 * Optional flags:
 *   --prod-branch <branch>   Production branch name (default: stable)
 *   --github-owner <owner>   GitHub owner (default: IceFrosst)
 */

import { parseArgs } from "node:util";

const VERCEL_API = "https://api.vercel.com";

// Same Supabase project for every app in the portfolio (iron rule #3).
// Anon key is public-by-design (RLS gates every query); safe to commit.
const STANDARD_ENV_VARS = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    value: "https://qcsyihymmaktkbqfxlkl.supabase.co",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    value:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjc3lpaHltbWFrdGticWZ4bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTI0MTAsImV4cCI6MjA5NTM2ODQxMH0.VbFjbjtPjhD36NE9Fhi4Sgcb8WbE8DU7AsLtTQs6J-8",
  },
];

const token = process.env.VERCEL_TOKEN;
const teamId = process.env.VERCEL_TEAM_ID;

if (!token || !teamId) {
  console.error(
    "Missing env vars. Set VERCEL_TOKEN and VERCEL_TEAM_ID before running.",
  );
  console.error("  - Token: https://vercel.com/account/tokens");
  console.error("  - Team ID: https://vercel.com/account → 'Your ID'");
  process.exit(1);
}

const { values: args } = parseArgs({
  options: {
    repo: { type: "string" },
    name: { type: "string" },
    "prod-branch": { type: "string", default: "stable" },
    "github-owner": { type: "string", default: "IceFrosst" },
  },
});

if (!args.repo || !args.name) {
  console.error(
    "Usage: --repo <github-repo> --name <vercel-project-name> [--prod-branch <branch>]",
  );
  process.exit(1);
}

const queryParams = `?teamId=${encodeURIComponent(teamId)}`;

async function vercel(path, init = {}) {
  const res = await fetch(`${VERCEL_API}${path}${queryParams}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel ${init.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }
  return res.json();
}

const repoFullName = `${args["github-owner"]}/${args.repo}`;
console.log(`Creating Vercel project '${args.name}' for ${repoFullName}…`);

const project = await vercel("/v10/projects", {
  method: "POST",
  body: JSON.stringify({
    name: args.name,
    framework: "nextjs",
    gitRepository: {
      type: "github",
      repo: repoFullName,
      productionBranch: args["prod-branch"],
    },
  }),
});

console.log(`  ✓ Project ID: ${project.id}`);

for (const envVar of STANDARD_ENV_VARS) {
  await vercel(`/v10/projects/${project.id}/env`, {
    method: "POST",
    body: JSON.stringify({
      key: envVar.key,
      value: envVar.value,
      type: "plain",
      target: ["production", "preview", "development"],
    }),
  });
  console.log(`  ✓ Env var: ${envVar.key}`);
}

console.log("\nDone. Expected URLs once Vercel finishes the first build:");
console.log(`  Production (${args["prod-branch"]} branch):`);
console.log(`    https://${args.name}.vercel.app`);
console.log(`  Preview (main branch):`);
console.log(`    https://${args.name}-git-main-<team-slug>.vercel.app`);
console.log(`  Preview (previous branch):`);
console.log(`    https://${args.name}-git-previous-<team-slug>.vercel.app`);
console.log(
  "\nReplace <team-slug> with your Vercel team slug (visible in the dashboard).",
);
console.log(
  "Confirm the exact URLs from Vercel after the first deploy and paste them into hub/config/apps.json.",
);
