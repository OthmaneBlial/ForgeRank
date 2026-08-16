import { ArrowRight, BarChart3, BookOpenCheck, Database, Radar, ScanSearch } from "lucide-react";
import Link from "next/link";

import { getHomeReadModel } from "@/application/read-model";
import { MomentumMatrix } from "@/components/data/momentum-matrix";
import { RepositoryCard } from "@/components/data/repository-card";
import { InsufficientData } from "@/components/data/empty-state";
import { HomeSearch } from "@/components/home/home-search";
import { formatCompactNumber } from "@/domain/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const model = await getHomeReadModel();
  const matrixRepositories = [...model.trending, ...model.leaders].filter(
    (repository, index, all) =>
      all.findIndex((candidate) => candidate.id === repository.id) === index,
  );

  return (
    <>
      <section className="home-hero shell">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span className="live-pip" /> Open-source intelligence / Index 001
          </div>
          <h1>
            Discover what matters
            <br />
            in <em>open source.</em>
          </h1>
          <p>
            Rankings, momentum, growth and engineering activity across repositories and developers —
            built from public signals, never a GitHub API.
          </p>
          <HomeSearch />
          <div className="hero-links">
            <Link href="/trending">
              Trending today <ArrowRight size={14} />
            </Link>
            <Link href="/discover">
              Find hidden gems <ArrowRight size={14} />
            </Link>
            <Link href="/compare">
              Compare projects <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        <div className="hero-observatory" aria-label="ForgeRank index status">
          <div className="observatory-head">
            <span>Index observatory</span>
            <span>{model.availability === "READY" ? "LIVE" : "WARMING"}</span>
          </div>
          <div className="observatory-core">
            <div className="orbit orbit-a" />
            <div className="orbit orbit-b" />
            <div className="orbit orbit-c" />
            <div className="observatory-score">
              <strong>{formatCompactNumber(model.coverage.indexed)}</strong>
              <span>
                repositories
                <br />
                observed
              </span>
            </div>
          </div>
          <div className="observatory-foot">
            <span>
              <i /> Public HTML
            </span>
            <span>
              <i /> Git history
            </span>
            <span>
              <i /> Own snapshots
            </span>
          </div>
        </div>
      </section>

      <div className="trust-ribbon">
        <div className="shell trust-grid">
          <div>
            <Database size={16} />
            <span>Indexed universe</span>
            <strong>{formatCompactNumber(model.coverage.total)} repositories</strong>
          </div>
          <div>
            <Radar size={16} />
            <span>Historical signal</span>
            <strong>
              {model.trending.some((repository) => repository.sevenDayGrowth !== null)
                ? "Available"
                : "Accumulating"}
            </strong>
          </div>
          <div>
            <BookOpenCheck size={16} />
            <span>Methodology</span>
            <strong>Versioned & public</strong>
          </div>
          <div>
            <ScanSearch size={16} />
            <span>GitHub API usage</span>
            <strong>Zero</strong>
          </div>
        </div>
      </div>

      <section className="page-section shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Signal / right now</p>
            <h2>Trending now</h2>
            <p>
              Projects moving fastest across ForgeRank&apos;s indexed universe, balanced for reach,
              relative growth, and confidence.
            </p>
          </div>
          <Link className="section-link" href="/trending">
            Open trend desk <ArrowRight size={13} />
          </Link>
        </div>
        {model.trending.length > 0 ? (
          <div className="repository-grid">
            {model.trending.slice(0, 8).map((repository, index) => (
              <RepositoryCard key={repository.id} repository={repository} index={index} />
            ))}
          </div>
        ) : (
          <InsufficientData
            title={
              model.availability === "UNINITIALIZED"
                ? "The index is not initialized."
                : "Momentum is still accumulating."
            }
            detail={
              model.availability === "UNINITIALIZED"
                ? "ForgeRank cannot read its repository store yet. Existing public pages remain independent from data acquisition."
                : "Repositories are seeded by identifier only; trends appear after real public observations have been stored."
            }
          />
        )}
      </section>

      <section className="page-section matrix-section">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Signature view / momentum matrix</p>
              <h2>The shape of attention</h2>
              <p>
                Popularity answers who is known. Momentum answers who is changing the conversation.
              </p>
            </div>
            <Link className="section-link" href="/insights">
              Explore the matrix <ArrowRight size={13} />
            </Link>
          </div>
          <MomentumMatrix repositories={matrixRepositories} />
          {matrixRepositories.filter((repository) => repository.momentum !== null).length < 3 && (
            <InsufficientData detail="The matrix requires at least three repositories with comparable historical momentum observations." />
          )}
        </div>
      </section>

      <section className="page-section shell split-intelligence">
        <div>
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">High confidence / durable</p>
              <h2>Established leaders</h2>
            </div>
            <BarChart3 size={21} />
          </div>
          {model.leaders.length > 0 ? (
            <div className="stack-list">
              {model.leaders.slice(0, 5).map((repository, index) => (
                <RepositoryCard
                  variant="compact"
                  key={repository.id}
                  repository={repository}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <InsufficientData
              action={false}
              detail="Leader rankings begin after observed metadata has been scored."
            />
          )}
        </div>
        <div>
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Lower visibility / strong signal</p>
              <h2>Hidden gems</h2>
            </div>
            <ScanSearch size={21} />
          </div>
          {model.hiddenGems.length > 0 ? (
            <div className="stack-list">
              {model.hiddenGems.slice(0, 5).map((repository, index) => (
                <RepositoryCard
                  variant="compact"
                  key={repository.id}
                  repository={repository}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <InsufficientData
              action={false}
              detail="Hidden Gems requires health, momentum, engineering, and visibility signals—not star count alone."
            />
          )}
        </div>
      </section>

      <section className="page-section shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Intake / recently discovered</p>
            <h2>Entering the forge</h2>
            <p>
              Real repository identifiers waiting for, or recently receiving, their first
              conservative enrichment pass.
            </p>
          </div>
          <Link className="section-link" href="/index">
            Add a repository <ArrowRight size={13} />
          </Link>
        </div>
        {model.recentlyDiscovered.length > 0 ? (
          <div className="recent-strip">
            {model.recentlyDiscovered.map((repository) => (
              <Link key={repository.id} href={`/r/${repository.fullName}`}>
                <span className="language-dot" />
                <strong>{repository.fullName}</strong>
                <small>{repository.observedAt ? "observed" : "queued for observation"}</small>
              </Link>
            ))}
          </div>
        ) : (
          <InsufficientData
            title="No repository identifiers have been seeded."
            detail="A fresh ForgeRank installation starts from version-controlled repository identifiers, then enriches them through the real ingestion pipeline."
          />
        )}
      </section>
    </>
  );
}
