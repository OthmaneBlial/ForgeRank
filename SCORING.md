# Scoring and ranking

The public `/methodology` page is the reader-facing explanation. This document records the engineering contract.

## Repository score v1

| Dimension   | Maximum | Core inputs                                                         |
| ----------- | ------: | ------------------------------------------------------------------- |
| Impact      |      25 | Log-normalized stars, forks, available longevity                    |
| Momentum    |      20 | Absolute growth, relative growth, acceleration                      |
| Health      |      20 | Commit freshness, active weeks, deterministic file-presence signals |
| Community   |      15 | Non-bot Git-author depth and distribution                           |
| Engineering |      10 | Sustained activity and deterministic infrastructure signals         |
| Trust       |      10 | Evidence confidence minus cautious anomaly/fork/archive penalties   |

The dimension sum is multiplied by the observation confidence factor: 1.00, 0.92, 0.75, or 0.50. This means incomplete evidence cannot outrank complete evidence as if both were equally certain. Constants live in `src/domain/scoring/repository-score.ts`; every stored result includes `repository-v1`.

Every calculation also produces exactly one structured reason for each dimension. A reason records its dimension, a `POSITIVE`, `NEUTRAL`, `CAUTION`, or `MISSING` status, a concise summary, and the raw observed inputs used in that explanation. The current repository projection and latest repository snapshot persist these reasons together with the score version. Repository pages display the reasons, confidence multiplier, snapshot time, and dimension values; older snapshots created before this contract retain an empty reason list rather than receiving reconstructed explanations.

File-presence signals describe whether expected repository structures were observed. They never claim that code is correct, secure, or high quality. Git-author metrics likewise remain separate from public account identity.

## Trending v1

Trending combines log-normalized absolute observed growth, relative growth against the starting baseline, and acceleration across the observation window. It requires at least two points to calculate any change and uses the requested window length to determine confidence. Counter decreases return no trend score and create a reviewable anomaly signal.

## Discovery v1

Discovery modes are separate deterministic rankings, not aliases for star count:

- **Trending:** 65% observed momentum, 20% bounded Git activity, 15% logarithmic popularity.
- **Rising:** 55% relative growth, 15% positive acceleration, 30% Git activity.
- **Breakout:** requires four observations across at least six days, positive and accelerating growth, and meaningful engineering activity.
- **Most Improved:** requires at least two retained scored snapshots and ranks positive ForgeRank change with current bounded activity and observed momentum.
- **Hidden Gems:** 30% health, 30% momentum, 20% engineering, 10% community, and 10% lower visibility. Candidates require 50–25,000 stars and at least three observations.
- **Established:** requires an established/mature lifecycle, then combines ForgeRank and current activity.
- **Most Active:** ranks bounded active weeks, commits, and author breadth without using stars.
- **Cooling Giants:** requires an established/mature project with at least 10,000 observed stars, four observations across the requested window, and star velocity at least 20% slower in the second half. Wording remains neutral and does not predict abandonment.

Counter decreases are withheld as anomalies. Missing observation history produces an explicit empty state rather than a popularity fallback.

## Ranking scope

Ranks are computed only across scored repositories in the local ForgeRank index. Stable ties fall back to canonical full name. Ranking snapshots store the scope, period, score, rank, timestamp, and version.

## Repository events v1

Repository timelines are derived read models over retained evidence and carry repository-events-v1; they are not a second acquisition source. The first retained repository snapshot emits only a ForgeRank tracking-start event and never backfills milestones the repository had already reached.

- Observed-star milestones at 1,000, 5,000, 10,000, 50,000, 100,000, and 1,000,000 require consecutive clean snapshots crossing the threshold.
- Top 100, Top 50, and Top 10 events require consecutive completed global ranking runs with the same ranking version crossing the boundary.
- Momentum-increase events require a gain of at least four points between clean snapshots calculated with the same score version.
- Resumed-activity events reuse the lifecycle contract: a measured quiet interval of at least 180 days, at least 4/12 active weeks, and a latest commit no more than 30 days old.
- Dormancy events require a transition from non-dormant evidence to a latest known commit at least 365 days old.
- New-tag events require an increased bounded Git tag count; tags are not automatically labeled releases.

Event timestamps are ForgeRank observation, analysis, or completed-calculation times. Exact external crossing times are never interpolated between retained records.

## Developer score v1 contract

Developer scores use Impact 25, Consistency 20, Collaboration 20, Project Quality 15, Breadth 10, and Trust 10. A profile must first be confirmed from a public user profile page. Owned-project signals include only already indexed repositories whose public metadata explicitly marks them as non-forks. Git author names are never silently linked to public accounts.

Each developer score stores its dimension breakdown, score version, calculation time, and source provenance. Collaboration counts explicitly owned projects whose bounded 90-day Git analysis observes more than one privacy-safe Git author; this describes the project environment, not personal commit ownership. Activity consistency likewise uses owned-project coverage. Missing collaboration or cross-repository history earns no points and caps confidence. One confirmed project is therefore low-confidence evidence even when the public profile and repository metadata are both high confidence.

Developer leaderboard categories preserve those evidence boundaries. Overall, Impact, Consistency, Collaboration, and Builders use the versioned total or persisted dimension directly. Maintainers is `(Consistency / 20 × 55) + (Project Quality / 15 × 45)` and requires known owned-project activity. Rising requires a positive total-score change against a real snapshot at least 30 days earlier. Most Active sums bounded Git commits across indexed owned projects for the selected 30- or 90-day window; it is never labeled as the developer's personal commit count. Veterans ranks the age of the oldest observed owned original project, not public-account age. Missing category evidence excludes a profile rather than substituting stars, profile popularity, or inferred identity.
