/** Site-wide constants: the public address, the code repository and the author's public links. */

export const SITE_NAME = "Energy Desk";
export const SITE_DESCRIPTION =
  "European gas, LNG and power, and global oil, from free official data.";
/** Production address, used for absolute URLs (sitemap, Open Graph). */
export const SITE_URL = "https://energy-desk-two.vercel.app";
export const REPO_URL = "https://github.com/CorentinSTK/energy-desk";
export const ADR_URL = `${REPO_URL}/tree/main/docs/adr`;

export const AUTHOR = {
  name: "Corentin Stucki",
  email: "Corentin.stucki@essec.edu",
  linkedin: "https://www.linkedin.com/in/corentin-stucki-315679228/",
} as const;
