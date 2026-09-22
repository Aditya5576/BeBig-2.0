import packageJson from '../../package.json';

export interface AppVersionInfo {
  /** Semver version from package.json (e.g. '1.0.0') */
  version: string;
  /** Short 7-character Git commit SHA or 'dev' fallback */
  commitSha: string;
  /** Formatted display version string (e.g. 'v1.0.0 · abc1234' or 'v1.0.0 · dev') */
  displayVersion: string;
  /** Indicates if a production commit SHA was resolved */
  isProductionBuild: boolean;
}

export function getAppVersionInfo(): AppVersionInfo {
  const rawVersion = (packageJson && packageJson.version) ? packageJson.version : '1.0.0';

  const rawSha =
    process.env.EXPO_PUBLIC_GIT_SHA ||
    process.env.EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    '';

  const trimmedSha = rawSha.trim();
  const isProductionBuild = trimmedSha.length > 0;
  const commitSha = isProductionBuild ? trimmedSha.slice(0, 7) : 'dev';
  const displayVersion = `v${rawVersion} · ${commitSha}`;

  return {
    version: rawVersion,
    commitSha,
    displayVersion,
    isProductionBuild,
  };
}

export const appVersionInfo = getAppVersionInfo();
