#!/usr/bin/env node
/**
 * Creates a Vercel project for a new app in the icefrosst portfolio.
 *
 * What it does:
 *   1. Calls the Vercel API to create a project linked to a GitHub repo
 *   2. Sets the production branch to `stable` (per the three-branch convention)
 *   3. Injects the shared Supabase env vars (read from session env, not hardcoded)
 *   4. Prints the expected URLs once Vercel finishes the first deploy
 *
 * Prerequisites:
 *   - GitHub repo IceFrosst/<repo> must already exist
 *   - Vercel GitHub App must have access to it (use "All repositories")
 *   - The following env vars must be set (all available in Claude Code sessions):
 *     VERCEL_TOKEN, VERCEL_TEAM_ID,
 *     NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Usage:
 *   node scripts/setup-vercel-project.mjs --repo focus-gate-personal-app --name icefrosst-focus-gate-personal-app
 *
 * Optional flags:
 *   --prod-branch <branch>   Production branch name (default: stable)
 *   --github-owner <owner>   GitHub owner (default: IceFrosst)
 */

import { parseArgs } from "node:util";

const VERCEL_API = "https://api.vercel.com";

const token = process.env.VERCEL_TOKEN;
const teamId = process.env.VERCEL_TEAM_ID;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!token || !teamId) {
  console.error("Missing VERCEL_TOKEN or VERCEL_TEAM_ID.");
  process.exit(1);
}
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const STANDARD_ENV_VARS = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", value: supabaseUrl },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: supabaseAnonKey },
];

const { values: args } = parseArgs({
  options: {
    repo: { type: "string" },
    name: { type: "string" },
    "prod-branch": { type: "string", default: "stable" },
    "github-owner": { type: "string", default: "IceFrosst" },
  },
});

if (!args.repo || !args.name) {
  console.error("Usage: --repo <github-repo> --name <vercel-project-name>");
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

console.log(`\nDone. Expected URLs once Vercel finishes the first build:`);
console.log(`  stable (production): https://${args.name}.vercel.app`);
console.log(`  main:                https://${args.name}-git-main-icefrosst.vercel.app`);
console.log(`  previous:            https://${args.name}-git-previous-icefrosst.vercel.app`);
console.log(`\nAdd GEMINI_API_KEY manually in the Vercel project dashboard if the app uses AI.`);
