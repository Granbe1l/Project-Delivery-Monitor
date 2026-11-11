import { keyFindings } from "./insights";
import { formatBrief, historyCoverage } from "./brief";
import { useEffect, useRef, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Database,
  GitBranch,
  GitPullRequest,
  LayoutDashboard,
  ListTodo,
  Menu,
  ShieldCheck,
  Signal,
  TriangleAlert,
} from "lucide-react";
import { age, api, timestamp } from "./api";
import type { Brief, Finding, Overview, Page, Project, Trends } from "./api";

const sections = [
  ["overview", "Overview", LayoutDashboard],
  ["details", "Project details", BookOpen],
  ["issues", "Issues & backlog", ListTodo],
  ["pulls", "Pull request review", GitPullRequest],
  ["ci", "CI/CD activity", Activity],
  ["risks", "Risks & recommendations", ShieldCheck],
] as const;
function Empty({
  title = "Data unavailable",
  detail = "No verified observations are available for this project yet.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="empty">
      <Database size={30} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
function ErrorBox({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="notice error" role="alert">
      <TriangleAlert size={20} />
      <div>
        <strong>We couldn’t load this view</strong>
        <p>{error.message}</p>
        <button onClick={retry}>Try again</button>
      </div>
    </div>
  );
}
function Loading() {
  return (
    <div className="skeleton" aria-label="Loading data" role="status">
      <div />
      <div />
      <div />
    </div>
  );
}
export function Evidence({
  url,
  children = "View evidence",
}: {
  url: string;
  children?: React.ReactNode;
}) {
  let safe = false;
  try {
    const u = new URL(url);
    safe =
      u.protocol === "https:" &&
      u.hostname === "github.com" &&
      !u.username &&
      !u.password &&
      !u.port;
  } catch {
    safe = false;
  }
  return safe ? (
    <a
      className="evidence"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ArrowUpRight size={14} />
    </a>
  ) : (
    <span>Evidence unavailable</span>
  );
}
export function Metric({
  label,
  value,
  help,
}: {
  label: string;
  value: number | string | null | undefined;
  help: string;
}) {
  return (
    <article className="metric">
      <div>
        {label}
        <span role="img" title={help} tabIndex={0} aria-label={help}>
          <CircleHelp size={14} />
        </span>
      </div>
      <strong>{value ?? "—"}</strong>
      <small className={value == null ? "unavailable-label" : undefined}>
        {value == null ? "Data unavailable" : "Items analyzed"}
      </small>
    </article>
  );
}
function Badge({ value }: { value: string }) {
  return (
    <span
      className={`badge ${value === "complete" || value === "success" ? "good" : value === "partial" || value === "stale" ? "amber" : ""}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
function PageNumbers({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Array.from(
    { length: Math.max(1, total) },
    (_, i) => i + 1,
  ).filter((n) => n === 1 || n === total || Math.abs(n - page) <= 1);
  return (
    <span className="page-numbers">
      {pages.map((n, i) => (
        <span key={n}>
          {i > 0 && n - pages[i - 1] > 1 && <span className="page-gap">…</span>}
          <button
            aria-label={`Go to page ${n}`}
            aria-current={n === page ? "page" : undefined}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        </span>
      ))}
    </span>
  );
}

function FindingCard({
  finding,
  grouped = false,
}: {
  finding: Finding;
  grouped?: boolean;
}) {
  return (
    <article className="finding">
      <div className="finding-top">
        <Badge value={finding.severity} />
      </div>
      <h3>{finding.observation}</h3>

      {!grouped && (
        <div className="action">
          <ArrowRight size={16} />
          <span>{finding.recommendation}</span>
        </div>
      )}
      <div className="finding-foot">
        <Evidence url={finding.evidence_url} />
      </div>
      <details>
        <summary>Why this finding · rule & interpretation</summary>
        <small>
          {finding.rule_id} · v{finding.rule_version} ·{" "}
          {timestamp(finding.observed_at)}
        </small>
        <p>{finding.explanation}</p>
        <p>{finding.limitations}</p>
      </details>
    </article>
  );
}

export default function App() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const section = sections.find(([path]) => location.pathname === `/${path}`);
  const [menu, setMenu] = useState(false);
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menu) return;
    const mobile = matchMedia("(max-width: 700px)").matches;
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const links =
      navigation.current?.querySelectorAll<HTMLElement>("a, button");
    links?.[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
      if (e.key === "Tab" && links?.length) {
        if (e.shiftKey && document.activeElement === links[0]) {
          e.preventDefault();
          links[links.length - 1].focus();
        } else if (
          !e.shiftKey &&
          document.activeElement === links[links.length - 1]
        ) {
          e.preventDefault();
          links[0].focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [menu]);
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/projects"),
  });
  const selected =
    projects.data?.find((p) => String(p.id) === params.get("project")) ??
    projects.data?.[0];
  const info = useQuery({
    queryKey: ["overview", selected?.id],
    queryFn: () => api<Overview>(`/projects/${selected!.id}/overview`),
    enabled: !!selected,
  });
  const suffix = selected ? `?project=${selected.id}` : "";
  return (
    <div className={`app view-${section?.[0] ?? "overview"}`}>
      <a href="#content" className="skip">
        Skip to content
      </a>
      {menu && (
        <button
          className="drawer-backdrop"
          aria-label="Close navigation overlay"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        ref={navigation}
        id="sidebar"
        className={menu ? "sidebar open" : "sidebar"}
      >
        <button className="drawer-close" onClick={() => setMenu(false)}>
          Close navigation
        </button>
        <a className="brand" href="/overview">
          <span className="brand-mark">
            <GitBranch size={25} />
          </span>
          <span>
            DELIVERY<span className="brand-sub">MONITOR</span>
          </span>
        </a>
        <div className="workspace-label">
          WORKSPACE <span>PUBLIC</span>
        </div>
        <nav aria-label="Main navigation">
          {sections.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={`/${path}${suffix}`}
              onClick={() => setMenu(false)}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <Signal size={19} />
          <h3>Evidence before assumptions.</h3>
          <p>Public development activity, explained with transparent rules.</p>
          <span>READ-ONLY OBSERVATORY</span>
        </div>
        <div className="sidebar-footer">
          <span className="dot" />
          GitHub REST API · Stored observations
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMenu(!menu)}
            aria-label="Toggle navigation"
            aria-expanded={menu}
            aria-controls="sidebar"
          >
            <Menu />
          </button>
          <span className="breadcrumb">
            Workspace <ChevronRight size={13} />{" "}
            <strong>Public repositories</strong>
          </span>
          <div className="read-only">
            <ShieldCheck size={15} /> Read-only access
          </div>
        </header>
        <main id="content">
          <div className="page-heading">
            <div className="eyebrow">SOFTWARE DELIVERY OBSERVATORY</div>
            <h1>
              {section?.[0] === "overview"
                ? "Project Delivery Monitor"
                : (section?.[1] ?? "Project Delivery Monitor")}
            </h1>
            <p>
              {section?.[0] === "overview"
                ? "Understand software work, decide what to review, and check the evidence."
                : "Collected GitHub activity, with transparent scope and original evidence."}
            </p>
          </div>
          <div className="project-toolbar">
            <label htmlFor="project">
              Monitoring{" "}
              <select
                id="project"
                value={selected?.id ?? ""}
                onChange={(e) => setParams({ project: e.target.value })}
                disabled={!projects.data?.length}
              >
                {projects.data?.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </label>
            <div className="last-sync">
              <Clock3 size={16} />
              <span>
                Data last checked{" "}
                <strong>{timestamp(info.data?.observed_at)}</strong>
              </span>
            </div>
          </div>
          {projects.isPending ? (
            <Loading />
          ) : projects.error ? (
            <ErrorBox
              error={projects.error}
              retry={() => void projects.refetch()}
            />
          ) : !selected ? (
            <Empty
              title="No projects configured"
              detail="The operator has not initialized the monitored public repositories yet."
            />
          ) : info.isPending ? (
            <Loading />
          ) : info.error ? (
            <ErrorBox error={info.error} retry={() => void info.refetch()} />
          ) : (
            info.data && (
              <>
                {(info.data.stale ||
                  info.data.last_attempt_status === "failure" ||
                  Object.values(info.data.coverage).some(
                    (c) => c.retained,
                  )) && (
                  <div className="notice">
                    <TriangleAlert size={19} />
                    <p>
                      {info.data.stale ? "This observation is stale. " : ""}
                      {Object.values(info.data.coverage).some((c) => c.retained)
                        ? "Some sources could not refresh; their last successful observations are shown. "
                        : ""}
                      {info.data.last_attempt_status === "failure"
                        ? "The latest sync could not complete. "
                        : ""}
                      {info.data.observed_at
                        ? "Previously collected data is retained; the current repository state may differ."
                        : "No verified data has been collected."}
                    </p>
                  </div>
                )}
                <Routes>
                  <Route
                    path="/overview"
                    element={<OverviewPage info={info.data} suffix={suffix} />}
                  />
                  <Route
                    path="/details"
                    element={<Details key={selected.id} info={info.data} />}
                  />
                  <Route
                    path="/issues"
                    element={
                      <Records
                        key={`i${selected.id}`}
                        info={info.data}
                        kind="issues"
                      />
                    }
                  />
                  <Route
                    path="/pulls"
                    element={
                      <Records
                        key={`p${selected.id}`}
                        info={info.data}
                        kind="pulls"
                      />
                    }
                  />
                  <Route
                    path="/ci"
                    element={
                      <Records
                        key={`c${selected.id}`}
                        info={info.data}
                        kind="ci"
                      />
                    }
                  />
                  <Route
                    path="/risks"
                    element={<Risks key={selected.id} info={info.data} />}
                  />
                  <Route
                    path="*"
                    element={<Navigate to={`/overview${suffix}`} replace />}
                  />
                </Routes>
              </>
            )
          )}
          <footer className="footer">
            <span>Built on public evidence. Designed for informed review.</span>
            <span>Activity indicators ≠ overall project quality</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Distribution({
  values,
  vertical = false,
}: {
  values: Record<string, number> | null | undefined;
  vertical?: boolean;
}) {
  if (!values)
    return <Empty detail="Distribution requires collected source data." />;
  const total = Object.values(values).reduce((a, b) => a + b, 0);
  return (
    <div
      className={vertical ? "distribution vertical-chart" : "distribution"}
      aria-label="Distribution of collected records"
    >
      {Object.entries(values).map(([label, count]) => (
        <div className="distribution-row" key={label}>
          <div>
            <span>{label.replaceAll("_", " ")}</span>
            <strong>{count}</strong>
          </div>
          <div className="bar-track" aria-hidden="true">
            <div
              style={
                vertical
                  ? {
                      height: `${Math.max(...Object.values(values)) ? (count / Math.max(...Object.values(values))) * 100 : 0}%`,
                    }
                  : { width: `${total ? (count / total) * 100 : 0}%` }
              }
            />
          </div>
        </div>
      ))}
      <p className="scope">
        {total} collected records · shares of this observation only
      </p>
    </div>
  );
}

function OverviewPage({ info, suffix }: { info: Overview; suffix: string }) {
  const findings = useQuery({
    queryKey: ["findings", info.project.id],
    queryFn: () => api<Finding[]>(`/projects/${info.project.id}/findings`),
  });
  const m = info.metrics;
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Delivery at a glance</h2>
          <p>A starting point for review, grounded in collected activity.</p>
        </div>
        <Badge
          value={
            info.status === "unavailable"
              ? "awaiting data"
              : Object.values(info.coverage).some((c) => c.retained)
                ? "retained data"
                : Object.values(info.coverage).some(
                      (c) => c.coverage !== "complete",
                    )
                  ? "partial coverage"
                  : info.stale
                    ? "stale"
                    : "observed"
          }
        />
      </div>
      <details className="executive-insight key-findings">
        <summary>Key insight & suggested review</summary>
        <span className="eyebrow">EXECUTIVE INSIGHT · CURRENT OBSERVATION</span>
        {keyFindings(info)
          .slice(0, 1)
          .map((f) => (
            <article key={f.source}>
              <h2>{f.title}</h2>
              <p>{f.meaning}</p>
              <div className="executive-action">
                <strong>Review next</strong>
                <span>{f.action}</span>
                <NavLink className="evidence" to={`/${f.source}${suffix}`}>
                  Inspect evidence <ArrowRight size={14} />
                </NavLink>
              </div>
              <small>{f.sample}</small>
            </article>
          ))}
        {!keyFindings(info).length && (
          <p>Insufficient data for a quantitative conclusion.</p>
        )}
      </details>
      <div className="metrics">
        <Metric
          label="Open issues"
          value={m?.open_issues}
          help="An issue tracks a report or request. Pull requests are excluded."
        />
        <Metric
          label="Open PRs"
          value={m?.open_prs}
          help="A pull request proposes a code change. Drafts are included in open PRs. Counts cover collected records."
        />
        <Metric
          label="Needs review"
          value={m?.prs_needing_attention}
          help={`Non-draft PRs older than ${info.policy.pr_age_days} days or not updated for ${info.policy.pr_idle_days} days.`}
        />
        <Metric
          label="Failed / completed checks"
          value={
            m?.ci_failures == null
              ? null
              : `${m.ci_failures} / ${m.ci_completed}`
          }
          help={`CI means automated checks. Denominator: ${m?.ci_completed ?? "unavailable"} completed default-branch runs in the collected 30-day window.`}
        />
      </div>
      <details className="compact-scope">
        <summary>Items analyzed · scope & definitions</summary>
        <p>{info.scope}</p>
      </details>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">REVIEW QUEUE</span>
              <h2>What needs attention</h2>
            </div>
            <NavLink to={`/risks${suffix}`}>
              View all <ArrowRight size={16} />
            </NavLink>
          </div>
          {findings.isPending ? (
            <Loading />
          ) : findings.error ? (
            <ErrorBox
              error={findings.error}
              retry={() => void findings.refetch()}
            />
          ) : !m ? (
            <Empty detail="Once GitHub data is collected, evidence-backed observations will appear here. No scores or estimates are substituted." />
          ) : findings.data?.length ? (
            <div className="findings-list">
              {findings.data.slice(0, 3).map((f, i) => (
                <article className="finding preview-item" key={i}>
                  <div>
                    <h3>
                      {f.subject_type === "pull_request" ||
                      f.rule_id === "pr_age"
                        ? "PR"
                        : f.subject_type}{" "}
                      #{f.observation.match(/#(\d+)/)?.[1] ?? f.subject_id}
                    </h3>
                    <p>{f.observation}</p>
                  </div>
                  <Evidence url={f.evidence_url}>Evidence</Evidence>
                  <details>
                    <summary>Review details</summary>
                    <p>{f.explanation}</p>
                    <p>{f.recommendation}</p>
                    <p>{f.limitations}</p>
                  </details>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="No findings in this observation"
              detail="No configured rule matched the collected records. This does not establish overall project health."
            />
          )}
        </section>
        <section className="panel">
          <span className="eyebrow">COLLECTED OPEN ISSUES</span>
          <h2>Issue age distribution</h2>
          <p>Age at observation, not time overdue.</p>
          <Distribution values={m?.issue_age_bins} vertical />
          <details>
            <summary>How to use these signals</summary>
            <p>
              Check coverage and timestamps, then review the original GitHub
              evidence before acting. No quality score or deadline is inferred.
            </p>
          </details>
        </section>
      </div>
      <CoveragePanel info={info} />
    </>
  );
}
function CoveragePanel({ info }: { info: Overview }) {
  return (
    <details className="panel coverage-panel">
      <summary>Data Quality · coverage & methodology</summary>
      <div>
        <h2>Data Quality</h2>
        <p>Partial coverage means some items may be missing.</p>
        <details>
          <summary>Scope & methodology</summary>
          <p>
            Each source has its own timestamp. Partial counts describe items
            analyzed, not the full repository. Retained data was not refreshed
            successfully. Activity alone does not establish delivery
            performance.
          </p>
        </details>
      </div>
      <details className="source-quality">
        <summary>Source coverage & check times</summary>
        <div className="coverage-grid">
          {[
            ["issues", "Issues"],
            ["pulls", "Pull requests"],
            ["workflows", "Workflow runs"],
            ["milestones", "Milestones"],
          ].map(([key, label]) => (
            <div key={key}>
              <span>{label}</span>
              <Badge
                value={
                  info.coverage[key]?.retained
                    ? "retained · refresh failed"
                    : (info.coverage[key]?.coverage ?? "unavailable")
                }
              />
              <small>{timestamp(info.coverage[key]?.observed_at)}</small>
            </div>
          ))}
        </div>
      </details>
    </details>
  );
}
async function collectedPages(path: string): Promise<Page> {
  const first = await api<Page>(`${path}?page_size=100&page=1`);
  const items = [...first.items];
  for (let page = 2; (page - 1) * 100 < first.total_in_observation; page++) {
    const next = await api<Page>(`${path}?page_size=100&page=${page}`);
    if (
      next.observed_at !== first.observed_at ||
      next.total_in_observation !== first.total_in_observation
    )
      throw new Error("Observation changed while loading. Please retry.");
    items.push(...next.items);
  }
  return { ...first, items };
}
function Details({ info }: { info: Overview }) {
  const [milestonePage, setMilestonePage] = useState(1);
  const [milestoneSearch, setMilestoneSearch] = useState("");
  const [milestoneState, setMilestoneState] = useState("all");
  const [historyPage, setHistoryPage] = useState(1);
  const trends = useQuery({
    queryKey: ["trends", info.project.id],
    queryFn: () => api<Trends>(`/projects/${info.project.id}/trends`),
  });
  const milestoneSource = useQuery({
    queryKey: ["milestones", info.project.id],
    queryFn: () => collectedPages(`/projects/${info.project.id}/milestones`),
  });
  const matchingMilestones =
    milestoneSource.data?.items.filter(
      (m) =>
        (m.title ?? "").toLowerCase().includes(milestoneSearch.toLowerCase()) &&
        (milestoneState === "all" || m.state === milestoneState),
    ) ?? [];
  const milestones = {
    ...milestoneSource,
    data: milestoneSource.data
      ? {
          ...milestoneSource.data,
          items: matchingMilestones.slice(
            (milestonePage - 1) * 10,
            milestonePage * 10,
          ),
          page_size: 10,
          total_in_observation: matchingMilestones.length,
        }
      : undefined,
  };
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Project details</h2>
          <p>Provenance, observed history, and tracked milestones.</p>
        </div>
        {info.project.html_url && (
          <Evidence url={info.project.html_url}>Open repository</Evidence>
        )}
      </div>
      <div className="metrics detail-summary">
        <Metric
          label="Sources available"
          value={
            Object.keys(info.coverage).length
              ? Object.entries(info.coverage).filter(
                  ([key, c]) =>
                    key !== "repository" && c.coverage !== "unavailable",
                ).length
              : null
          }
          help="Issue, pull request, workflow and milestone sources with stored observations."
        />
        <Metric
          label="Saved observations"
          value={trends.data?.points.length}
          help="Snapshots available in the history response; not necessarily comparable."
        />
        <Metric
          label="Milestones analyzed"
          value={
            milestoneSource.data?.coverage === "unavailable"
              ? null
              : milestoneSource.data?.total_in_observation
          }
          help="All milestones in the stored observation, before your filters."
        />
      </div>
      <details className="page-insight">
        <summary>Analysis & review guidance</summary>
        <strong>
          {info.observed_at
            ? "Source coverage determines which comparisons are meaningful."
            : "No source observation is available yet."}
        </strong>
        <details>
          <summary>How to review this project</summary>
          <p>
            Check source coverage before comparing snapshots; different samples
            can change counts without a real change in activity.
          </p>
        </details>
      </details>
      <div className="panel details-grid">
        <div>
          <small>REPOSITORY</small>
          <h3>{info.project.full_name}</h3>
        </div>
        <div>
          <small>DEFAULT BRANCH</small>
          <h3>{info.project.default_branch ?? "Not yet verified"}</h3>
        </div>
        <div>
          <small>LAST COMPLETE SYNC</small>
          <p>{timestamp(info.last_successful_sync_at)}</p>
        </div>
        <div>
          <small>LAST ATTEMPT</small>
          <p>
            {timestamp(info.last_attempt_at)} ·{" "}
            {info.last_attempt_status ?? "None"}
          </p>
        </div>
      </div>
      <CoveragePanel info={info} />
      <section className="panel">
        <div className="panel-heading">
          <h2>Observation history</h2>
          <Clock3 size={19} />
        </div>
        {trends.isPending ? (
          <Loading />
        ) : trends.error ? (
          <ErrorBox error={trends.error} retry={() => void trends.refetch()} />
        ) : trends.data?.status !== "available" ? (
          <Empty
            title="Not enough history yet"
            detail="Historical tracking begins after multiple successful syncs. Partial observations remain labeled as partial."
          />
        ) : (
          <>
            <div
              className="table-wrap"
              role="region"
              aria-label="Observation history table"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Observed at</th>
                    <th>Open issues</th>
                    <th>Open PRs</th>
                    <th>Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.data.points
                    .slice((historyPage - 1) * 5, historyPage * 5)
                    .map((p) => (
                      <tr key={p.observed_at}>
                        <td>{timestamp(p.observed_at)}</td>
                        <td>{p.metrics.open_issues ?? "Unavailable"}</td>
                        <td>{p.metrics.open_prs ?? "Unavailable"}</td>
                        <td>{historyCoverage(p.coverage)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="scope">
              Different collection scopes can change counts without a real
              change in activity. Compare snapshots only when their coverage
              matches. {trends.data.limitation}
            </p>
            <div className="pagination">
              <span>
                History page {historyPage} · {trends.data.points.length}{" "}
                observations
              </span>
              <div>
                <button
                  disabled={historyPage === 1}
                  onClick={() => setHistoryPage(historyPage - 1)}
                >
                  Previous observations
                </button>
                <PageNumbers
                  page={historyPage}
                  total={Math.ceil(trends.data.points.length / 5)}
                  onChange={setHistoryPage}
                />
                <button
                  disabled={historyPage * 5 >= trends.data.points.length}
                  onClick={() => setHistoryPage(historyPage + 1)}
                >
                  Next observations
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Milestones</h2>
          <span
            title="A milestone groups tracked issues and PRs; completion is not overall project progress."
            tabIndex={0}
          >
            <CircleHelp size={17} />
          </span>
        </div>
        <div className="filters milestone-filters">
          <label>
            Search milestones
            <input
              type="search"
              value={milestoneSearch}
              onChange={(e) => {
                setMilestoneSearch(e.target.value);
                setMilestonePage(1);
              }}
            />
          </label>
          <label>
            Milestone state
            <select
              value={milestoneState}
              onChange={(e) => {
                setMilestoneState(e.target.value);
                setMilestonePage(1);
              }}
            >
              <option value="all">All states</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </label>
        </div>
        {milestones.isPending ? (
          <Loading />
        ) : milestones.error ? (
          <ErrorBox
            error={milestones.error}
            retry={() => void milestones.refetch()}
          />
        ) : milestones.data?.items.length ? (
          <>
            {milestones.data.items.map((m) => (
              <div className="milestone" key={m.github_id}>
                <div>
                  <h3>{m.title}</h3>
                  <p>
                    {m.due_on ? `Due ${timestamp(m.due_on)}` : "No due date"} ·{" "}
                    {m.state}
                  </p>
                </div>
                <div>
                  <strong>
                    {m.closed_issues} /{" "}
                    {(m.closed_issues ?? 0) + (m.open_issues ?? 0)}
                  </strong>
                  <small> tracked milestone items closed</small>
                </div>
                <Evidence url={m.html_url} />
              </div>
            ))}
            <p className="scope">
              Showing {milestones.data.items.length} of{" "}
              {milestones.data.total_in_observation} collected milestones.{" "}
              {milestones.data.coverage} source coverage.
            </p>
            <div className="pagination">
              <span>
                Page {milestonePage} · observed{" "}
                {timestamp(milestones.data.observed_at)}
              </span>
              <div>
                <button
                  aria-label="Previous milestone page"
                  disabled={milestonePage === 1}
                  onClick={() => setMilestonePage(milestonePage - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <PageNumbers
                  page={milestonePage}
                  total={Math.ceil(milestones.data.total_in_observation / 10)}
                  onChange={setMilestonePage}
                />
                <button
                  aria-label="Next milestone page"
                  disabled={
                    milestonePage * milestones.data.page_size >=
                    milestones.data.total_in_observation
                  }
                  onClick={() => setMilestonePage(milestonePage + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            title={
              milestones.data?.coverage === "unavailable"
                ? "Milestones unavailable"
                : "No milestones in this observation"
            }
          />
        )}
      </section>
    </>
  );
}
function PageInsight({ info, source }: { info: Overview; source: string }) {
  const finding = keyFindings(info).find((f) => f.source === source);
  return (
    <details className="page-insight">
      <summary>Analysis & review guidance</summary>
      <strong>
        {finding?.title ?? "Insufficient data for a quantitative summary."}
      </strong>
      {finding && (
        <details>
          <summary>Meaning & suggested review</summary>
          <p>{finding.meaning}</p>
          <p>{finding.action}</p>
          <small>{finding.sample}</small>
        </details>
      )}
    </details>
  );
}
function Records({
  info,
  kind,
}: {
  info: Overview;
  kind: "issues" | "pulls" | "ci";
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState("");
  const [branch, setBranch] = useState("");
  const path = kind === "pulls" ? "pull-requests" : kind;
  const query = new URLSearchParams({
    q,
    page: String(page),
    page_size: "10",
    ...(period ? { period } : {}),
    ...(branch ? { branch } : {}),
  });
  const rows = useQuery({
    queryKey: [kind, info.project.id, q, page, period, branch],
    queryFn: () => api<Page>(`/projects/${info.project.id}/${path}?${query}`),
  });
  const pullSummary = useQuery({
    queryKey: ["pull-summary", info.project.id],
    queryFn: () => collectedPages(`/projects/${info.project.id}/pull-requests`),
    enabled: kind === "pulls",
  });
  const title =
    kind === "issues"
      ? "Issues & backlog"
      : kind === "pulls"
        ? "Pull request review"
        : "CI/CD activity";
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>
            {kind === "ci"
              ? "Workflow results describe automated checks, not production availability."
              : kind === "pulls"
                ? "Open PRs include drafts. Attention excludes drafts and uses age or inactivity thresholds; it does not mean overdue."
                : "Open issue observations. A “bug” label is a report, not a verified defect."}
          </p>
        </div>
      </div>
      {kind === "pulls" && (
        <div className="metrics pr-metrics">
          <Metric
            label="Open PRs"
            value={info.metrics?.open_prs}
            help="Open proposed changes in collected records."
          />
          <Metric
            label="Draft PRs"
            value={
              pullSummary.data && pullSummary.data.coverage !== "unavailable"
                ? pullSummary.data.items.filter((r) => r.draft).length
                : null
            }
            help="Drafts in collected records; excluded from attention rules."
          />
          <Metric
            label="Needs review"
            value={info.metrics?.prs_needing_attention}
            help="Configured age or inactivity threshold; does not mean overdue."
          />
        </div>
      )}
      <PageInsight info={info} source={kind} />
      {kind === "issues" && info.metrics?.issue_age_bins && (
        <div className="age-bins">
          {Object.entries(info.metrics.issue_age_bins).map(([bin, count]) => (
            <div key={bin}>
              <span>{bin}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      )}
      {kind === "ci" && info.metrics?.ci_conclusions && (
        <div className="panel ci-summary">
          <div className="metrics">
            <Metric
              label="Completed checks"
              value={info.metrics.ci_completed}
              help="Collected default-branch runs in the 30-day window."
            />
            <Metric
              label="Failed checks"
              value={info.metrics.ci_failures}
              help="Failures among those completed checks; not production incidents."
            />
            <Metric
              label="Skipped checks"
              value={info.metrics.ci_conclusions.skipped ?? 0}
              help="Checks with the skipped conclusion in this same window; not successes or failures."
            />
            <Metric
              label="Success share"
              value={
                info.metrics.ci_completed
                  ? `${Math.round(((info.metrics.ci_conclusions.success ?? 0) / info.metrics.ci_completed) * 100)}%`
                  : null
              }
              help="Successful divided by completed collected default-branch runs. Unavailable with no completed runs."
            />
          </div>
          <h3>Completed default-branch runs · 30-day collected window</h3>
          <Distribution values={info.metrics.ci_conclusions} />
          <p className="scope">
            Zero failures means none found in this scope, not none ever. Success
            share divides successful checks by {info.metrics.ci_completed}{" "}
            completed runs. In-progress runs are excluded. Categories are not
            combined into success or failure.
          </p>
        </div>
      )}
      <section className="panel">
        <div className="filters">
          <label>
            Search {kind === "ci" ? "workflows" : "titles"}
            <input
              type="search"
              placeholder="Search collected records…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Created within
            <select
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPage(1);
              }}
            >
              <option value="">
                {kind === "ci" ? "30 days" : "All collected dates"}
              </option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </label>
          {kind === "ci" && (
            <label>
              Branch
              <input
                placeholder="All branches"
                value={branch}
                onChange={(e) => {
                  setBranch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
          )}
        </div>
        {rows.isPending ? (
          <Loading />
        ) : rows.error ? (
          <ErrorBox error={rows.error} retry={() => void rows.refetch()} />
        ) : (
          rows.data && (
            <>
              <div className="results-meta">
                <span>
                  {rows.data.coverage === "unavailable"
                    ? "Records unavailable"
                    : `${rows.data.total_in_observation} matching collected records`}
                </span>
                <Badge value={rows.data.coverage} />
              </div>
              {!rows.data.items.length ? (
                <Empty
                  title={
                    rows.data.coverage === "unavailable"
                      ? "Data unavailable"
                      : q || period || branch
                        ? "No matching records"
                        : "No records in this observation"
                  }
                  detail={
                    rows.data.coverage === "unavailable"
                      ? "The source has not been collected successfully. Counts are unknown."
                      : "Try changing your filters. This view only includes the collected scope."
                  }
                />
              ) : (
                <div
                  className="table-wrap"
                  role="region"
                  aria-label={`${title} records`}
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>{kind === "ci" ? "Workflow" : "Title / source"}</th>
                        <th>{kind === "ci" ? "Branch / event" : "State"}</th>
                        <th>
                          {kind === "ci"
                            ? "Status / conclusion"
                            : "Age at observation"}
                        </th>
                        <th>
                          {kind === "pulls" ? "Since last update" : "Evidence"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.data.items.map((r) => (
                        <tr key={r.github_id}>
                          <td data-label="Title / source">
                            {(r.title ?? r.name ?? "").length > 90 ? (
                              <details className="record-title">
                                <summary>
                                  {(r.title ?? r.name ?? "").slice(0, 87)}…
                                </summary>
                                <strong>{r.title ?? r.name}</strong>
                              </details>
                            ) : (
                              <strong>{r.title ?? r.name}</strong>
                            )}
                            <small>
                              {r.number ? `#${r.number}` : `Run ${r.github_id}`}
                            </small>
                            {!!r.labels?.length && (
                              <details className="record-metadata">
                                <summary>
                                  {r.labels.length} GitHub labels
                                </summary>
                                <p>{r.labels.map((l) => l.name).join(", ")}</p>
                              </details>
                            )}
                          </td>
                          <td data-label="State / branch">
                            {kind === "ci" ? (
                              <>
                                {r.branch ?? "Unknown branch"}
                                <small>{r.event}</small>
                              </>
                            ) : (
                              <Badge
                                value={
                                  r.draft ? "draft" : (r.state ?? "unknown")
                                }
                              />
                            )}
                          </td>
                          <td data-label="Age / result">
                            {kind === "ci" ? (
                              <>
                                <Badge value={r.status ?? "unknown"} />
                                <small>
                                  {r.conclusion ?? "No conclusion yet"}
                                </small>
                              </>
                            ) : (
                              `${age(r.created_at, rows.data!.observed_at)} days`
                            )}
                          </td>
                          <td data-label="Evidence / last update">
                            {kind === "pulls" && (
                              <small>
                                {age(r.updated_at, rows.data!.observed_at)} days
                                · not review time
                              </small>
                            )}
                            <Evidence url={r.html_url} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="pagination">
                <span>
                  Page {page} · observed {timestamp(rows.data.observed_at)}
                </span>
                <div>
                  <button
                    aria-label="Previous page"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <PageNumbers
                    page={page}
                    total={Math.ceil(
                      rows.data.total_in_observation / rows.data.page_size,
                    )}
                    onChange={setPage}
                  />
                  <button
                    aria-label="Next page"
                    disabled={
                      page * rows.data.page_size >=
                      rows.data.total_in_observation
                    }
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )
        )}
      </section>
    </>
  );
}
function Risks({ info }: { info: Overview }) {
  const brief = useQuery({
    queryKey: ["brief", info.project.id],
    queryFn: () => api<Brief>(`/projects/${info.project.id}/brief`),
  });
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("source");
  const [expanded, setExpanded] = useState(false);
  const [findingPage, setFindingPage] = useState(1);
  const matching = (brief.data?.findings ?? [])
    .filter(
      (f) =>
        (filter === "all" || f.rule_id === filter) &&
        `${f.observation} ${f.explanation} ${f.recommendation}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "type"
        ? a.rule_id.localeCompare(b.rule_id)
        : sort === "recent"
          ? b.observed_at.localeCompare(a.observed_at)
          : 0,
    );
  const visible = expanded
    ? matching.slice((findingPage - 1) * 10, findingPage * 10)
    : matching.slice(0, 3);
  function download() {
    if (!brief.data) return;
    const content = formatBrief(brief.data);
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivery-brief-${info.project.full_name.replace("/", "-")}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Risks & recommendations</h2>
          <p>
            Transparent observations. Practical next steps. Original evidence.
          </p>
        </div>
        {info.metrics && brief.data && (
          <button className="primary-button" onClick={download}>
            <ArrowDownToLine size={16} />
            Export brief (.txt)
          </button>
        )}
      </div>
      {brief.data && (
        <div className="metrics findings-summary">
          <Metric
            label="Total findings"
            value={brief.data.findings.length}
            help="Configured rules matched in this observation. Not a project risk score."
          />
          {Array.from(new Set(brief.data.findings.map((f) => f.severity))).map(
            (severity) => (
              <Metric
                key={severity}
                label={severity.replaceAll("_", " ")}
                value={
                  brief.data!.findings.filter((f) => f.severity === severity)
                    .length
                }
                help="Severity assigned by the existing deterministic rule."
              />
            ),
          )}
        </div>
      )}
      <details className="page-insight">
        <summary>Analysis & review guidance</summary>
        <strong>
          {brief.data
            ? `${brief.data.findings.length} rule-based findings are available for review; they are not confirmed business risks.`
            : "Findings require a verified observation."}
        </strong>
        <details>
          <summary>How to prioritize review</summary>
          <p>
            Filter by the existing rule type, inspect the source, and confirm
            ownership or the next action. Attention is a review signal; no new
            High/Medium/Low scale is inferred.
          </p>
        </details>
      </details>
      <div className="brief-intro">
        <div>
          <span className="eyebrow">PROJECT INTELLIGENCE BRIEF</span>
          <h2>What to review next</h2>
          <p>
            Attention means a rule suggests checking an item, not a confirmed
            serious problem. Thresholds do not rank project quality.
          </p>
        </div>
        <label>
          Finding type
          <select
            aria-label="Finding type"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setFindingPage(1);
            }}
          >
            <option value="all">All findings</option>
            <option value="pr_age">Pull request age</option>
            <option value="ci_repeated_failure">CI failures</option>
            <option value="milestone_due">Milestones</option>
            <option value="freshness">Data freshness</option>
          </select>
        </label>
      </div>
      <div className="filters">
        <label>
          Search findings
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setFindingPage(1);
            }}
            placeholder="Search observations or actions…"
          />
        </label>
        <label>
          Sort findings
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setFindingPage(1);
            }}
          >
            <option value="source">Rule order</option>
            <option value="type">Finding type</option>
            <option value="recent">Latest observation</option>
          </select>
        </label>
        <button
          onClick={() => {
            setExpanded(!expanded);
            setFindingPage(1);
          }}
        >
          {expanded ? "Show top 3" : `Browse all ${matching.length} findings`}
        </button>
      </div>
      <p className="scope">
        {matching.length} matching findings ·{" "}
        {expanded ? "10 per page" : "First 3 in selected order"}. Rule order is
        not a ranking of project risk.
      </p>
      {brief.isPending ? (
        <Loading />
      ) : brief.error ? (
        <ErrorBox error={brief.error} retry={() => void brief.refetch()} />
      ) : (
        <>
          {!info.metrics ? (
            <section className="panel">
              <Empty detail="Recommendations require verified source data. No risk status has been assigned." />
            </section>
          ) : matching.length ? (
            <div className="risk-grid">
              {Array.from(
                new Set(visible.map((f) => `${f.rule_id}|${f.recommendation}`)),
              ).map((key) => {
                const related = visible.filter(
                  (f) => `${f.rule_id}|${f.recommendation}` === key,
                );
                const count = matching.filter(
                  (f) => `${f.rule_id}|${f.recommendation}` === key,
                ).length;
                return (
                  <section className="rule-group" key={key}>
                    <header>
                      <h3>{related[0].rule_id.replaceAll("_", " ")}</h3>
                      <Badge value={`${count} matching items`} />
                    </header>
                    <p className="group-action">
                      <strong>Suggested review: </strong>
                      {related[0].recommendation}
                    </p>
                    <details open>
                      <summary>
                        Related evidence · {related.length} items on this page
                      </summary>
                      {related.map((f, i) => (
                        <FindingCard
                          finding={f}
                          grouped
                          key={`${f.subject_id}-${i}`}
                        />
                      ))}
                    </details>
                  </section>
                );
              })}
              {expanded && (
                <div className="pagination">
                  <span>
                    Page {findingPage} of{" "}
                    {Math.max(1, Math.ceil(matching.length / 10))}
                  </span>
                  <div>
                    <button
                      disabled={findingPage === 1}
                      onClick={() => setFindingPage(findingPage - 1)}
                    >
                      Previous findings
                    </button>
                    <PageNumbers
                      page={findingPage}
                      total={Math.ceil(matching.length / 10)}
                      onChange={setFindingPage}
                    />
                    <button
                      disabled={findingPage * 10 >= matching.length}
                      onClick={() => setFindingPage(findingPage + 1)}
                    >
                      Next findings
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <section className="panel">
              <Empty
                title="No matching findings"
                detail="No configured rule matched this selection. This is not a project health assessment."
              />
            </section>
          )}
          <section className="panel limitations">
            <h3>
              <CircleHelp size={18} />
              How to interpret this brief
            </h3>
            <details>
              <summary>Scope, thresholds & interpretation limits</summary>
              <ul>
                {brief.data?.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <p>
                Configured thresholds: PR age {info.policy.pr_age_days} days ·
                inactivity {info.policy.pr_idle_days} days · repeated CI
                failures {info.policy.ci_failure_threshold} · stale after{" "}
                {info.policy.stale_hours} hours.
              </p>
            </details>
          </section>
        </>
      )}
    </>
  );
}
