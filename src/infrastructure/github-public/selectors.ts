export const GITHUB_REPOSITORY_PARSER_VERSION = "github-repository-parser-v2";
export const GITHUB_PROFILE_PARSER_VERSION = "github-profile-parser-v1";

export const repositorySelectors = {
  canonicalRepository: 'meta[name="octolytics-dimension-repository_nwo"]',
  isFork: 'meta[name="octolytics-dimension-repository_is_fork"]',
  description: ['meta[property="og:description"]', 'meta[name="description"]'],
  stars: [
    "#repo-stars-counter-star",
    'a[href$="/stargazers"] strong',
    'a[href$="/stargazers"] span.Counter',
  ],
  forks: ["#repo-network-counter", 'a[href$="/forks"] strong', 'a[href$="/forks"] span.Counter'],
  language: '[itemprop="programmingLanguage"]',
  licenseLinks: ['a[href$="/LICENSE"]', 'a[href$="/LICENSE.md"]', 'a[href$="/COPYING"]'],
  archivedNotice: '[data-testid="archive-label"], .flash-warn, .flash.flash-warn',
  forkNotice: 'a[data-hovercard-type="repository"]',
  defaultBranch: '[data-hotkey="w"] span[data-menu-button]',
} as const;

export const profileSelectors = {
  username: ['meta[name="octolytics-dimension-user_login"]', 'meta[property="profile:username"]'],
  userType: 'meta[name="octolytics-dimension-user_type"]',
  title: ['meta[property="og:title"]', "title"],
  description: ['meta[property="og:description"]', 'meta[name="description"]'],
  avatar: ['meta[property="og:image"]'],
  displayName: '[itemprop="name"]',
  bio: '[data-bio-text], [itemprop="description"]',
  location: '[itemprop="homeLocation"]',
} as const;
