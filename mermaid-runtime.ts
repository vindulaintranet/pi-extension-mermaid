import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON_PATH = join(PACKAGE_ROOT, "package.json");
const RUNTIME_DEPENDENCIES = ["beautiful-mermaid", "@resvg/resvg-js"] as const;

type RuntimeDependency = (typeof RUNTIME_DEPENDENCIES)[number];

type RuntimeStatus = {
  ready: boolean;
  attemptedInstall: boolean;
  missing: RuntimeDependency[];
  message?: string;
};

type RuntimeModules = {
  Resvg: typeof import("@resvg/resvg-js").Resvg;
  THEMES: typeof import("beautiful-mermaid").THEMES;
  renderMermaidASCII: typeof import("beautiful-mermaid").renderMermaidASCII;
  renderMermaidSVG: typeof import("beautiful-mermaid").renderMermaidSVG;
};

let cachedStatus: RuntimeStatus | undefined;
let cachedModules: RuntimeModules | undefined;
let pendingInitialization: Promise<RuntimeStatus> | undefined;

export async function ensureMermaidRuntimeDependencies(): Promise<RuntimeStatus> {
  if (cachedStatus) return cachedStatus;
  if (pendingInitialization) return pendingInitialization;

  pendingInitialization = initializeRuntimeDependencies();
  try {
    cachedStatus = await pendingInitialization;
    return cachedStatus;
  } finally {
    pendingInitialization = undefined;
  }
}

export function getMermaidRuntimeModules(): RuntimeModules {
  if (!cachedModules) {
    throw new Error("Mermaid runtime is not initialized yet; load the extension or await ensureMermaidRuntimeDependencies() first");
  }
  return cachedModules;
}

export function getMermaidRuntimeStatusMessage(status: RuntimeStatus): string | undefined {
  if (status.ready) return undefined;
  return status.message ?? defaultFailureMessage(status.missing);
}

async function initializeRuntimeDependencies(): Promise<RuntimeStatus> {
  try {
    cachedModules = await importRuntimeModules();
    return { ready: true, attemptedInstall: false, missing: [] };
  } catch {
    const specs = getDependencySpecs(RUNTIME_DEPENDENCIES);
    if (!specs.ok) {
      return {
        ready: false,
        attemptedInstall: false,
        missing: [...RUNTIME_DEPENDENCIES],
        message: specs.message,
      };
    }

    const result = spawnSync(getNpmCommand(), [
      "install",
      "--no-save",
      "--package-lock=false",
      ...specs.specs,
    ], {
      cwd: PACKAGE_ROOT,
      encoding: "utf8",
    });

    try {
      cachedModules = await importRuntimeModules();
      return { ready: true, attemptedInstall: true, missing: [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ready: false,
        attemptedInstall: true,
        missing: [...RUNTIME_DEPENDENCIES],
        message: formatInstallFailure(result.stderr, result.stdout, message),
      };
    }
  }
}

async function importRuntimeModules(): Promise<RuntimeModules> {
  const [resvg, mermaid] = await Promise.all([
    import("@resvg/resvg-js"),
    import("beautiful-mermaid"),
  ]);

  return {
    Resvg: resvg.Resvg,
    THEMES: mermaid.THEMES,
    renderMermaidASCII: mermaid.renderMermaidASCII,
    renderMermaidSVG: mermaid.renderMermaidSVG,
  };
}

function getDependencySpecs(
  dependencies: readonly RuntimeDependency[],
): { ok: true; specs: string[] } | { ok: false; message: string } {
  if (!existsSync(PACKAGE_JSON_PATH)) {
    return {
      ok: false,
      message: `missing package.json near Mermaid extension; install these dependencies manually: ${dependencies.join(", ")}`,
    };
  }

  try {
    const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const specs = dependencies.map((dependency) => {
      const version = packageJson.dependencies?.[dependency];
      if (!version) {
        throw new Error(`dependency ${dependency} is not declared in package.json`);
      }
      return `${dependency}@${version}`;
    });
    return { ok: true, specs };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message: `failed to resolve Mermaid runtime dependency versions: ${message}`,
    };
  }
}

function formatInstallFailure(
  stderr: string | undefined,
  stdout: string | undefined,
  importError: string,
): string {
  const output = `${stderr ?? ""}\n${stdout ?? ""}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-6)
    .join(" | ");

  if (!output) {
    return `${defaultFailureMessage(RUNTIME_DEPENDENCIES)} — ${importError}`;
  }

  return `${defaultFailureMessage(RUNTIME_DEPENDENCIES)} — ${importError} | ${output}`;
}

function defaultFailureMessage(missing: readonly RuntimeDependency[]): string {
  return `failed to install Mermaid runtime dependencies (${missing.join(", ")}); run npm install in the extension directory and /reload`;
}

function getNpmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}
