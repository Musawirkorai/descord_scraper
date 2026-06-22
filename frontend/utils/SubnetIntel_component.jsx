// ── SUBNET INTELLIGENCE PAGE ──────────────────────────────────────────────────
// Add to your frontend:
// NAV:   { id:"subnets", icon:"⬡", label:"Subnet Intel" }
// PAGES: subnets: SubnetIntel

function SubnetIntel() {
  const [tab, setTab]           = useState("today");    // today | leaderboard | schedule
  const [reports, setReports]   = useState([]);
  const [leaderboard, setLb]    = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [running, setRunning]   = useState(false);
  const [err, setErr]           = useState("");
  const [selected, setSelected] = useState(null);       // detail view
  const [historySubnet, setHistSub] = useState(null);   // history for one subnet
  const [historyData, setHistData]  = useState([]);

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const [r, lb, sc] = await Promise.all([
        api("/subnets/reports"),
        api("/subnets/leaderboard"),
        api("/subnets/schedule"),
      ]);
      setReports(r);
      setLb(lb);
      setSchedule(sc);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runNow = async (subnetNumbers = null) => {
    setRunning(true);
    try {
      await api("/subnets/run", {
        method: "POST",
        body: JSON.stringify({ subnetNumbers }),
      });
      setTimeout(load, 3000);
    } catch (e) { setErr(e.message); }
    setRunning(false);
  };

  const loadHistory = async (subnetNumber) => {
    setHistSub(subnetNumber);
    const data = await api(`/subnets/reports/${subnetNumber}`).catch(() => []);
    setHistData(data);
  };

  // ── helpers
  const scoreColor = s =>
    s >= 8.5 ? "#10b981" :
    s >= 7   ? "#3b82f6" :
    s >= 5   ? "#f59e0b" : "#ef4444";

  const scoreLabel = s =>
    s >= 8.5 ? "Strong Buy" :
    s >= 7   ? "Buy"        :
    s >= 5   ? "Neutral"    : "Caution";

  const sentColor = s =>
    s === "positive" ? "#10b981" :
    s === "negative" ? "#ef4444" :
    s === "mixed"    ? "#f59e0b" : "#64748b";

  const confColor = c =>
    c === "HIGH"   ? "#10b981" :
    c === "MEDIUM" ? "#f59e0b" : "#64748b";

  const ScoreRing = ({ score, size = 64 }) => {
    const pct = (score / 10) * 100;
    const r = (size / 2) - 6;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    return (
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={5}/>
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={scoreColor(score)} strokeWidth={5}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: size > 50 ? 16 : 11, fontWeight: 800, color: scoreColor(score), fontFamily: "var(--mono)", lineHeight: 1 }}>{score?.toFixed(1)}</span>
          <span style={{ fontSize: 8, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>/10</span>
        </div>
      </div>
    );
  };

  const BreakdownBar = ({ label, value }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: "var(--muted)", width: 160, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
        <div style={{ width: `${(value / 10) * 100}%`, height: "100%", background: scoreColor(value), borderRadius: 3, transition: "width .4s" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(value), fontFamily: "var(--mono)", width: 28, textAlign: "right" }}>{value?.toFixed(1)}</span>
    </div>
  );

  // ── REPORT CARD (summary card in list view)
  const ReportCard = ({ r }) => {
    const report = r.report || {};
    const score  = report.investabilityScore;
    const topics = report.mainTopics || [];
    return (
      <div
        onClick={() => setSelected(r)}
        style={{
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16,
          padding: "20px 22px", cursor: "pointer", transition: "all .15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = scoreColor(score) + "55"; e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "none"; }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 11, flexShrink: 0,
            background: `linear-gradient(135deg, ${scoreColor(score)}22, ${scoreColor(score)}11)`,
            border: `1px solid ${scoreColor(score)}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: scoreColor(score), fontFamily: "var(--mono)",
          }}>
            {r.subnetNumber}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>
              {report.subnetName || r.channelName}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Subnet {r.subnetNumber} · {new Date(r.reportDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <ScoreRing score={score} size={56} />
            <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor(score), textTransform: "uppercase", letterSpacing: ".06em" }}>{scoreLabel(score)}</span>
          </div>
        </div>

        {/* One-liner */}
        {report.oneLiner && (
          <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.55, margin: "0 0 12px", fontStyle: "italic" }}>
            "{report.oneLiner}"
          </p>
        )}

        {/* Sentiment + message count */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {report.sentiment && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 5,
              background: `${sentColor(report.sentiment)}18`, color: sentColor(report.sentiment),
              border: `1px solid ${sentColor(report.sentiment)}35`,
            }}>{report.sentiment}</span>
          )}
          {report.messageCount > 0 && (
            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
              {report.messageCount.toLocaleString()} msgs analyzed
            </span>
          )}
        </div>

        {/* Topic titles preview */}
        {topics.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {topics.slice(0, 4).map((t, i) => (
              <span key={i} style={{
                fontSize: 11, padding: "3px 9px", borderRadius: 5,
                background: "rgba(59,130,246,.08)", border: "1px solid rgba(59,130,246,.15)", color: "#7dd3fc",
              }}>{t.title}</span>
            ))}
            {topics.length > 4 && <span style={{ fontSize: 11, color: "var(--dim)" }}>+{topics.length - 4} more</span>}
          </div>
        )}
      </div>
    );
  };

  // ── DETAIL VIEW (full report like the example)
  const DetailView = ({ r, onClose }) => {
    const report = r.report || {};
    const score  = report.investabilityScore;
    const bd     = report.investabilityBreakdown || {};

    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 1000, overflowY: "auto", padding: "24px 16px", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      >
        <div style={{ maxWidth: 820, margin: "0 auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Modal header */}
          <div style={{
            padding: "20px 28px", borderBottom: "1px solid var(--border)",
            background: `linear-gradient(135deg, ${scoreColor(score)}11, transparent)`,
            display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 13, flexShrink: 0,
              background: `${scoreColor(score)}22`, border: `1px solid ${scoreColor(score)}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 800, color: scoreColor(score), fontFamily: "var(--mono)",
            }}>{r.subnetNumber}</div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>{report.subnetName || r.channelName}</h2>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Subnet {r.subnetNumber} · {new Date(r.reportDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                {report.messageCount > 0 && ` · ${report.messageCount.toLocaleString()} messages`}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <ScoreRing score={score} size={72} />
              <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(score), textTransform: "uppercase", letterSpacing: ".07em" }}>{scoreLabel(score)}</span>
            </div>
            <button onClick={onClose} style={{ background: "transparent", color: "var(--muted)", fontSize: 22, cursor: "pointer", border: "none", padding: "0 4px", marginLeft: 8 }}>✕</button>
          </div>

          <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 28 }}>

            {/* One-liner */}
            {report.oneLiner && (
              <div style={{
                padding: "14px 18px", borderRadius: 10,
                background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.15)",
                fontSize: 14, color: "#93c5fd", fontStyle: "italic", lineHeight: 1.6,
              }}>
                {report.oneLiner}
              </div>
            )}

            {/* ── SECTION 1: Main Topics */}
            {report.mainTopics?.length > 0 && (
              <section>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>📋</span> Main Topics Discussed
                </div>
                {report.mainTopics.map((topic, i) => (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#93c5fd", marginBottom: 6 }}>
                      {i + 1}. {topic.title}
                    </div>
                    {topic.description && (
                      <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 8px", lineHeight: 1.6 }}>{topic.description}</p>
                    )}
                    {topic.bulletPoints?.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {topic.bulletPoints.map((bp, j) => (
                          <li key={j} style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, marginBottom: 2 }}>{bp}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* ── SECTION 2: Investability Score */}
            <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>💰</span> Investability Analysis
              </div>

              {/* Big score + breakdown */}
              <div style={{ display: "flex", gap: 28, marginBottom: 20, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <ScoreRing score={score} size={88} />
                  <span style={{ fontSize: 16, fontWeight: 800, color: scoreColor(score) }}>{scoreLabel(score)}</span>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  {Object.entries({
                    "Technology":           bd.technology,
                    "Team Execution":       bd.teamExecution,
                    "Commercial Potential": bd.commercialPotential,
                    "Economic Maturity":    bd.economicMaturity,
                    "Decentralization":     bd.decentralization,
                  }).map(([label, val]) => val != null && (
                    <BreakdownBar key={label} label={label} value={val} />
                  ))}
                </div>
              </div>

              {/* Positives */}
              {report.positives?.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>✅ Positives</div>
                  {report.positives.map((p, i) => (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{p.category}</span>
                        {p.score != null && (
                          <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "#10b981", background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.25)", padding: "1px 7px", borderRadius: 4 }}>
                            {p.score}/10
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>{p.detail}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Concerns */}
              {report.concerns?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>⚠️ Concerns</div>
                  {report.concerns.map((c, i) => (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{c.category}</span>
                        {c.score != null && (
                          <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "#f59e0b", background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.25)", padding: "1px 7px", borderRadius: 4 }}>
                            {c.score}/10
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>{c.detail}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* What impresses + raise to 9 */}
              {report.whatImpresses && (
                <div style={{ padding: "12px 16px", background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.15)", borderRadius: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#93c5fd", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>What Stands Out</div>
                  <p style={{ fontSize: 13, color: "#cbd5e1", margin: 0, lineHeight: 1.6 }}>{report.whatImpresses}</p>
                </div>
              )}
              {report.raiseTo9 && (
                <div style={{ padding: "12px 16px", background: "rgba(139,92,246,.06)", border: "1px solid rgba(139,92,246,.15)", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#c4b5fd", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>What Would Raise It to 9/10</div>
                  <p style={{ fontSize: 13, color: "#cbd5e1", margin: 0, lineHeight: 1.6 }}>{report.raiseTo9}</p>
                </div>
              )}
            </section>

            {/* ── SECTION 3: Signals & Issues */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {report.emergingSignals?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>Emerging Signals</div>
                  {report.emergingSignals.map((s, i) => (
                    <div key={i} style={{ padding: "10px 12px", borderRadius: 9, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{s.signal}</span>
                        <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", background: `${confColor(s.confidence)}22`, color: confColor(s.confidence), border: `1px solid ${confColor(s.confidence)}44` }}>{s.confidence}</span>
                      </div>
                      {s.description && <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px", lineHeight: 1.4 }}>{s.description}</p>}
                      {s.evidence && <div style={{ fontSize: 11, color: "var(--dim)", fontStyle: "italic", borderLeft: "2px solid var(--border)", paddingLeft: 7 }}>"{s.evidence}"</div>}
                    </div>
                  ))}
                </div>
              )}
              {(report.userIssues?.length > 0 || report.openQuestions?.length > 0) && (
                <div>
                  {report.userIssues?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>User Issues</div>
                      {report.userIssues.map((u, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                          <span style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }}>!</span>
                          <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{u}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {report.openQuestions?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Open Questions</div>
                      {report.openQuestions.map((q, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                          <span style={{ color: "#f59e0b", flexShrink: 0, marginTop: 2 }}>?</span>
                          <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{q}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* History button */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { onClose(); loadHistory(r.subnetNumber); setTab("today"); }}
                style={{ padding: "10px 20px", background: "transparent", border: "1px solid var(--border)", borderRadius: 9, color: "var(--muted)", fontSize: 13, cursor: "pointer", fontFamily: "var(--font)" }}
              >View History →</button>
              <button
                onClick={() => runNow([r.subnetNumber])}
                disabled={running}
                style={{ padding: "10px 20px", background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.25)", borderRadius: 9, color: "#93c5fd", fontSize: 13, cursor: "pointer", fontFamily: "var(--font)" }}
              >{running ? "Running…" : "Re-analyze →"}</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── LEADERBOARD TAB
  const LeaderboardTab = () => (
    <Card style={{ overflow: "hidden" }}>
      <CardHeader title="Subnet Investability Leaderboard" action={<Badge color="blue">{leaderboard.length} subnets</Badge>} />
      {leaderboard.map((r, i) => {
        const report = r.report || {};
        const score  = report.investabilityScore;
        return (
          <div key={r._id} onClick={() => setSelected(r)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: i < leaderboard.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", transition: "background .1s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.02)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ width: 28, textAlign: "center", fontSize: 13, fontWeight: 700, color: i < 3 ? ["#fbbf24","#94a3b8","#c97c3a"][i] : "var(--dim)" }}>#{i + 1}</div>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: `${scoreColor(score)}18`, border: `1px solid ${scoreColor(score)}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: scoreColor(score), fontFamily: "var(--mono)", flexShrink: 0 }}>
              {r.subnetNumber}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{report.subnetName || r.channelName}</div>
              {report.oneLiner && <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{report.oneLiner}</div>}
            </div>
            <ScoreRing score={score} size={44} />
          </div>
        );
      })}
    </Card>
  );

  // ── SCHEDULE TAB
  const ScheduleTab = () => {
    const sc = schedule;
    if (!sc) return <Empty msg="No schedule data" />;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {[
            { label: "Current Cycle",    val: sc.schedule?.cycleNumber || 1,    icon: "↻" },
            { label: "Subnets Analyzed", val: `${sc.currentIndex || 0} / ${sc.total || "?"}`, icon: "◎" },
            { label: "Progress",         val: `${sc.progressPercent || 0}%`,    icon: "◆" },
          ].map((s, i) => (
            <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                {s.label}<span style={{ opacity: .4 }}>{s.icon}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#93c5fd" }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <Card style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Cycle {sc.schedule?.cycleNumber || 1} Progress</div>
          <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,.06)", overflow: "hidden", marginBottom: 8 }}>
            <div style={{ width: `${sc.progressPercent || 0}%`, height: "100%", background: "linear-gradient(90deg,#3b82f6,#6366f1)", borderRadius: 4, transition: "width .5s" }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {sc.currentIndex || 0} of {sc.total || "?"} subnets · resets at 150 and starts cycle {(sc.schedule?.cycleNumber || 1) + 1}
          </div>
        </Card>

        {/* Upcoming */}
        {sc.upcoming?.length > 0 && (
          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 14 }}>Next Up Today</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sc.upcoming.map((u, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#93c5fd", fontFamily: "var(--mono)" }}>{u.subnetNumber}</div>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>#{u.name}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Manual trigger */}
        <Card style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Run Now</div>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>Manually trigger today's analysis without waiting for the 08:00 UTC schedule.</p>
          <button onClick={() => runNow()} disabled={running} style={{ padding: "10px 24px", background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "white", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: running ? "not-allowed" : "pointer", border: "none", opacity: running ? .5 : 1, fontFamily: "var(--font)" }}>
            {running ? "Running…" : "▶ Run Next 4 Subnets Now"}
          </button>
        </Card>
      </div>
    );
  };

  // ── RENDER
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {selected && <DetailView r={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div className="fu" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Subnet Intelligence</h2>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Daily automated analysis · 4 subnets/day · 150-subnet rotation</p>
        </div>
        <div style={{ display: "flex", gap: 3, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 4 }}>
          {[["today","📋 Reports"],["leaderboard","🏆 Leaderboard"],["schedule","⏰ Schedule"]].map(([t,label]) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 14px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", background: tab === t ? "rgba(59,130,246,.2)" : "transparent", color: tab === t ? "#93c5fd" : "var(--muted)", border: tab === t ? "1px solid rgba(59,130,246,.3)" : "1px solid transparent", transition: "all .15s", fontFamily: "var(--font)" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {err && <ErrBox msg={err} />}

      {loading
        ? <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}><Spinner size={36} /></div>
        : tab === "today"
          ? reports.length === 0
            ? <Card style={{ padding: 48 }}>
                <Empty msg="No reports yet — click Run Now in the Schedule tab to generate your first analysis" />
              </Card>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
                {reports.map(r => <ReportCard key={r._id} r={r} />)}
              </div>
          : tab === "leaderboard"
            ? <LeaderboardTab />
            : <ScheduleTab />
      }
    </div>
  );
}
