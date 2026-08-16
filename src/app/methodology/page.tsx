import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpenCheck,
  CircleGauge,
  Scale,
  ShieldCheck,
} from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { README_ANALYSIS_LIMITS, README_ANALYSIS_VERSION } from "@/domain/readme-analysis";
import { REPOSITORY_EVENT_THRESHOLDS, REPOSITORY_EVENT_VERSION } from "@/domain/repository-events";
import {
  REPOSITORY_SIMILARITY_MINIMUM_SCORE,
  REPOSITORY_SIMILARITY_VERSION,
  REPOSITORY_SIMILARITY_WEIGHTS,
} from "@/domain/similarity";
import {
  REPOSITORY_SIGNAL_THRESHOLDS,
  REPOSITORY_SIGNAL_VERSION,
} from "@/domain/repository-signals";
import { MATURITY_THRESHOLDS } from "@/domain/scoring/maturity";
import {
  REPOSITORY_QUALITY_SIGNAL_VERSION,
  TECHNOLOGY_DETECTION_VERSION,
} from "@/domain/technology/analyze-tree";

const repositoryDimensions = [
  [
    "Impact",
    25,
    "Observed reach, adoption proxies, and long-term survival using logarithmic normalization.",
  ],
  [
    "Momentum",
    20,
    "Relative and absolute observed growth, plus acceleration when comparable windows exist.",
  ],
  ["Health", 20, "Commit freshness, active weeks, and deterministic repository-quality signals."],
  ["Community", 15, "Git-author depth and contribution distribution, with bot activity separated."],
  [
    "Engineering",
    10,
    "Sustained activity and detected maintenance infrastructure—not raw commit volume as quality.",
  ],
  ["Trust", 10, "Observation confidence, source quality, and cautious anomaly penalties."],
] as const;

export default function MethodologyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Methodology / versioned & inspectable"
        title="Every rank needs a reason"
        description="ForgeRank separates observation from inference, reduces scores when evidence is incomplete, and versions every formula that can change interpretation."
      />
      <article className="shell prose-layout">
        <aside className="prose-nav">
          <a href="#repository-score">Repository score</a>
          <a href="#trending">Trending</a>
          <a href="#hidden-gems">Hidden Gems</a>
          <a href="#similarity">Similarity</a>
          <a href="#project-signals">Project signals</a>
          <a href="#repository-structures">Repository structures</a>
          <a href="#readme-structure">README structure</a>
          <a href="#historical-events">Historical events</a>
          <a href="#confidence">Confidence</a>
          <a href="#maturity">Maturity</a>
          <a href="#developers">Developer score</a>
          <a href="#scope">Ranking scope</a>
        </aside>
        <div className="prose-content">
          <section className="method-intro">
            <BookOpenCheck size={27} />
            <p>
              Repository Score v1 is a weighted, confidence-adjusted composite. Missing evidence
              contributes nothing; it is never replaced with an industry average or reconstructed
              history.
            </p>
          </section>
          <section id="repository-score">
            <p className="eyebrow">Repository score / repository-v1</p>
            <h2>Six dimensions, one explained total</h2>
            <div className="formula-display">
              ForgeRank = (I<sub>25</sub> + M<sub>20</sub> + H<sub>20</sub> + C<sub>15</sub> + E
              <sub>10</sub> + T<sub>10</sub>) × confidence
            </div>
            <div className="method-dimensions">
              {repositoryDimensions.map(([name, max, detail]) => (
                <div key={name}>
                  <strong>{name}</strong>
                  <span>{max} pts</span>
                  <p>{detail}</p>
                </div>
              ))}
            </div>
            <p>
              Stars and forks use logarithmic transforms so a ten-year-old giant cannot win by raw
              accumulation alone. Age can support survival evidence, but it is not a score
              multiplier.
            </p>
          </section>
          <section id="trending">
            <p className="eyebrow">Discovery signals / discovery-v1</p>
            <h2>Velocity, not a stars sort</h2>
            <div className="method-flow">
              <div>
                <ArrowUp />
                <strong>Absolute growth</strong>
                <span>Observed count change</span>
              </div>
              <div>
                <Activity />
                <strong>Relative growth</strong>
                <span>Change against baseline</span>
              </div>
              <div>
                <CircleGauge />
                <strong>Acceleration</strong>
                <span>Velocity changing over time</span>
              </div>
              <div>
                <ShieldCheck />
                <strong>Confidence</strong>
                <span>Observation count and span</span>
              </div>
            </div>
            <p>
              Trending weights observed momentum 65%, Git-derived activity 20%, and logarithmically
              normalized popularity 15%. Rising weights relative growth 55%, positive acceleration
              15%, and activity 30%. Breakout requires at least four observations across six days,
              increasing velocity, positive growth, and meaningful engineering activity. Most Active
              uses bounded Git activity rather than stars. Established requires a measured
              established or mature lifecycle. Most Improved requires positive change across at
              least two retained scored snapshots. Cooling Giants requires established impact plus
              four observations and at least 20% lower star velocity in the second half of the
              requested window; it never predicts abandonment. Counter decreases are withheld as
              anomalies.
            </p>
          </section>
          <section id="hidden-gems">
            <p className="eyebrow">Hidden Gems / discovery-v1</p>
            <h2>Strong evidence below the visibility ceiling</h2>
            <div className="formula-display">
              Gem = Health<sub>30%</sub> + Momentum<sub>30%</sub> + Engineering<sub>20%</sub> +
              Community<sub>10%</sub> + Low visibility<sub>10%</sub>
            </div>
            <p>
              Candidates need 50–25,000 observed stars, at least three comparable snapshots,
              positive observed growth, normalized health of at least 60/100, and normalized
              engineering evidence of at least 45/100. Extremely new repositories are excluded until
              that evidence exists; current star count alone can never qualify a project.
            </p>
          </section>
          <section id="similarity">
            <p className="eyebrow">Similarity / {REPOSITORY_SIMILARITY_VERSION}</p>
            <h2>Related means shared observed evidence</h2>
            <p>
              Similarity allocates {REPOSITORY_SIMILARITY_WEIGHTS.language} points to the same
              primary language, {REPOSITORY_SIMILARITY_WEIGHTS.topics} to topic-set overlap,{" "}
              {REPOSITORY_SIMILARITY_WEIGHTS.technologies} to detected-technology overlap,{" "}
              {REPOSITORY_SIMILARITY_WEIGHTS.descriptionKeywords} to bounded description-keyword
              overlap, {REPOSITORY_SIMILARITY_WEIGHTS.collections} to curated-collection overlap,
              and {REPOSITORY_SIMILARITY_WEIGHTS.maturity} to a shared known lifecycle. Missing
              fields earn zero rather than redistributing their weight. Matches below{" "}
              {REPOSITORY_SIMILARITY_MINIMUM_SCORE} are not published, and the result is not an AI
              semantic judgment.
            </p>
          </section>
          <section id="project-signals">
            <p className="eyebrow">Human-readable evidence / {REPOSITORY_SIGNAL_VERSION}</p>
            <h2>Signals use public deterministic thresholds</h2>
            <div className="method-dimensions">
              <div>
                <strong>Maintained</strong>
                <span>≥{REPOSITORY_SIGNAL_THRESHOLDS.maintainedActiveWeeks12}/12 active weeks</span>
                <p>
                  Also requires the latest bounded Git commit to be no more than{" "}
                  {REPOSITORY_SIGNAL_THRESHOLDS.maintainedMaximumCommitAgeDays} days old.
                </p>
              </div>
              <div>
                <strong>Distributed authorship</strong>
                <span>≥{REPOSITORY_SIGNAL_THRESHOLDS.distributedMinimumAuthors90d} authors</span>
                <p>
                  The top non-bot Git author must account for no more than{" "}
                  {Math.round(REPOSITORY_SIGNAL_THRESHOLDS.distributedMaximumTopAuthorShare * 100)}%
                  of observed 90-day commits.
                </p>
              </div>
              <div>
                <strong>Contributor concentration</strong>
                <span>
                  ≥{Math.round(REPOSITORY_SIGNAL_THRESHOLDS.concentratedTopAuthorShare * 100)}% top
                  share
                </span>
                <p>
                  This is explicitly a concentration estimate, not an exact bus factor, identity
                  link, or project-quality judgment.
                </p>
              </div>
              <div>
                <strong>Observed momentum</strong>
                <span>≥2 snapshots</span>
                <p>
                  The numeric score is shown only when multiple persisted ForgeRank observations
                  exist. No missing history is reconstructed.
                </p>
              </div>
              <div>
                <strong>Repository structures</strong>
                <span>File presence only</span>
                <p>
                  Supported community, automation, dependency, documentation, test, CI, and
                  container paths are counted without claiming correctness or security.
                </p>
              </div>
              <div>
                <strong>Lifecycle & tags</strong>
                <span>Observed context</span>
                <p>
                  Lifecycle reuses the versioned rules below. Visible Git tag counts are evidence,
                  but a count alone is never labeled release cadence.
                </p>
              </div>
            </div>
            <p>
              Missing rule inputs produce no card. Lower-activity wording stays neutral and never
              predicts abandonment or maintainer intent.
            </p>
          </section>
          <section id="repository-structures">
            <p className="eyebrow">
              Repository-file evidence / {REPOSITORY_QUALITY_SIGNAL_VERSION}
            </p>
            <h2>Presence is observable; quality is not inferred</h2>
            <div className="method-dimensions">
              <div>
                <strong>Project basics</strong>
                <span>README · license</span>
                <p>
                  Canonical filenames are matched case-insensitively anywhere in the bounded tree.
                </p>
              </div>
              <div>
                <strong>Community guidance</strong>
                <span>Contributing · conduct · security</span>
                <p>Recognized policy files indicate presence only, never compliance or safety.</p>
              </div>
              <div>
                <strong>Engineering structure</strong>
                <span>Tests · CI · Docker</span>
                <p>
                  Known paths and filenames are detected after generated and vendored trees are
                  excluded.
                </p>
              </div>
              <div>
                <strong>Release automation</strong>
                <span>Named workflows and release tools</span>
                <p>
                  Release/publish workflows, Changesets, release-please, semantic-release,
                  GoReleaser, and Cargo release configuration are explicit evidence.
                </p>
              </div>
              <div>
                <strong>Dependency management</strong>
                <span>Manifests and lockfiles</span>
                <p>
                  Node, Python, Rust, Go, JVM, Ruby, PHP, and Dart dependency files are recognized.
                </p>
              </div>
              <div>
                <strong>Dedicated documentation</strong>
                <span>Docs trees and site configs</span>
                <p>
                  A README alone does not satisfy this separate signal; docs paths or recognized
                  documentation configuration must exist.
                </p>
              </div>
            </div>
            <p>
              Technology evidence uses {TECHNOLOGY_DETECTION_VERSION}, a registry of pluggable
              detectors. It covers package.json, pyproject.toml, requirements.txt, Cargo.toml,
              go.mod, pom.xml, Gradle, Gemfile, composer.json, pubspec.yaml, Dockerfiles, and Docker
              Compose. Bounded manifest content can raise a specific framework signal, such as
              Flutter, but absent content is never guessed.
            </p>
          </section>
          <section id="readme-structure">
            <p className="eyebrow">README analysis / {README_ANALYSIS_VERSION}</p>
            <h2>Structure, never a subjective grade</h2>
            <p>
              Bounded Git inspection selects the shallowest canonical README path and records its
              blob size. Content is inspected only up to{" "}
              {Math.round(README_ANALYSIS_LIMITS.maximumContentBytes / 1024)} KiB; larger or
              unavailable blobs retain size evidence while structural fields stay unavailable.
            </p>
            <p>
              ForgeRank counts Markdown headings, recognized status badges, installation-oriented
              headings, and documentation links. At most{" "}
              {README_ANALYSIS_LIMITS.maximumExposedSections} sanitized section titles are shown.
              These signals describe documentation structure and never claim that documentation is
              complete, correct, or high quality.
            </p>
          </section>
          <section id="historical-events">
            <p className="eyebrow">Project timeline / {REPOSITORY_EVENT_VERSION}</p>
            <h2>Only retained crossings become events</h2>
            <div className="method-dimensions">
              <div>
                <strong>Observed stars</strong>
                <span>
                  {REPOSITORY_EVENT_THRESHOLDS.starMilestones
                    .map((threshold) => threshold.toLocaleString("en"))
                    .join(" · ")}
                </span>
                <p>
                  A milestone is emitted only when consecutive clean snapshots cross it. The first
                  observation never backfills earlier milestones.
                </p>
              </div>
              <div>
                <strong>Indexed rank</strong>
                <span>Top {REPOSITORY_EVENT_THRESHOLDS.rankMilestones.join(" · Top ")}</span>
                <p>
                  Comparable completed global ranking runs must cross the threshold using the same
                  ranking version.
                </p>
              </div>
              <div>
                <strong>Momentum</strong>
                <span>
                  +{REPOSITORY_EVENT_THRESHOLDS.momentumDimensionIncrease} dimension points
                </span>
                <p>
                  Consecutive clean scored snapshots must use the same score version. Raw star
                  movement is not relabeled momentum.
                </p>
              </div>
              <div>
                <strong>Resumed activity</strong>
                <span>≥{MATURITY_THRESHOLDS.revivalQuietDays}-day measured quiet interval</span>
                <p>
                  The latest analysis must also show at least{" "}
                  {MATURITY_THRESHOLDS.revivalMinimumActiveWeeks12}/12 active weeks and a commit no
                  more than {MATURITY_THRESHOLDS.revivalMaximumCommitAgeDays} days old.
                </p>
              </div>
              <div>
                <strong>Dormancy</strong>
                <span>≥{MATURITY_THRESHOLDS.dormantMinimumCommitAgeDays}-day commit age</span>
                <p>
                  An event requires a measured transition from non-dormant evidence. It describes
                  observed activity and never infers maintainer intent.
                </p>
              </div>
              <div>
                <strong>Git tags</strong>
                <span>Count increase between bounded analyses</span>
                <p>
                  ForgeRank reports newly observed tags. It does not automatically call every tag a
                  release.
                </p>
              </div>
            </div>
            <p>
              Timeline dates are ForgeRank observation or calculation timestamps. Exact external
              milestone times are never interpolated between observations.
            </p>
          </section>
          <section id="confidence">
            <p className="eyebrow">Confidence / evidence coverage</p>
            <h2>Precision is part of the metric</h2>
            <div className="confidence-table">
              <div>
                <strong>HIGH</strong>
                <span>Required observation window and core fields are present.</span>
                <b>1.00×</b>
              </div>
              <div>
                <strong>MEDIUM</strong>
                <span>Most evidence exists, with a meaningful gap disclosed.</span>
                <b>0.92×</b>
              </div>
              <div>
                <strong>LOW</strong>
                <span>A small number of observations support only a tentative signal.</span>
                <b>0.75×</b>
              </div>
              <div>
                <strong>INSUFFICIENT</strong>
                <span>The metric is not ranked as though it were complete.</span>
                <b>0.50×</b>
              </div>
            </div>
          </section>
          <section id="maturity">
            <p className="eyebrow">Lifecycle / deterministic rules</p>
            <h2>Projects change state</h2>
            <p>
              New means younger than 90 days. Emerging adds early activity and positive growth.
              Growing requires sustained active weeks and growth. Mature requires multiple years
              plus current activity. Dormant requires at least a year without meaningful Git
              activity. Revived requires a prior quiet period of at least 180 days followed by
              sustained renewed activity. When project age is unavailable, ForgeRank leaves ordinary
              lifecycle classification pending.
            </p>
            <div className="lifecycle">
              <span>New</span>
              <ArrowUp />
              <span>Emerging</span>
              <ArrowUp />
              <span>Growing</span>
              <ArrowUp />
              <span>Established</span>
              <ArrowDown />
              <span>Slowing</span>
            </div>
          </section>
          <section id="developers">
            <p className="eyebrow">Developer score / developer-v1</p>
            <h2>Contribution impact without people surveillance</h2>
            <p>
              The developer score allocates Impact 25, Consistency 20, Collaboration 20, Project
              Quality 15, Breadth 10, and Trust 10. It uses public profile fields and Git activity
              in already indexed repositories. Git authors are not silently treated as confirmed
              GitHub accounts, commit email addresses are never displayed, and the score does not
              claim personal worth or employability.
            </p>
            <p>
              Developer leaderboards never reuse one overall sort under different labels. Impact,
              Consistency, Collaboration, and Builders use their persisted dimensions. Maintainers
              combines normalized Consistency 55% and Project Quality 45%, and requires covered
              project activity. Rising requires a positive score change against a real snapshot at
              least 30 days earlier. Most Active sums bounded 30- or 90-day Git commits across owned
              projects and explicitly does not call them personal commits. Veterans uses the age of
              the oldest observed owned original project, not account age. A profile without the
              category&apos;s evidence is excluded rather than assigned a popularity proxy.
            </p>
          </section>
          <section id="scope">
            <p className="eyebrow">Ranking scope / non-exhaustive</p>
            <h2>The indexed universe is the denominator</h2>
            <div className="scope-warning">
              <Scale size={22} />
              <p>
                Rankings represent repositories currently indexed by ForgeRank and must not be
                interpreted as an exhaustive ranking of every GitHub repository.
              </p>
            </div>
            <p>
              Every ranking view exposes coverage and calculation time. No page claims “#1 on
              GitHub.” It says, for example, “#1 among 184 scored repositories indexed by
              ForgeRank.”
            </p>
          </section>
          <section>
            <p className="eyebrow">Interpretation limits</p>
            <h2>Signals are not verdicts</h2>
            <div className="scope-warning">
              <AlertTriangle size={22} />
              <p>
                Stars indicate attention, forks may indicate adoption or experimentation, and
                commits indicate activity. None of them independently proves code quality, security,
                or maintainer intent.
              </p>
            </div>
          </section>
        </div>
      </article>
    </>
  );
}
