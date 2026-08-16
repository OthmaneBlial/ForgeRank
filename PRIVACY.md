# Privacy

ForgeRank analyzes public open-source project activity, not private life or contactability.

It does not display commit email addresses, harvest phone numbers, build recruiting/marketing contact databases, infer private identities, or silently equate a Git author with a confirmed public account. Git-author display names may be aggregated for a repository's contribution structure; bot-like authors are separately classified and local identity keys are hashed.

Public developer profiles include only voluntarily public profile fields and evidence from repositories already indexed for project analysis. Owned portfolio entries require an explicit public non-fork signal. Developer-score confidence stays low when collaboration or activity history is incomplete. Git activity across owned projects is labeled as project evidence rather than personal contribution totals, and Git authors are never silently linked to a confirmed public account.

Operators must publish a correction/removal contact through `FORGERANK_CONTACT_URL` and review requests against recorded provenance. `pnpm forge developer-hide` removes a developer from public detail, search, list, and sitemap surfaces without deleting legitimate repository aggregates; `developer-show` restores it. `developer-correct` sets, hides, or reverts public display-name, biography, and location fields. Each operation requires a local audit reason and appends a timestamped event.
