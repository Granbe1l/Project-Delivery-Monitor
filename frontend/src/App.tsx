import { useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useSearchParams,
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
        <span title={help} tabIndex={0} aria-label={help}>
          <CircleHelp size={14} />
        </span>
      </div>
      <strong>{value ?? "—"}</strong>
      <small>
        {value == null ? "Data unavailable" : "In collected records"}
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
function FindingCard({ finding }: { finding: Finding }) {
  return (
    <article className="finding">
      <div className="finding-top">
        <Badge value={finding.severity} />
        <small>
          {finding.rule_id} · v{finding.rule_version}
        </small>
      </div>
      <h3>{finding.observation}</h3>
      <p>{finding.explanation}</p>
      <div className="action">
        <ArrowRight size={16} />
        <span>{finding.recommendation}</span>
      </div>
      <div className="finding-foot">
        <Evidence url={finding.evidence_url} />
        <small>{timestamp(finding.observed_at)}</small>
      </div>
      <details>
        <summary>Interpretation limits</summary>
        <p>{finding.limitations}</p>
      </details>
    </article>
  );
}

export default function App() {
  const [params, setParams] = useSearchParams();
  const [menu, setMenu] = useState(false);
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
    <div className="app">
      <a href="#content" className="skip">
        Skip to content
      </a>
      <aside className={menu ? "sidebar open" : "sidebar"}>
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
          GitHub REST API · Periodic sync
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMenu(!menu)}
            aria-label="Toggle navigation"
            aria-expanded={menu}
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
              Project Delivery Monitor<span className="title-dot">.</span>
            </h1>
            <p>
              Monitor development work, spot items needing attention, and review
              supporting evidence.
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
                Last observed{" "}
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
                    element={<Details info={info.data} />}
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
                  <Route path="/risks" element={<Risks info={info.data} />} />
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
      <div className="metrics">
        <Metric
          label="Open issues"
          value={m?.open_issues}
          help="An issue tracks a report or request. Pull requests are excluded."
        />
        <Metric
          label="Open pull requests"
          value={m?.open_prs}
          help="A pull request proposes a code change. Counts cover the collected records."
        />
        <Metric
          label="PRs needing attention"
          value={m?.prs_needing_attention}
          help={`Non-draft PRs older than ${info.policy.pr_age_days} days or not updated for ${info.policy.pr_idle_days} days.`}
        />
        <Metric
          label="CI failures / completed"
          value={
            m?.ci_failures == null
              ? null
              : `${m.ci_failures} / ${m.ci_completed}`
          }
          help={`CI means automated checks. Denominator: ${m?.ci_completed ?? "unavailable"} completed default-branch runs in the collected 30-day window.`}
        />
      </div>
      <p className="scope">
        <CircleHelp size={14} />
        {info.scope}
      </p>
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
                <FindingCard key={i} finding={f} />
              ))}
            </div>
          ) : (
            <Empty
              title="No findings in this observation"
              detail="No configured rule matched the collected records. This does not establish overall project health."
            />
          )}
        </section>
        <section className="panel how-to">
          <span className="eyebrow">A CLEARER PICTURE</span>
          <h2>
            From activity
            <br />
            to informed action.
          </h2>
          <p>Use delivery signals to decide what to investigate next.</p>
          {[
            [
              "01",
              "Observe the facts",
              "Check timestamps and the scope of collected data.",
            ],
            [
              "02",
              "Understand the signal",
              "Read why an item crosses a configured threshold.",
            ],
            [
              "03",
              "Review the evidence",
              "Open the original GitHub record before acting.",
            ],
          ].map(([n, t, d]) => (
            <div className="step" key={n}>
              <span>{n}</span>
              <div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            </div>
          ))}
          <div className="note">
            <ShieldCheck size={20} />
            <p>
              No quality scores. No inferred deadlines. Every finding has a
              source.
            </p>
          </div>
        </section>
      </div>
      <CoveragePanel info={info} />
    </>
  );
}
function CoveragePanel({ info }: { info: Overview }) {
  return (
    <section className="panel coverage-panel">
      <div>
        <h2>Data confidence starts with coverage</h2>
        <p>
          Collection status for each source. Partial results are a sample, never
          a repository total.
        </p>
      </div>
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
    </section>
  );
}
function Details({ info }: { info: Overview }) {
  const trends = useQuery({
    queryKey: ["trends", info.project.id],
    queryFn: () => api<Trends>(`/projects/${info.project.id}/trends`),
  });
  const milestones = useQuery({
    queryKey: ["milestones", info.project.id],
    queryFn: () =>
      api<Page>(`/projects/${info.project.id}/milestones?page_size=100`),
  });
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
            <div className="table-wrap">
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
                  {trends.data.points.map((p) => (
                    <tr key={p.observed_at}>
                      <td>{timestamp(p.observed_at)}</td>
                      <td>{p.metrics.open_issues ?? "Unavailable"}</td>
                      <td>{p.metrics.open_prs ?? "Unavailable"}</td>
                      <td>
                        {Object.values(p.coverage).every(
                          (c) => c.coverage === "complete",
                        )
                          ? "Complete"
                          : "Partial — not directly comparable"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="scope">{trends.data.limitation}</p>
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
    ...(period ? { period } : {}),
    ...(branch ? { branch } : {}),
  });
  const rows = useQuery({
    queryKey: [kind, info.project.id, q, page, period, branch],
    queryFn: () => api<Page>(`/projects/${info.project.id}/${path}?${query}`),
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
                ? "PR age and time since update are separate signals. Drafts are excluded from attention rules."
                : "Open issue observations. A “bug” label is a report, not a verified defect."}
          </p>
        </div>
      </div>
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
        <div className="panel">
          <h3>Completed default-branch runs · 30-day collected window</h3>
          <div className="conclusions">
            {[
              "success",
              "failure",
              "cancelled",
              "skipped",
              "timed_out",
              "neutral",
              "action_required",
              "stale",
              "unknown",
            ].map((key) => (
              <span key={key}>
                {key.replaceAll("_", " ")}{" "}
                <strong>{info.metrics!.ci_conclusions![key] ?? 0}</strong>
              </span>
            ))}
          </div>
          <p className="scope">
            Denominator: {info.metrics.ci_completed} completed runs. In-progress
            runs are excluded. Categories are not combined into success or
            failure.
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
                <div className="table-wrap">
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
                          <td>
                            <strong>{r.title ?? r.name}</strong>
                            <small>
                              {r.number ? `#${r.number}` : `Run ${r.github_id}`}
                              {r.labels?.length
                                ? ` · ${r.labels.map((l) => l.name).join(", ")}`
                                : ""}
                            </small>
                          </td>
                          <td>
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
                          <td>
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
                          <td>
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
  function download() {
    if (!brief.data) return;
    const b = brief.data;
    const content = [
      b.title,
      b.overview.project.full_name,
      `Observed: ${timestamp(b.overview.observed_at)}`,
      b.overview.scope,
      JSON.stringify(b.overview.metrics, null, 2),
      "COVERAGE",
      JSON.stringify(b.overview.coverage, null, 2),
      ...b.findings.map(
        (f) =>
          `${f.observation}\nWhy: ${f.explanation}\nSuggested action: ${f.recommendation}\nEvidence: ${f.evidence_url}\nObserved: ${f.observed_at}\nRule: ${f.rule_id} v${f.rule_version}\nLimitations: ${f.limitations}`,
      ),
      "LIMITATIONS",
      ...b.limitations,
    ].join("\n\n");
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
      <div className="brief-intro">
        <div>
          <span className="eyebrow">PROJECT INTELLIGENCE BRIEF</span>
          <h2>What to review next</h2>
          <p>
            Thresholds guide investigation; they do not establish a cause or
            rank project quality.
          </p>
        </div>
        <label>
          Finding type
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All findings</option>
            <option value="pr_age">Pull request age</option>
            <option value="ci_repeated_failure">CI failures</option>
            <option value="milestone_due">Milestones</option>
            <option value="freshness">Data freshness</option>
          </select>
        </label>
      </div>
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
          ) : brief.data?.findings.filter(
              (f) => filter === "all" || f.rule_id === filter,
            ).length ? (
            <div className="risk-grid">
              {brief.data.findings
                .filter((f) => filter === "all" || f.rule_id === filter)
                .map((f, i) => (
                  <FindingCard finding={f} key={i} />
                ))}
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
            <ul>
              {brief.data?.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <p>
              Configured thresholds: PR age {info.policy.pr_age_days} days ·
              inactivity {info.policy.pr_idle_days} days · repeated CI failures{" "}
              {info.policy.ci_failure_threshold} · stale after{" "}
              {info.policy.stale_hours} hours.
            </p>
          </section>
        </>
      )}
    </>
  );
}
