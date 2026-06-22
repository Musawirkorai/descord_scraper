import { useState, useEffect, useCallback } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {  useRef } from "react";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:#080c14; --surface:#0d1220; --card:#111827;
    --border:rgba(255,255,255,0.07); --text:#f1f5f9; --muted:#64748b; --dim:#334155;
    --accent:#3b82f6; --accent2:#8b5cf6; --green:#10b981; --red:#ef4444; --amber:#f59e0b;
    --font:'Space Grotesk',sans-serif; --mono:'JetBrains Mono',monospace;
  }
  html,body,#root { height:100%; }
  body { font-family:var(--font); background:var(--bg); color:var(--text); -webkit-font-smoothing:antialiased; overflow:hidden; font-size:15px; }
  ::-webkit-scrollbar{width:4px;height:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:var(--dim);border-radius:4px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .fu{animation:fadeUp .4s ease forwards}
  .fu1{animation:fadeUp .4s .05s ease both}
  .fu2{animation:fadeUp .4s .10s ease both}
  .fu3{animation:fadeUp .4s .15s ease both}
  .fu4{animation:fadeUp .4s .20s ease both}
  .gt{background:linear-gradient(135deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .noise::after{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");pointer-events:none;z-index:9999;opacity:.4}
  input,select{font-family:var(--font);background:rgba(255,255,255,.04);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:10px 14px;font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s;width:100%}
  input::placeholder{color:var(--muted)}
  input:focus,select:focus{border-color:rgba(59,130,246,.5);box-shadow:0 0 0 3px rgba(59,130,246,.1)}
  select option{background:#1e293b}
  button{font-family:var(--font);cursor:pointer;border:none}
`;

// ── API ──────────────────────────────────────────────────────────────────────
const BASE = "http://localhost:4000/api";
let _token = "";
const setToken = (t) => {
  _token = t;
};

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── SHARED ───────────────────────────────────────────────────────────────────
function Badge({ children, color = "gray" }) {
  const C = {
    blue: ["rgba(59,130,246,.12)", "#60a5fa", "rgba(59,130,246,.2)"],
    green: ["rgba(16,185,129,.12)", "#34d399", "rgba(16,185,129,.2)"],
    red: ["rgba(239,68,68,.12)", "#f87171", "rgba(239,68,68,.2)"],
    amber: ["rgba(245,158,11,.12)", "#fbbf24", "rgba(245,158,11,.2)"],
    purple: ["rgba(139,92,246,.12)", "#a78bfa", "rgba(139,92,246,.2)"],
    cyan: ["rgba(6,182,212,.12)", "#22d3ee", "rgba(6,182,212,.2)"],
    gray: ["rgba(100,116,139,.1)", "#94a3b8", "rgba(100,116,139,.2)"],
    indigo: ["rgba(99,102,241,.12)", "#818cf8", "rgba(99,102,241,.2)"],
  };
  const [bg, text, border] = C[color] || C.gray;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 9px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        background: bg,
        color: text,
        border: `1px solid ${border}`,
      }}
    >
      {children}
    </span>
  );
}

const Card = ({ children, style = {}, className = "" }) => (
  <div
    className={className}
    style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      ...style,
    }}
  >
    {children}
  </div>
);

const CardHeader = ({ title, action }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 20px",
      borderBottom: "1px solid var(--border)",
    }}
  >
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: "var(--muted)",
        textTransform: "uppercase",
        letterSpacing: ".08em",
      }}
    >
      {title}
    </span>
    {action}
  </div>
);

const Spinner = ({ size = 28 }) => (
  <div
    style={{
      width: size,
      height: size,
      border: "2px solid rgba(59,130,246,.2)",
      borderTop: "2px solid #3b82f6",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    }}
  />
);
const Empty = ({ msg = "No data" }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px",
      gap: 12,
    }}
  >
    <span style={{ fontSize: 32, opacity: 0.3 }}>◎</span>
    <span style={{ color: "var(--muted)", fontSize: 14 }}>{msg}</span>
  </div>
);
const ErrBox = ({ msg }) => (
  <div
    style={{
      background: "rgba(239,68,68,.08)",
      border: "1px solid rgba(239,68,68,.2)",
      borderRadius: 10,
      padding: "12px 16px",
      fontSize: 14,
      color: "#f87171",
    }}
  >
    ⚠ {msg}
  </div>
);

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#1e293b",
        border: "1px solid rgba(255,255,255,.1)",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 13,
      }}
    >
      <div style={{ color: "var(--muted)", marginBottom: 6, fontWeight: 600 }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div
          key={i}
          style={{
            color: p.color,
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 2,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: p.color,
              display: "inline-block",
            }}
          />
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState("admin@test.com");
  const [pass, setPass] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const d = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: pass }),
      });
      setToken(d.token);
      onLogin(d.user, d.token);
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(59,130,246,.06) 0%,transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
          pointerEvents: "none",
        }}
      />
      <div
        className="fu"
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 24,
          position: "relative",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 62,
              height: 62,
              borderRadius: 18,
              margin: "0 auto 18px",
              background:
                "linear-gradient(135deg,rgba(59,130,246,.2),rgba(139,92,246,.2))",
              border: "1px solid rgba(59,130,246,.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            ⚡
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            <span className="gt">DataHarvest</span>
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 15 }}>
            Community Intelligence Platform
          </p>
        </div>
        <form
          onSubmit={submit}
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
        >
          {err && <ErrBox msg={err} />}
          {[
            ["Email", "email", email, setEmail, "admin@test.com"],
            ["Password", "password", pass, setPass, "••••••••"],
          ].map(([label, type, val, setter, ph]) => (
            <div
              key={label}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                }}
              >
                {label}
              </label>
              <input
                type={type}
                value={val}
                onChange={(e) => setter(e.target.value)}
                placeholder={ph}
                required
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              padding: "13px 24px",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              background: loading
                ? "rgba(59,130,246,.4)"
                : "linear-gradient(135deg,#3b82f6,#6366f1)",
              color: "white",
              cursor: loading ? "not-allowed" : "pointer",
              border: "none",
              boxShadow: "0 4px 20px rgba(59,130,246,.3)",
            }}
          >
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── SIDEBAR ──────────────────────────────────────────────────────────────────
// AFTER
const NAV = [
  { id:"subnets", icon:"⬡", label:"Subnet Intel" },
  { id: "overview", icon: "▦", label: "Overview" },
  { id: "servers", icon: "◈", label: "Servers" },
  { id: "analytics", icon: "◆", label: "AI Insights" },
  { id: "scraper", icon: "◎", label: "Scraper Jobs" },
  { id: "settings", icon: "◐", label: "Settings" },
  { id:"history", icon:"◷", label:"History" },
];

function Sidebar({ active, onNav, user, onLogout }) {
  return (
    <aside
      style={{
        width: 230,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      <div
        style={{
          padding: "20px 16px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background:
                "linear-gradient(135deg,rgba(59,130,246,.25),rgba(139,92,246,.25))",
              border: "1px solid rgba(59,130,246,.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            ⚡
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>DataHarvest</div>
            <div
              style={{
                fontSize: 11,
                color: "var(--muted)",
                fontFamily: "var(--mono)",
              }}
            >
              v1.0 · live
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--green)",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--green)",
              animation: "pulse 2s infinite",
              display: "inline-block",
            }}
          />
          Bot online
        </div>
      </div>
      <nav style={{ flex: 1, padding: "8px", overflowY: "auto" }}>
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => onNav(n.id)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              marginBottom: 2,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              background:
                active === n.id
                  ? "linear-gradient(135deg,rgba(59,130,246,.15),rgba(139,92,246,.1))"
                  : "transparent",
              color: active === n.id ? "#93c5fd" : "var(--muted)",
              border:
                active === n.id
                  ? "1px solid rgba(59,130,246,.2)"
                  : "1px solid transparent",
              transition: "all .15s",
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>
              {n.icon}
            </span>
            {n.label}
          </button>
        ))}
      </nav>
      <div
        style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "linear-gradient(135deg,#3b82f6,#6366f1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "white",
              }}
            >
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {user?.username}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                {user?.role}
              </div>
            </div>
          </div>
          <button
            onClick={onLogout}
            style={{
              background: "transparent",
              color: "var(--muted)",
              fontSize: 18,
              padding: 4,
              borderRadius: 6,
            }}
            title="Logout"
          >
            ⏻
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── SUBNET INTELLIGENCE v2 ────────────────────────────────────────────────────
// NAV:   { id:"subnets", icon:"⬡", label:"Subnet Intel" }
// PAGES: subnets: SubnetIntel

function SubnetIntel() {
  const [tab, setTab]             = useState("today");
  const [todayReports, setToday]  = useState([]);
  const [allReports, setAll]      = useState([]);
  const [leaderboard, setLb]      = useState([]);
  const [schedule, setSched]      = useState(null);
  const [loading, setLoading]     = useState(true);
  const [running, setRunning]     = useState(false);
  const [err, setErr]             = useState("");
  const [openReport, setOpen]     = useState(null);  // full detail modal

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const [today, lb, sc] = await Promise.all([
        api("/subnets/today"),
        api("/subnets/leaderboard"),
        api("/subnets/schedule"),
      ]);
      setToday(today);
      setLb(lb);
      setSched(sc);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runNow = async (nums = null) => {
    setRunning(true);
    try {
      await api("/subnets/run", { method: "POST", body: JSON.stringify({ subnetNumbers: nums }) });
      setTimeout(load, 4000);
    } catch (e) { setErr(e.message); }
    setRunning(false);
  };

  // ── colour helpers
  const scoreColor = s =>
    s >= 8.5 ? "#10b981" : s >= 7 ? "#3b82f6" : s >= 5 ? "#f59e0b" : "#ef4444";

  const sentColor = s =>
    s === "positive" ? "#10b981" : s === "negative" ? "#ef4444" :
    s === "mixed"    ? "#f59e0b" : "#64748b";

  const confColor = c =>
    c === "HIGH" ? "#10b981" : c === "MEDIUM" ? "#f59e0b" : "#64748b";

  // ── Score ring SVG
  const ScoreRing = ({ score, size = 60 }) => {
    if (!score) return null;
    const r = size / 2 - 6;
    const circ = 2 * Math.PI * r;
    const dash = (score / 10) * circ;
    return (
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={5}/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={scoreColor(score)}
            strokeWidth={5} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize: size>52?15:11, fontWeight:800, color:scoreColor(score), fontFamily:"var(--mono)", lineHeight:1 }}>
            {score?.toFixed(1)}
          </span>
          <span style={{ fontSize:8, color:"var(--muted)", textTransform:"uppercase" }}>/10</span>
        </div>
      </div>
    );
  };

  // ── Mini breakdown bar
  const MiniBar = ({ label, value }) => (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:5 }}>
      <span style={{ fontSize:12, color:"var(--muted)", width:170, flexShrink:0 }}>{label}</span>
      <div style={{ flex:1, height:5, borderRadius:3, background:"rgba(255,255,255,.06)", overflow:"hidden" }}>
        <div style={{ width:`${(value/10)*100}%`, height:"100%", background:scoreColor(value), borderRadius:3 }}/>
      </div>
      <span style={{ fontSize:11, fontWeight:700, color:scoreColor(value), fontFamily:"var(--mono)", width:26, textAlign:"right" }}>
        {value?.toFixed(1)}
      </span>
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────────
  // TODAY CARD — brief, clickable
  // ────────────────────────────────────────────────────────────────────────────
  const TodayCard = ({ r }) => {
    const rpt = r.report || {};
    const score = rpt.investabilityScore;
    const topics = (rpt.mainTopics || []).slice(0, 3);

    return (
      <div
        onClick={() => setOpen(r)}
        style={{
          background:"var(--card)", border:`1px solid var(--border)`,
          borderRadius:18, padding:"22px 24px", cursor:"pointer",
          transition:"all .18s", display:"flex", flexDirection:"column", gap:16,
          minWidth:340,   // ← add this
          maxWidth:380,   // ← add this
          flex:"0 0 auto", // ← add this
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = scoreColor(score) + "66";
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = `0 8px 32px ${scoreColor(score)}18`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.transform = "none";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Top row */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
          {/* Subnet number badge */}
          <div style={{
            width:48, height:48, borderRadius:12, flexShrink:0,
            background:`linear-gradient(135deg,${scoreColor(score)}25,${scoreColor(score)}10)`,
            border:`1px solid ${scoreColor(score)}40`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:15, fontWeight:800, color:scoreColor(score), fontFamily:"var(--mono)",
          }}>{r.subnetNumber}</div>

          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:3 }}>
              {rpt.subnetName || r.channelName}
            </div>
            <div style={{ fontSize:12, color:"var(--muted)" }}>
              Subnet {r.subnetNumber} · {new Date(r.reportDate || r.generatedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
            <ScoreRing score={score} size={58}/>
            <span style={{ fontSize:10, fontWeight:700, color:scoreColor(score), textTransform:"uppercase", letterSpacing:".06em" }}>
              {rpt.scoreLabel || "—"}
            </span>
          </div>
        </div>

        {/* Brief description */}
        {rpt.briefDescription && (
          <p style={{ fontSize:13, color:"#94a3b8", lineHeight:1.65, margin:0 }}>
            {rpt.briefDescription}
          </p>
        )}

        {/* Sentiment pill + message count */}
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          {rpt.overallSentiment && (
            <span style={{
              fontSize:11, fontWeight:600, padding:"2px 9px", borderRadius:5,
              background:`${sentColor(rpt.overallSentiment)}18`,
              color:sentColor(rpt.overallSentiment),
              border:`1px solid ${sentColor(rpt.overallSentiment)}35`,
            }}>{rpt.overallSentiment}</span>
          )}
          {rpt.samplingMethod === "stratified_random" && (
            <span style={{
              fontSize:10, padding:"2px 8px", borderRadius:4, fontWeight:600,
              background:"rgba(245,158,11,.1)", border:"1px solid rgba(245,158,11,.2)", color:"#fbbf24",
              textTransform:"uppercase", letterSpacing:".05em",
            }}>Sampled {rpt.messageCount}/{rpt.totalMessages}</span>
          )}
          {rpt.messageCount > 0 && rpt.samplingMethod !== "stratified_random" && (
            <span style={{ fontSize:11, color:"var(--muted)", fontFamily:"var(--mono)" }}>
              {rpt.messageCount?.toLocaleString()} msgs
            </span>
          )}
          <span style={{ marginLeft:"auto", fontSize:12, color:"var(--accent)" }}>
            View full report →
          </span>
        </div>

        {/* Topic previews */}
        {topics.length > 0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
            {topics.map((t,i) => (
              <span key={i} style={{
                fontSize:11, padding:"3px 9px", borderRadius:5,
                background:"rgba(59,130,246,.08)", border:"1px solid rgba(59,130,246,.15)", color:"#7dd3fc",
              }}>{t.title}</span>
            ))}
            {(rpt.mainTopics||[]).length > 3 && (
              <span style={{ fontSize:11, color:"var(--dim)" }}>+{rpt.mainTopics.length-3} more</span>
            )}
          </div>
        )}
      </div>
    );
  };

  // ────────────────────────────────────────────────────────────────────────────
  // FULL REPORT MODAL
  // ────────────────────────────────────────────────────────────────────────────
  const ReportModal = ({ r, onClose }) => {
    const rpt = r.report || {};
    const score = rpt.investabilityScore;
    const bd = rpt.investabilityBreakdown || {};

    const [chatMessages, setChatMsgs] = useState([]);
    const [chatInput, setChatInput]   = useState("");
    const [chatLoading, setChatLoad]  = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior:"smooth" });
    }, [chatMessages]);

    const sendChat = async () => {
      if (!chatInput.trim() || chatLoading) return;
      const q = chatInput.trim();
      setChatInput("");
      setChatMsgs(prev => [...prev, { role:"user", content:q }]);
      setChatLoad(true);
      try {
        const res = await api(`/subnets/chat/${r.subnetNumber}`, {
          method:"POST",
          body: JSON.stringify({ question: q, days: 30 }),
        });
        setChatMsgs(prev => [...prev, { role:"assistant", content: res.answer }]);
      } catch(e) {
        setChatMsgs(prev => [...prev, { role:"assistant", content:`Error: ${e.message}` }]);
      }
      setChatLoad(false);
    };

    // Preset questions
    const PRESETS = [
      "What are the main topics discussed?",
      "Evaluate the investability and give it a score 1-10.",
      "What are the most important developments to watch?",
      "What technical issues are users facing?",
      "What is the community sentiment about this subnet?",
    ];

    const Section = ({ icon, title, children }) => (
      <div style={{ marginBottom:28 }}>
        <div style={{
          display:"flex", alignItems:"center", gap:8, marginBottom:16,
          paddingBottom:10, borderBottom:"1px solid var(--border)",
        }}>
          <span style={{ fontSize:18 }}>{icon}</span>
          <span style={{ fontSize:14, fontWeight:700, color:"#e2e8f0", textTransform:"uppercase", letterSpacing:".08em" }}>
            {title}
          </span>
        </div>
        {children}
      </div>
    );

    return (
      <div
        onClick={onClose}
        style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,.8)", zIndex:1000,
          overflowY:"auto", padding:"20px 16px", backdropFilter:"blur(8px)",
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth:860, margin:"0 auto",
            background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:22, overflow:"hidden",
          }}
        >
          {/* ── Modal header */}
          <div style={{
            padding:"22px 28px", borderBottom:"1px solid var(--border)",
            background:`linear-gradient(135deg,${scoreColor(score)}0d,transparent)`,
            display:"flex", alignItems:"center", gap:16,
            position:"sticky", top:0, zIndex:10,
            backdropFilter:"blur(12px)",
          }}>
            <div style={{
              width:54, height:54, borderRadius:14, flexShrink:0,
              background:`${scoreColor(score)}20`, border:`1px solid ${scoreColor(score)}45`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:18, fontWeight:800, color:scoreColor(score), fontFamily:"var(--mono)",
            }}>{r.subnetNumber}</div>
            <div style={{ flex:1 }}>
              <h2 style={{ fontSize:20, fontWeight:800, margin:"0 0 4px" }}>
                {rpt.subnetName || r.channelName}
              </h2>
              <div style={{ fontSize:12, color:"var(--muted)" }}>
                Subnet {r.subnetNumber} · {new Date(r.reportDate||r.generatedAt).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
                {rpt.messageCount > 0 && ` · ${rpt.messageCount?.toLocaleString()} messages analyzed`}
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
              <ScoreRing score={score} size={72}/>
              <span style={{ fontSize:11, fontWeight:700, color:scoreColor(score), textTransform:"uppercase", letterSpacing:".06em" }}>
                {rpt.scoreLabel}
              </span>
            </div>
            <button onClick={onClose} style={{ background:"transparent", color:"var(--muted)", fontSize:22, cursor:"pointer", border:"none", padding:"0 4px", marginLeft:8 }}>✕</button>
          </div>

          <div style={{ padding:"28px 28px 0" }}>

            {/* One-liner */}
            {rpt.oneLiner && (
              <div style={{
                padding:"14px 18px", borderRadius:11, marginBottom:24,
                background:"rgba(59,130,246,.06)", border:"1px solid rgba(59,130,246,.15)",
                fontSize:14, color:"#93c5fd", fontStyle:"italic", lineHeight:1.65,
              }}>"{rpt.oneLiner}"</div>
            )}

            {/* Sentiment */}
            {rpt.overallSentiment && (
              <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:24, flexWrap:"wrap" }}>
                <span style={{
                  fontSize:12, fontWeight:600, padding:"4px 12px", borderRadius:6,
                  background:`${sentColor(rpt.overallSentiment)}18`,
                  color:sentColor(rpt.overallSentiment),
                  border:`1px solid ${sentColor(rpt.overallSentiment)}35`,
                }}>Community sentiment: {rpt.overallSentiment}</span>
                {rpt.sentimentDetail && (
                  <span style={{ fontSize:13, color:"var(--muted)" }}>{rpt.sentimentDetail}</span>
                )}
              </div>
            )}

            {/* ── SECTION 1: Main Topics */}
            {rpt.mainTopics?.length > 0 && (
              <Section icon="📋" title="Main Topics Discussed">
                {rpt.mainTopics.map((topic, i) => (
                  <div key={i} style={{ marginBottom:20 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:"#93c5fd", marginBottom:6 }}>
                      {i+1}. {topic.title}
                    </div>
                    {topic.description && (
                      <p style={{ fontSize:13, color:"#94a3b8", margin:"0 0 8px", lineHeight:1.65 }}>
                        {topic.description}
                      </p>
                    )}
                    {topic.bulletPoints?.length > 0 && (
                      <ul style={{ margin:0, paddingLeft:20 }}>
                        {topic.bulletPoints.map((bp,j) => (
                          <li key={j} style={{ fontSize:13, color:"#94a3b8", lineHeight:1.75, marginBottom:3 }}>
                            {bp}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </Section>
            )}

            {/* ── SECTION 2: Investability */}
            <Section icon="💰" title="Investability Analysis">
              <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:14, padding:"20px 22px", marginBottom:20 }}>
                {/* Score + breakdown */}
                <div style={{ display:"flex", gap:28, marginBottom:20, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                    <ScoreRing score={score} size={90}/>
                    <span style={{ fontSize:13, fontWeight:700, color:scoreColor(score) }}>{rpt.scoreLabel}</span>
                  </div>
                  <div style={{ flex:1, minWidth:200 }}>
                    {[
                      ["Technology",           bd.technology],
                      ["Team Execution",       bd.teamExecution],
                      ["Commercial Potential", bd.commercialPotential],
                      ["Economic Maturity",    bd.economicMaturity],
                      ["Decentralization",     bd.decentralization],
                    ].map(([label,val]) => val != null && <MiniBar key={label} label={label} value={val}/>)}
                  </div>
                </div>

                {/* Bottom line */}
                {rpt.bottomLine && (
                  <div style={{ padding:"12px 14px", background:"rgba(255,255,255,.03)", border:"1px solid var(--border)", borderRadius:9, fontSize:13, color:"#cbd5e1", lineHeight:1.65 }}>
                    {rpt.bottomLine}
                  </div>
                )}
              </div>

              {/* Positives */}
              {rpt.positives?.length > 0 && (
                <div style={{ marginBottom:18 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#10b981", textTransform:"uppercase", letterSpacing:".08em", marginBottom:12 }}>
                    ✅ What Pushes It Higher
                  </div>
                  {rpt.positives.map((p,i) => (
                    <div key={i} style={{ marginBottom:14 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:13, fontWeight:700, color:"#e2e8f0" }}>{i+1}. {p.category}</span>
                        {p.score != null && (
                          <span style={{
                            fontSize:10, fontFamily:"var(--mono)", color:"#10b981",
                            background:"rgba(16,185,129,.1)", border:"1px solid rgba(16,185,129,.25)",
                            padding:"1px 7px", borderRadius:4,
                          }}>{p.score}/10</span>
                        )}
                      </div>
                      <p style={{ fontSize:13, color:"#94a3b8", margin:0, lineHeight:1.65 }}>{p.detail}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Concerns */}
              {rpt.concerns?.length > 0 && (
                <div style={{ marginBottom:18 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#f59e0b", textTransform:"uppercase", letterSpacing:".08em", marginBottom:12 }}>
                    ⚠️ What Holds It Back
                  </div>
                  {rpt.concerns.map((c,i) => (
                    <div key={i} style={{ marginBottom:14 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:13, fontWeight:700, color:"#e2e8f0" }}>{i+1}. {c.category}</span>
                        {c.score != null && (
                          <span style={{
                            fontSize:10, fontFamily:"var(--mono)", color:"#f59e0b",
                            background:"rgba(245,158,11,.1)", border:"1px solid rgba(245,158,11,.25)",
                            padding:"1px 7px", borderRadius:4,
                          }}>{c.score}/10</span>
                        )}
                      </div>
                      <p style={{ fontSize:13, color:"#94a3b8", margin:0, lineHeight:1.65 }}>{c.detail}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* What impresses + raise to 9 + lower rating */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {rpt.whatImpresses && (
                  <div style={{ padding:"14px 16px", background:"rgba(59,130,246,.06)", border:"1px solid rgba(59,130,246,.15)", borderRadius:10 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#93c5fd", textTransform:"uppercase", letterSpacing:".07em", marginBottom:6 }}>What Impresses Most</div>
                    <p style={{ fontSize:13, color:"#cbd5e1", margin:0, lineHeight:1.6 }}>{rpt.whatImpresses}</p>
                  </div>
                )}
                {rpt.raiseTo9 && (
                  <div style={{ padding:"14px 16px", background:"rgba(16,185,129,.05)", border:"1px solid rgba(16,185,129,.15)", borderRadius:10 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#10b981", textTransform:"uppercase", letterSpacing:".07em", marginBottom:6 }}>What Would Raise It to 9/10</div>
                    <p style={{ fontSize:13, color:"#cbd5e1", margin:0, lineHeight:1.6 }}>{rpt.raiseTo9}</p>
                  </div>
                )}
                {rpt.lowerRating && (
                  <div style={{ padding:"14px 16px", background:"rgba(239,68,68,.05)", border:"1px solid rgba(239,68,68,.15)", borderRadius:10 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#ef4444", textTransform:"uppercase", letterSpacing:".07em", marginBottom:6 }}>What Would Lower the Rating</div>
                    <p style={{ fontSize:13, color:"#cbd5e1", margin:0, lineHeight:1.6 }}>{rpt.lowerRating}</p>
                  </div>
                )}
                {rpt.comparisonContext && (
                  <div style={{ padding:"14px 16px", background:"rgba(139,92,246,.05)", border:"1px solid rgba(139,92,246,.15)", borderRadius:10 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#c4b5fd", textTransform:"uppercase", letterSpacing:".07em", marginBottom:6 }}>Vs. Other Subnets</div>
                    <p style={{ fontSize:13, color:"#cbd5e1", margin:0, lineHeight:1.6 }}>{rpt.comparisonContext}</p>
                  </div>
                )}
              </div>
            </Section>

            {/* ── SECTION 3: Signals & Issues */}
            {(rpt.emergingSignals?.length > 0 || rpt.userIssues?.length > 0 || rpt.openQuestions?.length > 0) && (
              <Section icon="📡" title="Signals & Issues">
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                  {rpt.emergingSignals?.length > 0 && (
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:12 }}>Emerging Signals</div>
                      {rpt.emergingSignals.map((s,i) => (
                        <div key={i} style={{ padding:"10px 12px", borderRadius:9, background:"rgba(255,255,255,.03)", border:"1px solid var(--border)", marginBottom:8 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:4 }}>
                            <span style={{ fontSize:12, fontWeight:600, color:"#e2e8f0" }}>{s.signal}</span>
                            <span style={{
                              fontSize:9, padding:"1px 6px", borderRadius:3, fontWeight:700,
                              textTransform:"uppercase", letterSpacing:".05em",
                              background:`${confColor(s.confidence)}20`,
                              color:confColor(s.confidence), border:`1px solid ${confColor(s.confidence)}40`,
                            }}>{s.confidence}</span>
                          </div>
                          {s.description && <p style={{ fontSize:12, color:"#94a3b8", margin:"0 0 4px", lineHeight:1.4 }}>{s.description}</p>}
                          {s.evidence && (
                            <div style={{ fontSize:11, color:"var(--dim)", fontStyle:"italic", borderLeft:"2px solid var(--border)", paddingLeft:8 }}>
                              "{s.evidence}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    {rpt.userIssues?.length > 0 && (
                      <div style={{ marginBottom:16 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>User Issues</div>
                        {rpt.userIssues.map((u,i) => (
                          <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}>
                            <span style={{ color:"#ef4444", flexShrink:0 }}>!</span>
                            <span style={{ fontSize:12, color:"#94a3b8", lineHeight:1.5 }}>{u}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {rpt.openQuestions?.length > 0 && (
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>Open Questions</div>
                        {rpt.openQuestions.map((q,i) => (
                          <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}>
                            <span style={{ color:"#f59e0b", flexShrink:0 }}>?</span>
                            <span style={{ fontSize:12, color:"#94a3b8", lineHeight:1.5 }}>{q}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Section>
            )}

            {/* ── SECTION 4: Developments to Watch */}
            {rpt.developmentsToWatch?.length > 0 && (
              <Section icon="🔭" title="Developments to Watch">
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {rpt.developmentsToWatch.map((d,i) => (
                    <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                      <span style={{ color:"var(--accent)", flexShrink:0, marginTop:2, fontSize:13 }}>→</span>
                      <span style={{ fontSize:13, color:"#94a3b8", lineHeight:1.6 }}>{d}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* ── CHAT SECTION */}
          <div style={{ margin:"0 28px 28px", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
            <div style={{
              padding:"14px 18px", borderBottom:"1px solid var(--border)",
              background:"rgba(59,130,246,.05)",
              display:"flex", alignItems:"center", gap:8,
            }}>
              <span style={{ fontSize:15 }}>💬</span>
              <span style={{ fontSize:13, fontWeight:600 }}>Ask about Subnet {r.subnetNumber}</span>
              <span style={{ fontSize:12, color:"var(--muted)", marginLeft:4 }}>— based on scraped channel data</span>
            </div>

            {/* Preset questions */}
            {chatMessages.length === 0 && (
              <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border)" }}>
                <div style={{ fontSize:11, color:"var(--muted)", marginBottom:8, textTransform:"uppercase", letterSpacing:".07em" }}>Quick questions</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {PRESETS.map((q,i) => (
                    <button key={i} onClick={() => { setChatInput(q); }} style={{
                      padding:"5px 12px", background:"rgba(255,255,255,.04)", border:"1px solid var(--border)",
                      borderRadius:7, fontSize:12, color:"var(--muted)", cursor:"pointer", fontFamily:"var(--font)",
                      transition:"all .15s",
                    }}
                    onMouseEnter={e => { e.target.style.borderColor="rgba(59,130,246,.4)"; e.target.style.color="#93c5fd"; }}
                    onMouseLeave={e => { e.target.style.borderColor="var(--border)"; e.target.style.color="var(--muted)"; }}
                    >{q}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat messages */}
            {chatMessages.length > 0 && (
              <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:12, maxHeight:360, overflowY:"auto" }}>
                {chatMessages.map((msg,i) => (
                  <div key={i} style={{
                    display:"flex", gap:10,
                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                  }}>
                    <div style={{
                      width:28, height:28, borderRadius:7, flexShrink:0,
                      background: msg.role === "user" ? "rgba(59,130,246,.2)" : "rgba(139,92,246,.2)",
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:12,
                    }}>
                      {msg.role === "user" ? "👤" : "🧠"}
                    </div>
                    <div style={{
                      maxWidth:"78%", padding:"10px 14px", borderRadius:10, fontSize:13, lineHeight:1.65,
                      background: msg.role === "user" ? "rgba(59,130,246,.12)" : "rgba(255,255,255,.04)",
                      border: `1px solid ${msg.role === "user" ? "rgba(59,130,246,.25)" : "var(--border)"}`,
                      color: msg.role === "user" ? "#93c5fd" : "#cbd5e1",
                      whiteSpace:"pre-wrap",
                    }}>{msg.content}</div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display:"flex", gap:10 }}>
                    <div style={{ width:28, height:28, borderRadius:7, background:"rgba(139,92,246,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>🧠</div>
                    <div style={{ padding:"10px 14px", borderRadius:10, background:"rgba(255,255,255,.04)", border:"1px solid var(--border)", display:"flex", gap:4, alignItems:"center" }}>
                      {[0,1,2].map(i => <div key={i} style={{ width:5, height:5, borderRadius:"50%", background:"var(--muted)", animation:`pulse 1.2s ${i*0.2}s infinite` }}/>)}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef}/>
              </div>
            )}

            {/* Chat input */}
            <div style={{ padding:"12px 14px", borderTop: chatMessages.length > 0 ? "1px solid var(--border)" : "none", display:"flex", gap:8 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder={`Ask anything about Subnet ${r.subnetNumber}…`}
                style={{ flex:1 }}
                disabled={chatLoading}
              />
              <button
                onClick={sendChat}
                disabled={chatLoading || !chatInput.trim()}
                style={{
                  padding:"10px 20px", background:"linear-gradient(135deg,#3b82f6,#6366f1)",
                  color:"white", borderRadius:9, fontSize:13, fontWeight:600,
                  cursor: chatLoading || !chatInput.trim() ? "not-allowed" : "pointer",
                  border:"none", opacity: chatLoading || !chatInput.trim() ? .5 : 1,
                  fontFamily:"var(--font)", flexShrink:0,
                }}
              >{chatLoading ? "…" : "Ask →"}</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── LEADERBOARD
  const LeaderboardView = () => (
    <Card style={{ overflow:"hidden" }}>
      <CardHeader title="Subnet Investability Leaderboard" action={<Badge color="blue">{leaderboard.length} subnets ranked</Badge>}/>
      {leaderboard.length === 0
        ? <Empty msg="No reports yet"/>
        : leaderboard.map((r,i) => {
          const rpt = r.report || {};
          const score = rpt.investabilityScore;
          return (
            <div key={r._id} onClick={() => setOpen(r)}
              style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", borderBottom: i < leaderboard.length-1 ? "1px solid var(--border)" : "none", cursor:"pointer", transition:"background .1s" }}
              onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,.02)"}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}
            >
              <div style={{ width:26, textAlign:"center", fontSize:13, fontWeight:700, color:i<3?["#fbbf24","#9ca3af","#c97c3a"][i]:"var(--dim)" }}>
                #{i+1}
              </div>
              <div style={{
                width:38, height:38, borderRadius:9, flexShrink:0,
                background:`${scoreColor(score)}18`, border:`1px solid ${scoreColor(score)}35`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:12, fontWeight:800, color:scoreColor(score), fontFamily:"var(--mono)",
              }}>{r.subnetNumber}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>{rpt.subnetName||r.channelName}</div>
                {rpt.oneLiner && <div style={{ fontSize:12, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rpt.oneLiner}</div>}
              </div>
              <ScoreRing score={score} size={44}/>
            </div>
          );
        })
      }
    </Card>
  );

  // ── SCHEDULE
  const ScheduleView = () => {
    const sc = schedule;
    if (!sc) return <Empty msg="No schedule data"/>;
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
          {[
            { label:"Cycle",           val: sc.schedule?.cycleNumber || 1 },
            { label:"Progress",        val: `${sc.currentIndex||0} / ${sc.total||"?"}` },
            { label:"Completion",      val: `${sc.progressPercent||0}%` },
          ].map((s,i) => (
            <div key={i} style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:12, padding:"16px 18px" }}>
              <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".07em", marginBottom:6 }}>{s.label}</div>
              <div style={{ fontSize:22, fontWeight:700, color:"#93c5fd" }}>{s.val}</div>
            </div>
          ))}
        </div>

        <Card style={{ padding:20 }}>
          <div style={{ fontSize:12, color:"var(--muted)", marginBottom:10 }}>Cycle {sc.schedule?.cycleNumber||1} — {sc.total||"?"} total subnets</div>
          <div style={{ height:8, borderRadius:4, background:"rgba(255,255,255,.05)", overflow:"hidden", marginBottom:8 }}>
            <div style={{ width:`${sc.progressPercent||0}%`, height:"100%", background:"linear-gradient(90deg,#3b82f6,#6366f1)", borderRadius:4 }}/>
          </div>
          <div style={{ fontSize:12, color:"var(--muted)" }}>Resets after all {sc.total||150} subnets and begins cycle {(sc.schedule?.cycleNumber||1)+1}</div>
        </Card>

        {sc.upcoming?.length > 0 && (
          <Card style={{ padding:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:14 }}>Next 4 in Rotation</div>
            {sc.upcoming.map((u,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <div style={{ width:30, height:30, borderRadius:7, background:"rgba(59,130,246,.1)", border:"1px solid rgba(59,130,246,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#93c5fd", fontFamily:"var(--mono)" }}>{u.subnetNumber}</div>
                <span style={{ fontSize:13, color:"#94a3b8" }}>#{u.name}</span>
              </div>
            ))}
          </Card>
        )}

        <Card style={{ padding:20 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Manual Trigger</div>
          <p style={{ fontSize:13, color:"var(--muted)", marginBottom:14, lineHeight:1.6 }}>
            Runs next 4 subnets immediately without waiting for 08:00 UTC. Backfills channel data then runs AI analysis.
          </p>
          <button onClick={() => runNow()} disabled={running} style={{
            padding:"10px 24px", background:"linear-gradient(135deg,#3b82f6,#6366f1)",
            color:"white", borderRadius:9, fontSize:14, fontWeight:600,
            cursor: running ? "not-allowed" : "pointer", border:"none",
            opacity: running ? .5 : 1, fontFamily:"var(--font)",
          }}>{running ? "⏳ Running…" : "▶ Run Next 4 Subnets Now"}</button>
        </Card>
      </div>
    );
  };

  // ── MAIN RENDER
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {openReport && <ReportModal r={openReport} onClose={() => setOpen(null)}/>}

      {/* Header */}
      <div className="fu" style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
        <div>
          <h2 style={{ fontSize:24, fontWeight:700, marginBottom:4 }}>Subnet Intelligence</h2>
          <p style={{ color:"var(--muted)", fontSize:14 }}>
            Automated daily analysis · 4 subnets/day · 150-subnet rotation · click any card for full report + chat
          </p>
        </div>
        <div style={{ display:"flex", gap:3, background:"var(--card)", border:"1px solid var(--border)", borderRadius:10, padding:4 }}>
          {[["today","📋 Today"],["leaderboard","🏆 Leaderboard"],["schedule","⏰ Schedule"]].map(([t,label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding:"7px 16px", borderRadius:7, fontSize:13, fontWeight:500, cursor:"pointer",
              background: tab===t ? "rgba(59,130,246,.2)" : "transparent",
              color: tab===t ? "#93c5fd" : "var(--muted)",
              border: tab===t ? "1px solid rgba(59,130,246,.3)" : "1px solid transparent",
              transition:"all .15s", fontFamily:"var(--font)",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {err && <ErrBox msg={err}/>}

      {loading
        ? <div style={{ display:"flex", justifyContent:"center", paddingTop:80 }}><Spinner size={36}/></div>
        : // Replace the today tab content block with this:
tab === "today"
  ? todayReports.length === 0
    ? <Card style={{ padding:52 }}>
        <Empty msg="No reports yet — go to Schedule tab and click Run to generate today's analysis"/>
      </Card>
    : <>
        {/* Date header */}
        <div style={{
          padding: "20px 28px",
          background: "linear-gradient(135deg, rgba(59,130,246,.08), rgba(139,92,246,.05))",
          border: "1px solid rgba(59,130,246,.15)",
          borderRadius: 16,
        }}>
          <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".12em", marginBottom:6 }}>
            Daily Intelligence Report
          </div>
          <div style={{ fontSize:28, fontWeight:800, background:"linear-gradient(135deg,#60a5fa,#a78bfa)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text", letterSpacing:"-.5px" }}>
            {new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
          </div>
          <div style={{ fontSize:13, color:"var(--muted)", marginTop:6 }}>
            {todayReports.length} subnet{todayReports.length !== 1 ? "s" : ""} analyzed today
          </div>
        </div>

        {/* Leaderboard-style list */}
        <Card style={{ overflow:"hidden" }}>
         <Card style={{ overflow: "hidden" }}>
  {todayReports.map((r, i) => {
    const rpt = r.report?.report || r.report || {};
    const score = rpt.investabilityScore;

    const description =
      rpt.briefDescription ||
      rpt.oneLiner ||
      r.briefDescription ||
      r.oneLiner ||
      "No description available";

    return (
      <div
        key={r._id}
        onClick={() => setOpen(r)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "18px 22px",
          borderBottom:
            i < todayReports.length - 1
              ? "1px solid var(--border)"
              : "none",
          cursor: "pointer",
          transition: "background .12s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background =
            "rgba(255,255,255,.025)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {/* Rank */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            flexShrink: 0,
            background: "rgba(255,255,255,.04)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--muted)",
          }}
        >
          #{i + 1}
        </div>

        {/* Subnet Number */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            flexShrink: 0,
            background: `${scoreColor(score)}18`,
            border: `1px solid ${scoreColor(score)}40`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 800,
            color: scoreColor(score),
            fontFamily: "var(--mono)",
          }}
        >
          {r.subnetNumber}
        </div>

        {/* Name + Description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            {rpt.subnetName || r.channelName}
          </div>

          <div
            style={{
              fontSize: 13,
              color: "#94a3b8",
              lineHeight: 1.6,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {description}
          </div>
        </div>

        {/* Sentiment */}
        {rpt.overallSentiment && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 5,
              flexShrink: 0,
              background: `${sentColor(
                rpt.overallSentiment
              )}18`,
              color: sentColor(rpt.overallSentiment),
              border: `1px solid ${sentColor(
                rpt.overallSentiment
              )}35`,
            }}
          >
            {rpt.overallSentiment}
          </span>
        )}

        {/* Score */}
        <ScoreRing score={score} size={52} />

        {/* Arrow */}
        <span
          style={{
            color: "var(--muted)",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          →
        </span>
      </div>
    );
  })}
</Card>
        </Card>
      </>
          : tab === "leaderboard"
            ? <LeaderboardView/>
            : <ScheduleView/>
      }
    </div>
  );
}
// ── OVERVIEW ─────────────────────────────────────────────────────────────────
function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoad] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([api("/messages/stats"), api("/servers")])
      .then(([s, sv]) => setData({ s, sv }))
      .catch((e) => setErr(e.message))
      .finally(() => setLoad(false));
  }, []);

  if (loading)
    return (
      <div
        style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}
      >
        <Spinner size={36} />
      </div>
    );
  if (err) return <ErrBox msg={err} />;

  const { s, sv } = data;
  const src = s.bySource || [];
  const srcColors = {
    discord: "#5865F2",
    github: "#3b82f6",
    twitter: "#06b6d4",
    other: "#64748b",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="fu">
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
          Overview
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          All sources · all time
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 16,
        }}
      >
        {[
          {
            label: "Total Messages",
            val: s.total?.toLocaleString() || "0",
            sub: "all channels",
            icon: "💬",
            accent: true,
          },
          {
            label: "Servers",
            val: sv.length,
            sub: `${sv.filter((x) => x.scrapeEnabled).length} scraping`,
            icon: "🖥️",
          },
          // {label:"Top Author",val:s.topAuthors?.[0]?._id||"—",sub:s.topAuthors?.[0]?`${s.topAuthors[0].count} msgs`:"",icon:"👤"},
          {
            label: "Sources",
            val: src.length,
            sub: src.map((x) => x._id).join(", ") || "none",
            icon: "📡",
          },
        ].map((c, i) => (
          <div
            key={c.label}
            className={`fu${i + 1}`}
            style={{
              background: c.accent
                ? "linear-gradient(135deg,rgba(59,130,246,.12),rgba(139,92,246,.08))"
                : "var(--card)",
              border: `1px solid ${c.accent ? "rgba(59,130,246,.25)" : "var(--border)"}`,
              borderRadius: 16,
              padding: "20px 24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                }}
              >
                {c.label}
              </span>
              <span style={{ fontSize: 18, opacity: 0.6 }}>{c.icon}</span>
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: c.accent ? "#93c5fd" : "var(--text)",
              }}
            >
              {c.val}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card className="fu2">
          <CardHeader
            title="Daily Activity"
            action={<Badge color="blue">Last 30 days</Badge>}
          />
          <div style={{ padding: "20px 16px 16px" }}>
            {(s.byDay || []).length === 0 ? (
              <Empty msg="No activity yet — run a backfill" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={s.byDay}>
                  <defs>
                    <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,.04)"
                  />
                  <XAxis
                    dataKey="_id"
                    tick={{ fontSize: 11, fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<Tip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Messages"
                    stroke="#3b82f6"
                    fill="url(#ga)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="fu3">
          <CardHeader title="By Source" />
          <div style={{ padding: 20 }}>
            {src.length === 0 ? (
              <Empty msg="No data" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie
                      data={src}
                      cx="50%"
                      cy="50%"
                      innerRadius={32}
                      outerRadius={52}
                      dataKey="count"
                      paddingAngle={4}
                    >
                      {src.map((x, i) => (
                        <Cell key={i} fill={srcColors[x._id] || "#64748b"} />
                      ))}
                    </Pie>
                    <Tooltip content={<Tip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  {src.map((x) => (
                    <div
                      key={x._id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: 13,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: srcColors[x._id] || "#64748b",
                          }}
                        />
                        <span
                          style={{
                            color: "var(--muted)",
                            textTransform: "capitalize",
                          }}
                        >
                          {x._id}
                        </span>
                      </div>
                      <span
                        style={{
                          fontWeight: 600,
                          fontFamily: "var(--mono)",
                          fontSize: 12,
                        }}
                      >
                        {x.count}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* {(s.topAuthors||[]).length>0 && (
        <Card className="fu4">
          <CardHeader title="Top Authors" action={<Badge color="gray">Top 10</Badge>}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)"}}>
            {s.topAuthors.slice(0,10).map((a,i)=>(
              <div key={a._id} style={{padding:"14px 20px",borderRight:i%5<4?"1px solid var(--border)":"none",borderBottom:i<5?"1px solid var(--border)":"none"}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a._id}</div>
                <div style={{fontSize:14,color:"var(--accent)",fontFamily:"var(--mono)",fontWeight:600}}>{a.count}</div>
              </div>
            ))}
          </div>
        </Card>
      )} */}
    </div>
  );
}

// ── SERVERS ──────────────────────────────────────────────────────────────────
function Servers() {
  const [sv, setSv] = useState([]);
  const [ch, setCh] = useState([]);
  const [sel, setSel] = useState(null);
  const [loading, setL] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([api("/servers"), api("/channels")])
      .then(([s, c]) => {
        setSv(s);
        setCh(c);
        if (s.length) setSel(s[0].discordId);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setL(false));
  }, []);

  const toggleSv = async (id, cur) => {
    try {
      const u = await api(`/servers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ scrapeEnabled: !cur }),
      });
      setSv((s) => s.map((x) => (x.discordId === id ? u : x)));
    } catch (e) {
      alert(e.message);
    }
  };
  const toggleCh = async (id, cur) => {
    try {
      const u = await api(`/channels/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ scrapeEnabled: !cur }),
      });
      setCh((c) => c.map((x) => (x.discordId === id ? u : x)));
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading)
    return (
      <div
        style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}
      >
        <Spinner size={36} />
      </div>
    );

  const scCh = ch.filter((c) => c.serverId === sel);

  const Toggle = ({ on, onToggle }) => (
    <div
      onClick={onToggle}
      style={{
        width: 38,
        height: 21,
        borderRadius: 11,
        cursor: "pointer",
        background: on ? "var(--accent)" : "var(--dim)",
        position: "relative",
        transition: "background .2s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2.5,
          left: on ? 19 : 2.5,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "white",
          transition: "left .2s",
          boxShadow: "0 1px 3px rgba(0,0,0,.3)",
        }}
      />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="fu">
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
          Servers & Channels
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          Manage which channels are monitored
        </p>
      </div>
      {err && <ErrBox msg={err} />}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card className="fu1">
          <CardHeader
            title="Connected Servers"
            action={<Badge color="gray">{sv.length}</Badge>}
          />
          {sv.length === 0 ? (
            <Empty msg="No servers yet" />
          ) : (
            sv.map((s, i) => (
              <div
                key={s.discordId}
                onClick={() => setSel(s.discordId)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 20px",
                  cursor: "pointer",
                  borderBottom:
                    i < sv.length - 1 ? "1px solid var(--border)" : "none",
                  background:
                    sel === s.discordId
                      ? "rgba(59,130,246,.06)"
                      : "transparent",
                  transition: "background .15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: `linear-gradient(135deg,hsl(${i * 80 + 200},70%,35%),hsl(${i * 80 + 240},70%,25%))`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "white",
                    }}
                  >
                    {s.name[0]}
                  </div>
                  <div>
                    <div
                      style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}
                    >
                      {s.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {s.memberCount?.toLocaleString()} members
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Badge color={s.scrapeEnabled ? "green" : "gray"}>
                    {s.scrapeEnabled ? "Active" : "Paused"}
                  </Badge>
                  <Toggle
                    on={s.scrapeEnabled}
                    onToggle={(e) => {
                      e.stopPropagation();
                      toggleSv(s.discordId, s.scrapeEnabled);
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </Card>

        <Card className="fu2">
          <CardHeader
            title={
              sel
                ? `Channels — ${sv.find((s) => s.discordId === sel)?.name || ""}`
                : "Channels"
            }
            action={
              <Badge color="blue">
                {scCh.filter((c) => c.scrapeEnabled).length} active
              </Badge>
            }
          />
          {!sel ? (
            <Empty msg="Select a server" />
          ) : scCh.length === 0 ? (
            <Empty msg="No channels" />
          ) : (
            scCh.map((c, i) => (
              <div
                key={c.discordId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "13px 20px",
                  borderBottom:
                    i < scCh.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--muted)", fontSize: 15 }}>#</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {(c.messageCount || 0).toLocaleString()} messages
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Badge color={c.scrapeEnabled ? "green" : "gray"}>
                    {c.scrapeEnabled ? "Scraping" : "Off"}
                  </Badge>
                  <Toggle
                    on={c.scrapeEnabled}
                    onToggle={() => toggleCh(c.discordId, c.scrapeEnabled)}
                  />
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}

// ── MESSAGES ─────────────────────────────────────────────────────────────────
function Messages() {
  const [msgs, setMsgs] = useState([]);
  const [pag, setPag] = useState(null);
  const [loading, setLoad] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [sent, setSent] = useState("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoad(true);
    setErr("");
    try {
      const p = new URLSearchParams({ page, limit: 20 });
      if (search) p.set("keyword", search);
      if (source !== "all") p.set("source", source);
      if (sent !== "all") p.set("sentiment", sent);
      const d = await api(`/messages?${p}`);
      setMsgs(d.messages);
      setPag(d.pagination);
    } catch (e) {
      setErr(e.message);
    }
    setLoad(false);
  }, [search, source, sent, page]);

  useEffect(() => {
    load();
  }, [load]);

  const SC = {
    positive: { c: "#10b981", l: "Positive" },
    neutral: { c: "#64748b", l: "Neutral" },
    negative: { c: "#ef4444", l: "Negative" },
  };
  const SRC = {
    discord: "indigo",
    github: "blue",
    twitter: "cyan",
    other: "gray",
  };
  const AV = [
    "#3b82f6",
    "#8b5cf6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
    "#ec4899",
    "#6366f1",
  ];
  const ago = (iso) => {
    const d = Date.now() - new Date(iso).getTime(),
      h = Math.floor(d / 3.6e6);
    return h < 1
      ? `${Math.floor(d / 6e4)}m ago`
      : h < 24
        ? `${h}h ago`
        : `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        className="fu"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            Messages
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            {pag ? `${pag.total.toLocaleString()} total` : "Loading…"}
          </p>
        </div>
      </div>

      <div className="fu1" style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
              fontSize: 16,
            }}
          >
            ⌕
          </span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search messages or authors…"
            style={{ paddingLeft: 38 }}
          />
        </div>
        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPage(1);
          }}
          style={{ width: 150 }}
        >
          <option value="all">All Sources</option>
          <option value="discord">Discord</option>
          <option value="github">GitHub</option>
          <option value="twitter">Twitter</option>
        </select>
        <select
          value={sent}
          onChange={(e) => {
            setSent(e.target.value);
            setPage(1);
          }}
          style={{ width: 160 }}
        >
          <option value="all">All Sentiment</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
        </select>
        <button
          onClick={load}
          style={{
            padding: "10px 16px",
            background: "rgba(255,255,255,.05)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--muted)",
            fontSize: 14,
          }}
        >
          ↻
        </button>
      </div>

      {err && <ErrBox msg={err} />}

      <Card className="fu2" style={{ overflow: "hidden" }}>
        {loading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 48 }}
          >
            <Spinner />
          </div>
        ) : msgs.length === 0 ? (
          <Empty msg="No messages — run a backfill or adjust filters" />
        ) : (
          msgs.map((m, i) => {
            const sc = SC[m.sentiment] || SC.neutral;
            return (
              <div
                key={m._id}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: "15px 20px",
                  borderBottom:
                    i < msgs.length - 1 ? "1px solid var(--border)" : "none",
                  transition: "background .15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,.02)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    flexShrink: 0,
                    background: AV[m.authorId?.charCodeAt(0) % AV.length || 0],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "white",
                    marginTop: 2,
                  }}
                >
                  {m.authorUsername?.[0]?.toUpperCase() || "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 5,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      {m.authorUsername}
                    </span>
                    <Badge color={SRC[m.source] || "gray"}>{m.source}</Badge>
                    {m.sentiment && (
                      <span
                        style={{
                          fontSize: 12,
                          color: sc.c,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: sc.c,
                            display: "inline-block",
                          }}
                        />
                        {sc.l}
                      </span>
                    )}
                  </div>
                  <p
                    style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6 }}
                  >
                    {m.content || (
                      <span
                        style={{ color: "var(--dim)", fontStyle: "italic" }}
                      >
                        No content
                      </span>
                    )}
                  </p>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    flexShrink: 0,
                    marginTop: 2,
                    whiteSpace: "nowrap",
                  }}
                >
                  {ago(m.discordCreatedAt)}
                </div>
              </div>
            );
          })
        )}
      </Card>

      {pag && pag.pages > 1 && (
        <div
          className="fu3"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: "8px 18px",
              background: "rgba(255,255,255,.05)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: page === 1 ? "var(--dim)" : "var(--text)",
              cursor: page === 1 ? "not-allowed" : "pointer",
              fontSize: 14,
            }}
          >
            ← Prev
          </button>
          <span
            style={{ fontSize: 14, color: "var(--muted)", padding: "0 8px" }}
          >
            Page {page} of {pag.pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pag.pages, p + 1))}
            disabled={page === pag.pages}
            style={{
              padding: "8px 18px",
              background: "rgba(255,255,255,.05)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: page === pag.pages ? "var(--dim)" : "var(--text)",
              cursor: page === pag.pages ? "not-allowed" : "pointer",
              fontSize: 14,
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ── AI INSIGHTS ───────────────────────────────────────────────────────────────
// ── AI INSIGHTS (MULTI-CHANNEL) ───────────────────────────────────────────────
// Drop-in replacement for the Analytics() function in your existing frontend.
// Also update the api() helper's BASE if needed.

// ── AI INSIGHTS (MULTI-CHANNEL, TOPIC-FOCUSED) ────────────────────────────────
// Complete drop-in replacement for Analytics() in your frontend file.
// Shows zero raw messages and zero sender names — pure topic intelligence.

function Analytics({ user }) {
  const [tab, setTab] = useState("summary");
  const [loading, setLoad] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const [servers, setServers] = useState([]);
  const [allChannels, setAllChannels] = useState([]);
  const [selServerId, setSelServerId] = useState("");
  const [selectedChannels, setSelectedChannels] = useState(new Set());
  const [days, setDays] = useState(7);
  const [q, setQ] = useState("");
  const [hist, setHist] = useState([]);
  const [histLoading, setHistLoading] = useState(true);

  useEffect(() => {
    Promise.all([api("/servers"), api("/channels")])
      .then(([sv, ch]) => {
        setServers(sv);
        setAllChannels(ch);
        if (sv.length) setSelServerId(sv[0].discordId);
      })
      .catch(() => {});
    api("/analytics/history?limit=10")
      .then(setHist)
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }, []);

  const serverChannels = allChannels.filter((c) => c.serverId === selServerId);

  const toggleChannel = (id) => {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const run = async () => {
    if (selectedChannels.size === 0) {
      setErr("Select at least one channel.");
      return;
    }
    setLoad(true);
    setErr("");
    setResult(null);
    try {
      const targets = [...selectedChannels].map((id) => {
        const ch = allChannels.find((c) => c.discordId === id);
        return { scope: "channel", targetId: id, targetName: ch?.name || id };
      });
      const d = await api("/analytics/multi", {
        method: "POST",
        body: JSON.stringify({ targets, analysisType: tab, days, question: q }),
      });
      setResult(d);
      api("/analytics/history?limit=10")
        .then(setHist)
        .catch(() => {});
    } catch (e) {
      setErr(e.message);
    }
    setLoad(false);
  };

  // ── sentiment color helper
  const sentColor = (s) =>
    s === "positive"
      ? "green"
      : s === "negative"
        ? "red"
        : s === "mixed"
          ? "amber"
          : "gray";

  // ── channel pill
  const ChPill = ({ ch }) => {
    const on = selectedChannels.has(ch.discordId);
    return (
      <div
        onClick={() => toggleChannel(ch.discordId)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 13px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          userSelect: "none",
          transition: "all .15s",
          border: on
            ? "1px solid rgba(59,130,246,.5)"
            : "1px solid var(--border)",
          background: on ? "rgba(59,130,246,.14)" : "rgba(255,255,255,.03)",
          color: on ? "#93c5fd" : "var(--muted)",
        }}
      >
        <span style={{ opacity: 0.55, fontSize: 11 }}>#</span>
        {ch.name}
        {on && (
          <span style={{ fontSize: 13, color: "#60a5fa", lineHeight: 1 }}>
            ✓
          </span>
        )}
      </div>
    );
  };

  // ── section label
  const SectionLabel = ({ children }) => (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "var(--muted)",
        textTransform: "uppercase",
        letterSpacing: ".1em",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );

  // ── topic chip
  const TopicChip = ({ label, color = "blue" }) => {
    const styles = {
      blue: {
        bg: "rgba(59,130,246,.1)",
        border: "rgba(59,130,246,.2)",
        text: "#93c5fd",
      },
      purple: {
        bg: "rgba(139,92,246,.1)",
        border: "rgba(139,92,246,.2)",
        text: "#c4b5fd",
      },
      teal: {
        bg: "rgba(20,184,166,.1)",
        border: "rgba(20,184,166,.2)",
        text: "#5eead4",
      },
      amber: {
        bg: "rgba(245,158,11,.1)",
        border: "rgba(245,158,11,.2)",
        text: "#fbbf24",
      },
    };
    const s = styles[color] || styles.blue;
    return (
      <span
        style={{
          padding: "4px 11px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 500,
          background: s.bg,
          border: `1px solid ${s.border}`,
          color: s.text,
        }}
      >
        {label}
      </span>
    );
  };

  // ── insight row (highlights / open questions)
  const InsightRow = ({ items, icon, iconColor }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((h, i) => (
        <div
          key={i}
          style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
        >
          <span
            style={{
              color: iconColor,
              marginTop: 3,
              flexShrink: 0,
              fontSize: 13,
            }}
          >
            {icon}
          </span>
          <span style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.55 }}>
            {h}
          </span>
        </div>
      ))}
    </div>
  );

  // ── sentiment bar
  const SentimentBar = ({ pos = 0, neg = 0, neu = 0 }) => {
    const total = pos + neg + neu || 100;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            display: "flex",
            height: 8,
            borderRadius: 4,
            overflow: "hidden",
            gap: 2,
          }}
        >
          <div
            style={{
              width: `${(pos / total) * 100}%`,
              background: "var(--green)",
              borderRadius: 4,
              minWidth: pos > 0 ? 4 : 0,
            }}
          />
          <div
            style={{
              width: `${(neg / total) * 100}%`,
              background: "var(--red)",
              borderRadius: 4,
              minWidth: neg > 0 ? 4 : 0,
            }}
          />
          <div
            style={{
              width: `${(neu / total) * 100}%`,
              background: "var(--dim)",
              borderRadius: 4,
              minWidth: neu > 0 ? 4 : 0,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 16,
            fontSize: 11,
            color: "var(--muted)",
          }}
        >
          <span style={{ color: "var(--green)" }}>
            ▮ {Math.round(pos)}% positive
          </span>
          <span style={{ color: "var(--red)" }}>
            ▮ {Math.round(neg)}% negative
          </span>
          <span style={{ color: "var(--dim)" }}>
            ▮ {Math.round(neu)}% neutral
          </span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        className="fu"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            AI Insights
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            Topic intelligence · no message content shown · Groq LLaMA 3.3
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 3,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 4,
          }}
        >
          {[
            ["summary", "Summary"],
            ["trends", "Trends"],
            ["ask", "Ask AI"],
          ].map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "7px 16px",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                background: tab === t ? "rgba(59,130,246,.2)" : "transparent",
                color: tab === t ? "#93c5fd" : "var(--muted)",
                border:
                  tab === t
                    ? "1px solid rgba(59,130,246,.3)"
                    : "1px solid transparent",
                transition: "all .15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Channel selector ───────────────────────────────── */}
      <Card className="fu1" style={{ padding: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <select
              value={selServerId}
              onChange={(e) => {
                setSelServerId(e.target.value);
                setSelectedChannels(new Set());
              }}
              style={{ width: 210 }}
            >
              {servers.map((s) => (
                <option key={s.discordId} value={s.discordId}>
                  {s.name}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {selectedChannels.size > 0
                ? `${selectedChannels.size} selected`
                : "No channels selected"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() =>
                setSelectedChannels(
                  new Set(serverChannels.map((c) => c.discordId)),
                )
              }
              style={{
                padding: "5px 12px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 7,
                color: "var(--muted)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Select all
            </button>
            <button
              onClick={() => setSelectedChannels(new Set())}
              style={{
                padding: "5px 12px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 7,
                color: "var(--muted)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {serverChannels.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            No channels for this server.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 7,
              marginBottom: 16,
            }}
          >
            {serverChannels.map((ch) => (
              <ChPill key={ch.discordId} ch={ch} />
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            borderTop: "1px solid var(--border)",
            paddingTop: 14,
          }}
        >
          {tab !== "summary" && (
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{ width: 155 }}
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          )}
          {tab === "ask" && (
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask anything about these channels…"
              style={{ flex: 1, minWidth: 220 }}
            />
          )}
          <button
            onClick={run}
            disabled={
              loading || selectedChannels.size === 0 || (tab === "ask" && !q)
            }
            style={{
              padding: "10px 28px",
              background: "linear-gradient(135deg,#3b82f6,#6366f1)",
              color: "white",
              borderRadius: 9,
              fontSize: 14,
              fontWeight: 600,
              cursor:
                loading || selectedChannels.size === 0
                  ? "not-allowed"
                  : "pointer",
              border: "none",
              opacity: loading || selectedChannels.size === 0 ? 0.45 : 1,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {loading
              ? "Analyzing…"
              : tab === "ask"
                ? "Ask →"
                : `Analyze ${selectedChannels.size > 1 ? `${selectedChannels.size} channels` : "channel"}`}
          </button>
        </div>
      </Card>

      {err && <ErrBox msg={err} />}

      {/* ── Loading state ──────────────────────────────────── */}
      {loading && (
        <Card
          style={{
            padding: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <Spinner size={36} />
            <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 16 }}>
              Extracting topic intelligence from {selectedChannels.size} channel
              {selectedChannels.size > 1 ? "s" : ""}…
            </p>
            <p style={{ color: "var(--dim)", fontSize: 12, marginTop: 4 }}>
              No message content is stored or shown
            </p>
          </div>
        </Card>
      )}

      {/* ── Results ────────────────────────────────────────── */}
      {!loading &&
        result &&
        (() => {
          const channelBadges = result.channels?.length > 0 && (
            <div
              className="fu1"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  marginRight: 2,
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                }}
              >
                Channels analyzed
              </span>
              {result.channels.map((c) => (
                <Badge key={c} color="indigo">
                  #{c}
                </Badge>
              ))}
              {result.messageCount > 0 && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 12,
                    color: "var(--muted)",
                    fontFamily: "var(--mono)",
                  }}
                >
                  {result.messageCount.toLocaleString()} messages processed
                </span>
              )}
            </div>
          );

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {channelBadges}

              {/* Summary / overview card */}
              {result.summary && (
                <Card
                  className="fu2"
                  style={{ padding: 0, overflow: "hidden" }}
                >
                  <div
                    style={{
                      padding: "16px 22px",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "rgba(59,130,246,.12)",
                        border: "1px solid rgba(59,130,246,.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                      }}
                    >
                      🧠
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        Topic Overview
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        AI-generated · no message content · no sender names
                      </div>
                    </div>
                    {result.overallSentiment && (
                      <div style={{ marginLeft: "auto" }}>
                        <Badge color={sentColor(result.overallSentiment)}>
                          {result.overallSentiment}
                        </Badge>
                      </div>
                    )}
                    {result.sentiment && !result.overallSentiment && (
                      <div style={{ marginLeft: "auto" }}>
                        <Badge color={sentColor(result.sentiment)}>
                          {result.sentiment}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "20px 22px" }}>
                    <p
                      style={{
                        fontSize: 14,
                        color: "#cbd5e1",
                        lineHeight: 1.75,
                        margin: 0,
                      }}
                    >
                      {result.summary}
                    </p>
                  </div>
                </Card>
              )}

              {/* Ask AI answer */}
              {result.answer && (
                <Card
                  className="fu2"
                  style={{ padding: 0, overflow: "hidden" }}
                >
                  <div
                    style={{
                      padding: "16px 22px",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "rgba(139,92,246,.12)",
                        border: "1px solid rgba(139,92,246,.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                      }}
                    >
                      💬
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      AI Answer
                    </div>
                  </div>
                  <div style={{ padding: "20px 22px" }}>
                    <p
                      style={{
                        fontSize: 14,
                        color: "#cbd5e1",
                        lineHeight: 1.75,
                        whiteSpace: "pre-wrap",
                        margin: 0,
                      }}
                    >
                      {result.answer}
                    </p>
                  </div>
                </Card>
              )}

              {/* Per-channel breakdown — the main section */}
              {result.perChannel?.length > 0 && (
                <Card className="fu3" style={{ overflow: "hidden" }}>
                  <CardHeader
                    title="Per-Channel Topic Breakdown"
                    action={
                      <Badge color="blue">
                        {result.perChannel.length} channels
                      </Badge>
                    }
                  />
                  {result.perChannel.map((ch, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "20px 22px",
                        borderBottom:
                          i < result.perChannel.length - 1
                            ? "1px solid var(--border)"
                            : "none",
                      }}
                    >
                      {/* Channel header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 7,
                            background: `hsl(${i * 47 + 200},55%,25%)`,
                            border: `1px solid hsl(${i * 47 + 200},55%,35%)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            color: `hsl(${i * 47 + 200},80%,70%)`,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          #
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>
                          {ch.channel?.replace("#", "") || ch.name}
                        </span>
                        {ch.sentiment && (
                          <Badge color={sentColor(ch.sentiment)}>
                            {ch.sentiment}
                          </Badge>
                        )}
                      </div>

                      {/* Channel summary */}
                      {ch.summary && (
                        <p
                          style={{
                            fontSize: 13,
                            color: "#94a3b8",
                            lineHeight: 1.65,
                            marginBottom: 12,
                            marginTop: 0,
                          }}
                        >
                          {ch.summary}
                        </p>
                      )}

                      {/* Key topics chips */}
                      {ch.keyTopics?.length > 0 && (
                        <div
                          style={{
                            marginBottom: ch.openQuestions?.length ? 10 : 0,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--dim)",
                              textTransform: "uppercase",
                              letterSpacing: ".07em",
                              marginBottom: 7,
                            }}
                          >
                            Key topics
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 5,
                            }}
                          >
                            {ch.keyTopics.map((t, j) => (
                              <TopicChip
                                key={j}
                                label={t}
                                color={
                                  ["blue", "purple", "teal", "amber"][j % 4]
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Open questions */}
                      {ch.openQuestions?.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--dim)",
                              textTransform: "uppercase",
                              letterSpacing: ".07em",
                              marginBottom: 7,
                            }}
                          >
                            Open questions
                          </div>
                          <InsightRow
                            items={ch.openQuestions}
                            icon="?"
                            iconColor="var(--amber)"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </Card>
              )}

              {/* Per-channel trends */}
              {result.perChannelTrends?.length > 0 && (
                <Card className="fu3" style={{ overflow: "hidden" }}>
                  <CardHeader
                    title="Channel Trends"
                    action={
                      <Badge color="purple">
                        {result.perChannelTrends.length} channels
                      </Badge>
                    }
                  />
                  {result.perChannelTrends.map((ch, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "18px 22px",
                        borderBottom:
                          i < result.perChannelTrends.length - 1
                            ? "1px solid var(--border)"
                            : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 10,
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 600 }}>
                          #{ch.channel?.replace("#", "") || ch.name}
                        </span>
                        {ch.sentiment && (
                          <Badge color={sentColor(ch.sentiment)}>
                            {ch.sentiment}
                          </Badge>
                        )}
                      </div>
                      <div
                        style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
                      >
                        {ch.topTopics?.map((t, j) => (
                          <TopicChip
                            key={j}
                            label={t}
                            color={["purple", "teal", "blue", "amber"][j % 4]}
                          />
                        ))}
                      </div>
                      {ch.emergingTopics?.length > 0 && (
                        <div
                          style={{
                            marginTop: 8,
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontSize: 11, color: "var(--amber)" }}>
                            ↑ emerging:
                          </span>
                          {ch.emergingTopics.map((t, j) => (
                            <span
                              key={j}
                              style={{ fontSize: 12, color: "#fbbf24" }}
                            >
                              {t}
                              {j < ch.emergingTopics.length - 1 ? "," : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </Card>
              )}

              {/* Bottom grid — trending topics + cross-channel + highlights + open questions */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                {/* Trending topics */}
                {result.trendingTopics?.length > 0 && (
                  <Card className="fu3" style={{ padding: 20 }}>
                    <SectionLabel>Trending Topics</SectionLabel>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {result.trendingTopics.slice(0, 6).map((t, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: "#cbd5e1",
                              }}
                            >
                              {t.topic}
                            </span>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <Badge color={sentColor(t.sentiment)}>
                                {t.sentiment}
                              </Badge>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontFamily: "var(--mono)",
                                  color: "var(--dim)",
                                }}
                              >
                                ×{t.frequency}
                              </span>
                            </div>
                          </div>
                          {t.description && (
                            <p
                              style={{
                                fontSize: 12,
                                color: "var(--muted)",
                                margin: 0,
                                lineHeight: 1.4,
                              }}
                            >
                              {t.description}
                            </p>
                          )}
                          {t.channels?.length > 0 && (
                            <div
                              style={{
                                display: "flex",
                                gap: 4,
                                flexWrap: "wrap",
                              }}
                            >
                              {t.channels.map((c) => (
                                <span
                                  key={c}
                                  style={{
                                    fontSize: 11,
                                    color: "var(--dim)",
                                    background: "rgba(255,255,255,.04)",
                                    border: "1px solid var(--border)",
                                    borderRadius: 4,
                                    padding: "1px 7px",
                                  }}
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Cross-channel themes */}
                {(result.crossChannelThemes?.length > 0 ||
                  result.crossChannelTopics?.length > 0) && (
                  <Card className="fu3" style={{ padding: 20 }}>
                    <SectionLabel>Cross-Channel Themes</SectionLabel>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginBottom: 12,
                      }}
                    >
                      {(
                        result.crossChannelThemes ||
                        result.crossChannelTopics ||
                        []
                      ).map((t, i) => (
                        <TopicChip key={i} label={t} color="purple" />
                      ))}
                    </div>
                    {result.notableThemes?.length > 0 && (
                      <>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--dim)",
                            textTransform: "uppercase",
                            letterSpacing: ".07em",
                            margin: "12px 0 8px",
                          }}
                        >
                          Notable themes
                        </div>
                        <div
                          style={{ display: "flex", flexWrap: "wrap", gap: 5 }}
                        >
                          {result.notableThemes.map((t, i) => (
                            <TopicChip key={i} label={t} color="teal" />
                          ))}
                        </div>
                      </>
                    )}
                    {result.emergingTopics?.length > 0 && (
                      <>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--amber)",
                            textTransform: "uppercase",
                            letterSpacing: ".07em",
                            margin: "12px 0 8px",
                          }}
                        >
                          ↑ Emerging
                        </div>
                        <div
                          style={{ display: "flex", flexWrap: "wrap", gap: 5 }}
                        >
                          {result.emergingTopics.map((t, i) => (
                            <TopicChip key={i} label={t} color="amber" />
                          ))}
                        </div>
                      </>
                    )}
                  </Card>
                )}

                {/* Key topics (single-channel summary) */}
                {result.keyTopics?.length > 0 && !result.perChannel && (
                  <Card className="fu3" style={{ padding: 20 }}>
                    <SectionLabel>Key Topics</SectionLabel>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {result.keyTopics.map((t, i) => (
                        <TopicChip
                          key={i}
                          label={t}
                          color={["blue", "purple", "teal", "amber"][i % 4]}
                        />
                      ))}
                    </div>
                  </Card>
                )}

                {/* Highlights */}
                {result.highlights?.length > 0 && (
                  <Card className="fu4" style={{ padding: 20 }}>
                    <SectionLabel>Key Insights</SectionLabel>
                    <InsightRow
                      items={result.highlights}
                      icon="◆"
                      iconColor="var(--accent)"
                    />
                  </Card>
                )}

                {/* Open questions */}
                {result.openQuestions?.length > 0 && (
                  <Card className="fu4" style={{ padding: 20 }}>
                    <SectionLabel>Open Questions</SectionLabel>
                    <InsightRow
                      items={result.openQuestions}
                      icon="?"
                      iconColor="var(--amber)"
                    />
                  </Card>
                )}

                {/* Keyword clusters */}
                {result.keywordClusters?.length > 0 && (
                  <Card className="fu4" style={{ padding: 20 }}>
                    <SectionLabel>Keyword Clusters</SectionLabel>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      {result.keywordClusters.slice(0, 4).map((kc, i) => (
                        <div key={i}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#93c5fd",
                              marginBottom: 6,
                            }}
                          >
                            {kc.cluster}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 4,
                            }}
                          >
                            {kc.keywords?.map((k, j) => (
                              <span
                                key={j}
                                style={{
                                  fontSize: 11,
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  background: "rgba(59,130,246,.07)",
                                  border: "1px solid rgba(59,130,246,.15)",
                                  color: "#7dd3fc",
                                }}
                              >
                                {k}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Sentiment drivers */}
                {result.sentimentDrivers?.length > 0 && (
                  <Card className="fu4" style={{ padding: 20 }}>
                    <SectionLabel>Sentiment Drivers</SectionLabel>
                    <InsightRow
                      items={result.sentimentDrivers}
                      icon="→"
                      iconColor="var(--muted)"
                    />
                  </Card>
                )}
              </div>

              {/* Sentiment breakdown bar — only if we have percentages */}
              {typeof result.positivePercent === "number" && (
                <Card className="fu4" style={{ padding: 20 }}>
                  <SectionLabel>Sentiment Breakdown</SectionLabel>
                  <SentimentBar
                    pos={result.positivePercent}
                    neg={result.negativePercent || 0}
                    neu={result.neutralPercent || 0}
                  />
                  {result.emotionalTone && (
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--muted)",
                        marginTop: 12,
                        marginBottom: 0,
                        lineHeight: 1.5,
                      }}
                    >
                      {result.emotionalTone}
                    </p>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      marginTop: 14,
                    }}
                  >
                    {result.mostPositiveTopics?.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--green)",
                            textTransform: "uppercase",
                            letterSpacing: ".07em",
                            marginBottom: 6,
                          }}
                        >
                          Most positive
                        </div>
                        <div
                          style={{ display: "flex", flexWrap: "wrap", gap: 5 }}
                        >
                          {result.mostPositiveTopics.map((t, i) => (
                            <TopicChip key={i} label={t} color="teal" />
                          ))}
                        </div>
                      </div>
                    )}
                    {result.mostNegativeTopics?.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--red)",
                            textTransform: "uppercase",
                            letterSpacing: ".07em",
                            marginBottom: 6,
                          }}
                        >
                          Most negative
                        </div>
                        <div
                          style={{ display: "flex", flexWrap: "wrap", gap: 5 }}
                        >
                          {result.mostNegativeTopics.map((t, i) => (
                            <TopicChip key={i} label={t} color="amber" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          );
        })()}

      {/* ── History ────────────────────────────────────────── */}
      <Card className="fu4" style={{ overflow: "hidden" }}>
        <CardHeader
          title="Analysis History"
          action={
            <button
              onClick={() =>
                api("/analytics/history?limit=10")
                  .then(setHist)
                  .catch(() => {})
              }
              style={{
                background: "transparent",
                color: "var(--muted)",
                fontSize: 16,
                cursor: "pointer",
                padding: 4,
                border: "none",
              }}
            >
              ↻
            </button>
          }
        />
        {histLoading ? (
          <div
            style={{ padding: 32, display: "flex", justifyContent: "center" }}
          >
            <Spinner />
          </div>
        ) : hist.length === 0 ? (
          <Empty msg="No analyses yet — run one above" />
        ) : (
          hist.map((h, i) => {
            const typeColors = {
              monthly_summary: "blue",
              trend_analysis: "purple",
              custom: "amber",
              sentiment_report: "teal",
            };
            const topicCount =
              h.result?.keyTopics?.length ||
              h.result?.trendingTopics?.length ||
              0;
            const chCount = Array.isArray(h.result?.channels)
              ? h.result.channels.length
              : null;
            return (
              <div
                key={h._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 22px",
                  borderBottom:
                    i < hist.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: "rgba(59,130,246,.08)",
                      border: "1px solid rgba(59,130,246,.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                    }}
                  >
                    {h.type === "monthly_summary"
                      ? "🧠"
                      : h.type === "trend_analysis"
                        ? "📈"
                        : "💬"}
                  </div>
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 3,
                      }}
                    >
                      <Badge color={typeColors[h.type] || "gray"}>
                        {h.type.replace("_", " ")}
                      </Badge>
                      {chCount && (
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          {chCount} channel{chCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--muted)",
                        display: "flex",
                        gap: 10,
                      }}
                    >
                      <span>{h.targetName}</span>
                      {topicCount > 0 && (
                        <span style={{ color: "var(--dim)" }}>
                          · {topicCount} topics extracted
                        </span>
                      )}
                      {h.result?.messageCount > 0 && (
                        <span style={{ color: "var(--dim)" }}>
                          · {h.result.messageCount.toLocaleString()} msgs
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--dim)",
                      fontFamily: "var(--mono)",
                    }}
                  >
                    {new Date(h.generatedAt).toLocaleDateString()}
                  </div>
                  <div
                    style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}
                  >
                    {new Date(h.generatedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

// ── SCRAPER JOBS ──────────────────────────────────────────────────────────────
function ScraperJobs() {
  const [jobs, setJobs] = useState([]);
  const [chs, setChs] = useState([]);
  const [form, setForm] = useState({
    type: "channel",
    id: "",
    owner: "",
    repo: "",
  });
  const [loading, setLoad] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/channels")
      .then(setChs)
      .catch(() => {});
    api("/scraper/jobs")
      .then(setJobs)
      .catch(() => {});
  }, []);

  const start = async () => {
    setLoad(true);
    setErr("");
    try {
      let d;
      if (form.type === "github")
        d = await api("/scraper/github", {
          method: "POST",
          body: JSON.stringify({
            owner: form.owner,
            repo: form.repo,
            includeComments: true,
          }),
        });
      else if (form.type === "channel")
        d = await api("/scraper/backfill/channel", {
          method: "POST",
          body: JSON.stringify({ channelId: form.id }),
        });
      else
        d = await api("/scraper/backfill/server", {
          method: "POST",
          body: JSON.stringify({ serverId: form.id }),
        });
      setJobs((j) => [
        {
          id: d.jobId || `j${Date.now()}`,
          status: "running",
          channelId: form.id || `${form.owner}/${form.repo}`,
          startedAt: new Date().toISOString(),
        },
        ...j,
      ]);
      setTimeout(
        () =>
          api("/scraper/jobs")
            .then(setJobs)
            .catch(() => {}),
        5000,
      );
    } catch (e) {
      setErr(e.message);
    }
    setLoad(false);
  };

  const SC = {
    completed: { c: "green", i: "✓" },
    running: { c: "blue", i: "↻" },
    failed: { c: "red", i: "✕" },
  };
  const ago = (iso) => {
    const d = Math.floor((Date.now() - new Date(iso)) / 6e4);
    return d < 60 ? `${d}m ago` : `${Math.floor(d / 60)}h ago`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="fu">
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
          Scraper Jobs
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          Trigger backfills and monitor progress
        </p>
      </div>

      <Card className="fu1" style={{ padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          Start New Job
        </div>
        {err && (
          <div style={{ marginBottom: 14 }}>
            <ErrBox msg={err} />
          </div>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            style={{ width: 180 }}
          >
            <option value="channel">Channel Backfill</option>
            <option value="server">Server Backfill</option>
            <option value="github">GitHub Import</option>
          </select>
          {form.type === "github" ? (
            <>
              <input
                value={form.owner}
                onChange={(e) =>
                  setForm((f) => ({ ...f, owner: e.target.value }))
                }
                placeholder="GitHub owner"
                style={{ width: 160 }}
              />
              <input
                value={form.repo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, repo: e.target.value }))
                }
                placeholder="Repo name"
                style={{ width: 180 }}
              />
            </>
          ) : (
            <select
              value={form.id}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              style={{ flex: 1 }}
            >
              <option value="">Select channel…</option>
              {chs.map((c) => (
                <option key={c.discordId} value={c.discordId}>
                  #{c.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={start}
            disabled={loading}
            style={{
              padding: "10px 24px",
              background: "linear-gradient(135deg,#3b82f6,#6366f1)",
              color: "white",
              borderRadius: 9,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              border: "none",
              opacity: loading ? 0.7 : 1,
              flexShrink: 0,
            }}
          >
            {loading ? "Starting…" : "Start →"}
          </button>
        </div>
      </Card>

      <Card className="fu2" style={{ overflow: "hidden" }}>
        <CardHeader
          title="Recent Jobs"
          action={
            <button
              onClick={() =>
                api("/scraper/jobs")
                  .then(setJobs)
                  .catch(() => {})
              }
              style={{
                background: "transparent",
                color: "var(--muted)",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              ↻
            </button>
          }
        />
        {jobs.length === 0 ? (
          <Empty msg="No jobs yet — start a backfill above" />
        ) : (
          jobs.map((j, i) => {
            const sc = SC[j.status] || SC.running;
            return (
              <div
                key={j.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "15px 20px",
                  borderBottom:
                    i < jobs.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background:
                        j.status === "completed"
                          ? "rgba(16,185,129,.12)"
                          : j.status === "running"
                            ? "rgba(59,130,246,.12)"
                            : "rgba(239,68,68,.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 15,
                      color:
                        j.status === "completed"
                          ? "var(--green)"
                          : j.status === "running"
                            ? "var(--accent)"
                            : "var(--red)",
                      animation:
                        j.status === "running"
                          ? "spin 1.5s linear infinite"
                          : "none",
                    }}
                  >
                    {sc.i}
                  </div>
                  <div>
                    <div
                      style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}
                    >
                      {j.channelId || j.serverId || j.id}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {j.count
                        ? `${j.count.toLocaleString()} messages`
                        : j.status === "running"
                          ? "In progress…"
                          : j.error || "Done"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {j.startedAt && (
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        fontFamily: "var(--mono)",
                      }}
                    >
                      {ago(j.startedAt)}
                    </span>
                  )}
                  <Badge color={sc.c}>{j.status}</Badge>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────
function Settings() {
  const [saved, setSaved] = useState(false);
  const F = ({ label, type = "text", placeholder, defaultValue = "" }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: ".06em",
        }}
      >
        {label}
      </label>
      <input
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </div>
  );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        maxWidth: 620,
      }}
    >
      <div className="fu">
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
          Settings
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          API keys and configuration
        </p>
      </div>
      {[
        {
          title: "Discord",
          e: "🤖",
          f: [
            { label: "Bot Token", type: "password", placeholder: "MTxxxxxxx…" },
          ],
        },
        {
          title: "Groq AI",
          e: "🧠",
          f: [
            { label: "API Key", type: "password", placeholder: "gsk_…" },
            {
              label: "Model",
              placeholder: "llama-3.3-70b-versatile",
              defaultValue: "llama-3.3-70b-versatile",
            },
          ],
        },
        {
          title: "GitHub",
          e: "🐙",
          f: [
            {
              label: "Personal Access Token",
              type: "password",
              placeholder: "ghp_…",
            },
          ],
        },
      ].map((s, i) => (
        <Card key={s.title} className={`fu${i + 1}`} style={{ padding: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 20,
            }}
          >
            <span style={{ fontSize: 20 }}>{s.e}</span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{s.title}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {s.f.map((f) => (
              <F key={f.label} {...f} />
            ))}
          </div>
        </Card>
      ))}
      <div
        className="fu4"
        style={{
          padding: "16px 20px",
          background: "rgba(59,130,246,.06)",
          border: "1px solid rgba(59,130,246,.15)",
          borderRadius: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          ℹ️ Note
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
          Edit{" "}
          <code
            style={{
              fontFamily: "var(--mono)",
              background: "rgba(255,255,255,.06)",
              padding: "1px 6px",
              borderRadius: 4,
            }}
          >
            backend/.env
          </code>{" "}
          directly and restart the server for changes to take effect.
        </p>
      </div>
      <button
        className="fu4"
        onClick={() => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        }}
        style={{
          alignSelf: "flex-start",
          padding: "12px 28px",
          background: saved
            ? "rgba(16,185,129,.2)"
            : "linear-gradient(135deg,#3b82f6,#6366f1)",
          border: saved ? "1px solid rgba(16,185,129,.4)" : "none",
          color: saved ? "var(--green)" : "white",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all .3s",
        }}
      >
        {saved ? "✓ Saved!" : "Save Configuration"}
      </button>
    </div>
  );
}

// ── HISTORY PAGE ─────────────────────────────────────────────────────────────
// Drop-in addition to your existing frontend file.
// 1. Add "history" to the NAV array:
//    { id:"history", icon:"◷", label:"History" }
// 2. Add History to PAGES map:
//    history: History
// 3. Paste this entire function into the file alongside the other page components.

function History() {
  const [timeline, setTimeline]   = useState([]);
  const [topics, setTopics]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState("");
  const [tab, setTab]             = useState("timeline");   // "timeline" | "topics"
  const [expanded, setExpanded]   = useState(new Set());
  const [detailItem, setDetail]   = useState(null);         // full detail modal
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch]       = useState("");

  useEffect(() => {
    Promise.all([
      api("/analytics/history/timeline?limit=200"),
      api("/analytics/history/topics"),
    ])
      .then(([tl, tp]) => { setTimeline(tl); setTopics(tp); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── helpers
  const sentColor = s =>
    s === "positive" ? "#10b981" :
    s === "negative" ? "#ef4444" :
    s === "mixed"    ? "#f59e0b" : "#64748b";

  const typeIcon = t =>
    t === "daily_summary"   ? "🧠" :
    t === "trend_analysis"  ? "📈" :
    t === "custom"          ? "💬" : "◎";

  const typeLabel = t =>
    t === "daily_summary"  ? "Summary" :
    t === "trend_analysis" ? "Trends"  :
    t === "custom"         ? "Ask AI"  : t;

  const confidenceColor = c =>
    c === "HIGH"   ? "#10b981" :
    c === "MEDIUM" ? "#f59e0b" : "#64748b";

  const ago = iso => {
    const d = Date.now() - new Date(iso).getTime();
    const h = Math.floor(d / 3.6e6);
    const days = Math.floor(h / 24);
    if (days > 30) return `${Math.floor(days/30)}mo ago`;
    if (days > 0)  return `${days}d ago`;
    if (h > 0)     return `${h}h ago`;
    return `${Math.floor(d/6e4)}m ago`;
  };

  // ── filter timeline items
  const filteredTimeline = timeline.map(month => ({
    ...month,
    items: month.items.filter(item => {
      if (filterType !== "all" && item.type !== filterType) return false;
      if (search) {
        const s = search.toLowerCase();
        const inTopics = [...item.keyTopics, ...item.trendingTopics].some(t => t.toLowerCase().includes(s));
        const inName   = item.targetName?.toLowerCase().includes(s);
        const inSummary = (item.summary || "").toLowerCase().includes(s);
        return inTopics || inName || inSummary;
      }
      return true;
    })
  })).filter(m => m.items.length > 0);

  // ── topic trend sparkline (simple bar)
  const Sparkline = ({ data }) => {
    if (!data?.length) return null;
    const max = Math.max(...data.map(d => d.count), 1);
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 24 }}>
        {data.slice(-12).map((d, i) => (
          <div
            key={i}
            title={`${d.month}: ${d.count}`}
            style={{
              width: 6, borderRadius: 2,
              height: `${Math.max(3, (d.count / max) * 24)}px`,
              background: `rgba(59,130,246,${0.3 + (d.count / max) * 0.7})`,
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    );
  };

  // ── Detail Modal
  const DetailModal = ({ item, onClose }) => (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.7)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)", padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 20, width: "100%", maxWidth: 680,
          maxHeight: "85vh", overflowY: "auto",
        }}
      >
        {/* Modal header */}
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: "var(--card)", zIndex: 1,
          borderRadius: "20px 20px 0 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{typeIcon(item.type)}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{typeLabel(item.type)}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {item.targetName} · {new Date(item.generatedAt).toLocaleString()}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", color: "var(--muted)", fontSize: 20, cursor: "pointer", border: "none", padding: 4 }}
          >✕</button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Channels */}
          {item.channels?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {item.channels.map(c => <Badge key={c} color="indigo">#{c}</Badge>)}
              {item.messageCount > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }}>
                  {item.messageCount.toLocaleString()} msgs
                </span>
              )}
            </div>
          )}

          {/* Sentiment */}
          {item.sentiment && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em" }}>Sentiment</span>
              <span style={{
                padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: `${sentColor(item.sentiment)}22`,
                color: sentColor(item.sentiment),
                border: `1px solid ${sentColor(item.sentiment)}44`,
              }}>{item.sentiment}</span>
            </div>
          )}

          {/* Summary */}
          {item.summary && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Summary</div>
              {Array.isArray(item.summary)
                ? item.summary.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}>•</span>
                      <span style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{s}</span>
                    </div>
                  ))
                : <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7, margin: 0 }}>{item.summary}</p>
              }
            </div>
          )}

          {/* Key Topics */}
          {[...item.keyTopics, ...item.trendingTopics].filter(Boolean).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Topics</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[...new Set([...item.keyTopics, ...item.trendingTopics])].map((t, i) => (
                  <span key={i} style={{
                    padding: "4px 11px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                    background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.2)", color: "#93c5fd"
                  }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Emerging Signals */}
          {item.emergingSignals?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Emerging Signals</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {item.emergingSignals.map((s, i) => (
                  <div key={i} style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: "rgba(255,255,255,.03)", border: "1px solid var(--border)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{s.signal}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                        background: `${confidenceColor(s.confidence)}22`,
                        color: confidenceColor(s.confidence),
                        border: `1px solid ${confidenceColor(s.confidence)}44`,
                        textTransform: "uppercase", letterSpacing: ".06em",
                      }}>{s.confidence}</span>
                    </div>
                    {s.description && <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px", lineHeight: 1.5 }}>{s.description}</p>}
                    {s.evidence && (
                      <div style={{ fontSize: 11, color: "var(--dim)", fontStyle: "italic", borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>
                        "{s.evidence}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Highlights */}
          {item.highlights?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Key Insights</div>
              {item.highlights.map((h, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <span style={{ color: "var(--green)", flexShrink: 0, marginTop: 2 }}>◆</span>
                  <span style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.55 }}>{h}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── TIMELINE TAB ────────────────────────────────────────────────────────────
  const TimelineTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {filteredTimeline.length === 0
        ? <Empty msg="No analyses match your filters" />
        : filteredTimeline.map((month, mi) => (
          <div key={month.month}>
            {/* Month header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 14, marginBottom: 16,
            }}>
              <div style={{
                padding: "6px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: "linear-gradient(135deg,rgba(59,130,246,.15),rgba(139,92,246,.1))",
                border: "1px solid rgba(59,130,246,.25)", color: "#93c5fd",
              }}>{month.label}</div>
              <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }}>
                {month.count} {month.count === 1 ? "analysis" : "analyses"}
              </span>
            </div>

            {/* Items in this month */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 16, borderLeft: "2px solid var(--border)" }}>
              {month.items.map((item, ii) => {
                const allTopics = [...new Set([...item.keyTopics, ...item.trendingTopics])];
                const isExpanded = expanded.has(item._id);

                return (
                  <div
                    key={item._id}
                    style={{
                      background: "var(--card)", border: "1px solid var(--border)",
                      borderRadius: 14, overflow: "hidden",
                      transition: "border-color .15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(59,130,246,.3)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                  >
                    {/* Item header row */}
                    <div
                      onClick={() => setExpanded(prev => {
                        const n = new Set(prev);
                        n.has(item._id) ? n.delete(item._id) : n.add(item._id);
                        return n;
                      })}
                      style={{
                        padding: "14px 18px", display: "flex", alignItems: "center",
                        gap: 12, cursor: "pointer",
                      }}
                    >
                      {/* Type icon */}
                      <div style={{
                        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                        background: "rgba(59,130,246,.08)", border: "1px solid rgba(59,130,246,.15)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                      }}>{typeIcon(item.type)}</div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <Badge color="blue">{typeLabel(item.type)}</Badge>
                          {item.sentiment && (
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5,
                              background: `${sentColor(item.sentiment)}18`,
                              color: sentColor(item.sentiment),
                              border: `1px solid ${sentColor(item.sentiment)}35`,
                            }}>{item.sentiment}</span>
                          )}
                          {item.channels?.length > 0 && (
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>
                              {item.channels.slice(0, 3).map(c => `#${c}`).join(", ")}
                              {item.channels.length > 3 ? ` +${item.channels.length - 3}` : ""}
                            </span>
                          )}
                        </div>
                        {/* Topic chips preview */}
                        {allTopics.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {allTopics.slice(0, 5).map((t, i) => (
                              <span key={i} style={{
                                fontSize: 11, padding: "2px 8px", borderRadius: 4,
                                background: "rgba(255,255,255,.05)", border: "1px solid var(--border)",
                                color: "var(--muted)",
                              }}>{t}</span>
                            ))}
                            {allTopics.length > 5 && (
                              <span style={{ fontSize: 11, color: "var(--dim)" }}>+{allTopics.length - 5} more</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                        {item.messageCount > 0 && (
                          <span style={{ fontSize: 11, color: "var(--dim)", fontFamily: "var(--mono)" }}>
                            {item.messageCount.toLocaleString()} msgs
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: "var(--dim)" }}>{ago(item.generatedAt)}</span>
                        {/* View detail button */}
                        <button
                          onClick={e => { e.stopPropagation(); setDetail(item); }}
                          style={{
                            padding: "5px 12px", background: "rgba(59,130,246,.1)",
                            border: "1px solid rgba(59,130,246,.2)", borderRadius: 7,
                            color: "#93c5fd", fontSize: 12, cursor: "pointer", fontFamily: "var(--font)",
                          }}
                        >View →</button>
                        <span style={{ color: "var(--muted)", fontSize: 14, transition: "transform .2s", transform: isExpanded ? "rotate(180deg)" : "none" }}>▾</span>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div style={{ padding: "0 18px 16px", borderTop: "1px solid var(--border)" }}>
                        {/* Summary */}
                        {item.summary && (
                          <div style={{ paddingTop: 14 }}>
                            {Array.isArray(item.summary)
                              ? item.summary.slice(0, 3).map((s, i) => (
                                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
                                    <span style={{ color: "var(--accent)", flexShrink: 0 }}>•</span>
                                    <span style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.55 }}>{s}</span>
                                  </div>
                                ))
                              : <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
                                  {typeof item.summary === "string" ? item.summary.substring(0, 300) + (item.summary.length > 300 ? "…" : "") : ""}
                                </p>
                            }
                          </div>
                        )}

                        {/* Emerging signals preview */}
                        {item.emergingSignals?.length > 0 && (
                          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>Signals</div>
                            {item.emergingSignals.slice(0, 3).map((s, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                  fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 700,
                                  background: `${confidenceColor(s.confidence)}22`,
                                  color: confidenceColor(s.confidence),
                                  border: `1px solid ${confidenceColor(s.confidence)}44`,
                                  textTransform: "uppercase", letterSpacing: ".05em", flexShrink: 0,
                                }}>{s.confidence}</span>
                                <span style={{ fontSize: 12, color: "#94a3b8" }}>{s.signal}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      }
    </div>
  );

  // ── TOPICS TAB ──────────────────────────────────────────────────────────────
  const TopicsTab = () => {
    const [topicSearch, setTopicSearch] = useState("");
    const filtered = topics.filter(t =>
      !topicSearch || t.label.toLowerCase().includes(topicSearch.toLowerCase())
    );

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <input
          value={topicSearch}
          onChange={e => setTopicSearch(e.target.value)}
          placeholder="Search topics…"
          style={{ maxWidth: 320 }}
        />

        {filtered.length === 0
          ? <Empty msg="No topics found" />
          : (
            <Card style={{ overflow: "hidden" }}>
              <CardHeader
                title="Topic Frequency Over Time"
                action={<Badge color="gray">{filtered.length} topics</Badge>}
              />
              {filtered.map((topic, i) => (
                <div
                  key={i}
                  style={{
                    padding: "14px 20px",
                    borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                    display: "flex", alignItems: "center", gap: 16,
                  }}
                >
                  {/* Rank */}
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    background: i < 3 ? "rgba(59,130,246,.15)" : "rgba(255,255,255,.04)",
                    border: `1px solid ${i < 3 ? "rgba(59,130,246,.3)" : "var(--border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700,
                    color: i < 3 ? "#93c5fd" : "var(--muted)",
                  }}>#{i + 1}</div>

                  {/* Topic name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {topic.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      Appeared in {topic.monthlyData.length} month{topic.monthlyData.length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Sparkline */}
                  <Sparkline data={topic.monthlyData} />

                  {/* Count */}
                  <div style={{
                    fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)",
                    color: "#93c5fd", minWidth: 32, textAlign: "right",
                  }}>{topic.totalCount}</div>
                </div>
              ))}
            </Card>
          )
        }
      </div>
    );
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {detailItem && <DetailModal item={detailItem} onClose={() => setDetail(null)} />}

      {/* Header */}
      <div className="fu" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Analysis History</h2>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            Track discussions over time · {timeline.reduce((s, m) => s + m.count, 0)} total analyses
          </p>
        </div>
        <div style={{ display: "flex", gap: 3, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 4 }}>
          {[["timeline", "◷ Timeline"], ["topics", "◈ Topics"]].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "7px 18px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer",
              background: tab === t ? "rgba(59,130,246,.2)" : "transparent",
              color: tab === t ? "#93c5fd" : "var(--muted)",
              border: tab === t ? "1px solid rgba(59,130,246,.3)" : "1px solid transparent",
              transition: "all .15s", fontFamily: "var(--font)",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Filters — only on timeline tab */}
      {tab === "timeline" && (
        <div className="fu1" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, position: "relative", minWidth: 200 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}>⌕</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search topics, channels, summaries…"
              style={{ paddingLeft: 36 }}
            />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 160 }}>
            <option value="all">All Types</option>
            <option value="daily_summary">Summary</option>
            <option value="trend_analysis">Trends</option>
            <option value="custom">Ask AI</option>
          </select>
          <button
            onClick={() => { setSearch(""); setFilterType("all"); }}
            style={{ padding: "10px 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--muted)", fontSize: 13, cursor: "pointer" }}
          >Clear</button>
        </div>
      )}

      {/* Stats row */}
      {!loading && tab === "timeline" && (
        <div className="fu2" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[
            { label: "Total Analyses",  val: timeline.reduce((s, m) => s + m.count, 0), icon: "◎" },
            { label: "Months Tracked",  val: timeline.length, icon: "◷" },
            { label: "Topics Extracted", val: topics.length, icon: "◈" },
            { label: "Latest",
              val: timeline[0]?.label || "—",
              icon: "◆", small: true },
          ].map((c, i) => (
            <div key={i} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 12, padding: "14px 18px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em" }}>{c.label}</span>
                <span style={{ opacity: .4 }}>{c.icon}</span>
              </div>
              <div style={{ fontSize: c.small ? 14 : 22, fontWeight: 700, color: "#93c5fd" }}>{c.val}</div>
            </div>
          ))}
        </div>
      )}

      {err && <ErrBox msg={err} />}

      {loading
        ? <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}><Spinner size={36} /></div>
        : tab === "timeline" ? <TimelineTab /> : <TopicsTab />
      }
    </div>
  );
}



// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("overview");
  const [user, setUser] = useState(null);

  if (!user)
    return (
      <>
        <style>{CSS}</style>
        <Login
          onLogin={(u, t) => {
            setToken(t);
            setUser(u);
          }}
        />
      </>
    );
  // AFTER
  const PAGES = {
    overview: Overview,
    servers: Servers,
    analytics: Analytics,
    scraper: ScraperJobs,
    settings: Settings,
    history: History,
    subnets: SubnetIntel,

  };
  const Page = PAGES[page] || Overview;

  return (
    <>
      <style>{CSS}</style>
      <div
        className="noise"
        style={{ display: "flex", height: "100vh", overflow: "hidden" }}
      >
        <Sidebar
          active={page}
          onNav={setPage}
          user={user}
          onLogout={() => {
            setToken("");
            setUser(null);
          }}
        />
        <main style={{ flex: 1, overflowY: "auto", padding: "32px 36px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <Page key={page} user={user} />
          </div>
        </main>
      </div>
    </>
  );
}
