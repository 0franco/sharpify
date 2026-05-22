import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const version = requireEnv("RELEASE_VERSION");
const repoOwner = requireEnv("GITHUB_REPOSITORY_OWNER");
const sourceRepo = requireEnv("GITHUB_REPOSITORY");
const tapRepo = process.env.HOMEBREW_TAP_REPO || `${repoOwner}/homebrew-sharpify`;
const tapToken = requireEnv("HOMEBREW_TAP_TOKEN");
const arm64Sha = requireEnv("ARM64_SHA256");
const x64Sha = requireEnv("X64_SHA256");
const productName = process.env.PRODUCT_NAME || "Sharpify";
const caskName = process.env.CASK_NAME || "sharpify";
const description =
  process.env.APP_DESCRIPTION ||
  "Minimalist desktop image compression app powered by sharp";
const homepage =
  process.env.APP_HOMEPAGE || `https://github.com/${sourceRepo}`;

const caskContents = `cask "${caskName}" do
  arch arm: "arm64", intel: "x64"

  version "${version}"
  sha256 arm: "${arm64Sha}", intel: "${x64Sha}"

  url "https://github.com/${sourceRepo}/releases/download/v#{version}/${productName}_#{version}_macos_#{arch}.zip",
      verified: "github.com/${sourceRepo}/"
  name "${productName}"
  desc "${description}"
  homepage "${homepage}"

  app "${productName}.app"
end
`;

const checkoutDir = join(
  tmpdir(),
  `homebrew-tap-${Date.now()}-${Math.random().toString(16).slice(2)}`
);

execFileSync(
  "git",
  [
    "clone",
    `https://x-access-token:${tapToken}@github.com/${tapRepo}.git`,
    checkoutDir
  ],
  { stdio: "inherit" }
);

mkdirSync(join(checkoutDir, "Casks"), { recursive: true });

const caskPath = join(checkoutDir, "Casks", `${caskName}.rb`);
const existingContents =
  (() => {
    try {
      return readFileSync(caskPath, "utf8");
    } catch {
      return null;
    }
  })();

writeFileSync(caskPath, caskContents);

if (existingContents === caskContents) {
  rmSync(checkoutDir, { force: true, recursive: true });
  console.log("Homebrew cask already up to date.");
  process.exit(0);
}

execFileSync("git", ["config", "user.name", "github-actions[bot]"], {
  cwd: checkoutDir
});
execFileSync(
  "git",
  ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"],
  { cwd: checkoutDir }
);
execFileSync("git", ["add", "Casks"], { cwd: checkoutDir, stdio: "inherit" });
execFileSync(
  "git",
  ["commit", "-m", `sharpify ${version}`],
  { cwd: checkoutDir, stdio: "inherit" }
);
execFileSync("git", ["push", "origin", "HEAD"], {
  cwd: checkoutDir,
  stdio: "inherit"
});

rmSync(checkoutDir, { force: true, recursive: true });
