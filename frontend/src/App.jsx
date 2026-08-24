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
import { useRef } from "react";
import {
  SUBNET_META,
  getSubnetMeta,
  extractCleanName,
} from "./utils/subnetMeta_clean";

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
// Set REACT_APP_API_URL at BUILD time (CRA inlines it — it is not read at
// runtime). Leave it unset for local dev and requests go to the CRA dev-server
// proxy in package.json. In production point it at the deployed API, e.g.
//   REACT_APP_API_URL=https://api.example.com/api
// When the API is served from the same origin behind nginx, "/api" is correct.
const BASE = process.env.REACT_APP_API_URL || "/api";
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
  if (!res.ok) throw new Error(data.message || data.error || "Request failed");
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

// ── Lightweight markdown renderer for AI answers ──────────────────────────────
// Handles bold (**x**), inline `code`, headings (#), and bullet / numbered lists
// so AI responses read cleanly instead of showing raw markdown. No dependencies.
function renderInline(text, keyBase = "") {
  const nodes = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m;
  let k = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(
        <strong key={`${keyBase}b${k++}`} style={{ color: "#e2e8f0", fontWeight: 600 }}>
          {tok.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code
          key={`${keyBase}c${k++}`}
          style={{
            fontFamily: "var(--mono)",
            fontSize: 12,
            background: "rgba(255,255,255,.06)",
            padding: "1px 5px",
            borderRadius: 4,
          }}
        >
          {tok.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function RichText({ text, style = {} }) {
  const lines = String(text || "").split("\n");
  const blocks = [];
  let list = null;
  const flush = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.*)/);
    const numbered = line.match(/^\d+[.)]\s+(.*)/);
    const heading = line.match(/^#{1,3}\s+(.*)/);
    if (bullet) {
      if (!list || list.type !== "ul") {
        flush();
        list = { type: "ul", items: [] };
      }
      list.items.push(bullet[1]);
    } else if (numbered) {
      if (!list || list.type !== "ol") {
        flush();
        list = { type: "ol", items: [] };
      }
      list.items.push(numbered[1]);
    } else if (heading) {
      flush();
      blocks.push({ type: "h", text: heading[1] });
    } else {
      flush();
      blocks.push({ type: "p", text: line });
    }
  }
  flush();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, ...style }}>
      {blocks.map((b, i) => {
        if (b.type === "h")
          return (
            <div
              key={i}
              style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 13.5, marginTop: i ? 4 : 0 }}
            >
              {renderInline(b.text, `h${i}`)}
            </div>
          );
        if (b.type === "p")
          return <div key={i}>{renderInline(b.text, `p${i}`)}</div>;
        const isOl = b.type === "ol";
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {b.items.map((it, j) => (
              <div key={j} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span
                  style={{
                    color: "var(--accent2)",
                    flexShrink: 0,
                    fontWeight: 600,
                    fontSize: isOl ? 12 : 15,
                    lineHeight: 1.6,
                    minWidth: isOl ? 16 : 8,
                  }}
                >
                  {isOl ? `${j + 1}.` : "•"}
                </span>
                <span style={{ flex: 1 }}>{renderInline(it, `l${i}_${j}`)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

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
  { id: "subnets", icon: "⬡", label: "Subnet Intel" },
  { id: "servers", icon: "◈", label: "Servers" },
  { id: "analytics", icon: "◆", label: "AI Insights" },
  { id: "settings", icon: "◐", label: "Subnet Settings" },   // ← uncommented
  // { id: "history", icon: "◷", label: "History" },
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






// import { useState, useEffect } from "react";

// Deterministically map a category name → a Badge color so the same category
// always renders in the same accent everywhere.
const CAT_COLORS = ["blue", "green", "purple", "amber", "cyan", "indigo", "red"];
// The only categories the app recognises — used for filters and the editor dropdown.
const SUBNET_CATEGORIES = ["Portfolio", "Contender", "Others", "Not Eligible"];
// Fixed accents for the standard categories; custom categories fall back to a hash.
const CAT_FIXED = {
  Portfolio: "green",
  Contender: "blue",
  Others: "gray",
  "Not Eligible": "red",
  Normal: "gray",
};
function catColor(name) {
  if (!name) return "gray";
  if (CAT_FIXED[name]) return CAT_FIXED[name];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CAT_COLORS[h % CAT_COLORS.length];
}

const SubnetSettings = () => {
  const [configs, setConfigs] = useState([]);
  const [editing, setEditing] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState({}); // subnetNumber -> bool
  const [saved, setSaved] = useState({}); // subnetNumber -> bool (recently saved)
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setErr("");
    try {
      const c = await api("/subnet-config");
      setConfigs(c);
    } catch (e) {
      setErr(e.message || "Failed to load subnet settings");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (subnetNumber, field, value) => {
    const meta = SUBNET_META[subnetNumber];
    const catalogBase = meta
      ? {
          subnetNumber,
          name: meta.name,
          category: meta.category || "Others",
          description: meta.description || "",
        }
      : { subnetNumber };
    setEditing((prev) => ({
      ...prev,
      [subnetNumber]: {
        ...catalogBase,
        ...(configs.find((c) => c.subnetNumber === subnetNumber) || {}),
        ...(prev[subnetNumber] || {}),
        [field]: value,
      },
    }));
  };

  const handleCancel = (subnetNumber) => {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[subnetNumber];
      return next;
    });
  };

  const handleSave = async (subnetNumber) => {
    const edit = editing[subnetNumber];
    if (!edit) return;
    setSaving((p) => ({ ...p, [subnetNumber]: true }));
    setErr("");
    try {
      await api(`/subnet-config/${subnetNumber}`, {
        method: "PUT",
        body: JSON.stringify({
          name: edit.name,
          category: edit.category,
          description: edit.description,
          githubRepos: edit.githubRepos ?? [],
        }),
      });
      handleCancel(subnetNumber);
      await fetchAll();
      setSaved((p) => ({ ...p, [subnetNumber]: true }));
      setTimeout(
        () =>
          setSaved((p) => {
            const n = { ...p };
            delete n[subnetNumber];
            return n;
          }),
        1800,
      );
    } catch (e) {
      setErr(e.message || "Save failed");
    } finally {
      setSaving((p) => {
        const n = { ...p };
        delete n[subnetNumber];
        return n;
      });
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setErr("");
    try {
      await api("/subnet-config/seed", { method: "POST" });
      await fetchAll();
    } catch (e) {
      setErr(e.message || "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const allCatNames = SUBNET_CATEGORIES;

  // Show ALL known subnets: start from the full static catalog, then overlay any
  // saved DB config (which wins). This means the page lists every subnet even
  // before it has been seeded/edited, instead of only the rows present in the DB.
  const mergedSubnets = (() => {
    const byNum = {};
    for (const [numStr, meta] of Object.entries(SUBNET_META)) {
      const n = Number(numStr);
      byNum[n] = {
        subnetNumber: n,
        name: meta.name,
        category: meta.category || "Others",
        description: meta.description || "",
      };
    }
    for (const c of configs) {
      const base = byNum[c.subnetNumber] || { subnetNumber: c.subnetNumber };
      byNum[c.subnetNumber] = {
        ...base,
        ...c,
        // Ignore stale/invalid categories from old data — fall back to catalog.
        category: SUBNET_CATEGORIES.includes(c.category)
          ? c.category
          : base.category || "Others",
      };
    }
    return Object.values(byNum).sort(
      (a, b) => a.subnetNumber - b.subnetNumber,
    );
  })();

  const filtered = mergedSubnets.filter((c) => {
    const cur = editing[c.subnetNumber] || c;
    const q = search.trim().toLowerCase();
    const matchesQ =
      !q ||
      String(c.subnetNumber).includes(q) ||
      (cur.name || "").toLowerCase().includes(q) ||
      (cur.category || "").toLowerCase().includes(q);
    const matchesCat =
      catFilter === "all" || (cur.category || "Others") === catFilter;
    return matchesQ && matchesCat;
  });

  const dirtyCount = Object.keys(editing).length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        maxWidth: 1000,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Header */}
      <div
        className="fu"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            Subnet Settings
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            Rename subnets, set categories &amp; descriptions · applied across
            intel reports
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Badge color="gray">
            {mergedSubnets.length} subnet
            {mergedSubnets.length !== 1 ? "s" : ""}
          </Badge>
          <button
            onClick={handleSeed}
            disabled={seeding}
            title="Populate settings from the live subnet channels (won't overwrite existing edits)"
            style={{
              padding: "8px 16px",
              background: "rgba(59,130,246,.12)",
              color: "#93c5fd",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: seeding ? "not-allowed" : "pointer",
              border: "1px solid rgba(59,130,246,.3)",
              opacity: seeding ? 0.5 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {seeding ? "Loading…" : "⟳ Load subnets"}
          </button>
        </div>
      </div>

      {err && <ErrBox msg={err} />}

      {/* Toolbar */}
      <div
        className="fu1"
        style={{ display: "flex", gap: 10, alignItems: "center" }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <span
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
              fontSize: 15,
              pointerEvents: "none",
            }}
          >
            ⌕
          </span>
          <input
            placeholder="Search by number, name, or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          style={{ width: 210 }}
        >
          <option value="all">All categories</option>
          {allCatNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
          <Spinner size={36} />
        </div>
      ) : filtered.length === 0 ? (
        <Card style={{ padding: 52 }}>
          <Empty msg="No subnets match your filters" />
        </Card>
      ) : (
        <Card className="fu2" style={{ overflow: "hidden" }}>
          <CardHeader
            title={`Subnets · ${filtered.length}`}
            action={
              dirtyCount > 0 ? (
                <Badge color="amber">{dirtyCount} unsaved</Badge>
              ) : null
            }
          />
          <div>
            {filtered.map((c, i) => {
              const cur = editing[c.subnetNumber] || c;
              const isDirty = !!editing[c.subnetNumber];
              const isSaving = !!saving[c.subnetNumber];
              const justSaved = !!saved[c.subnetNumber];
              const options = Array.from(
                new Set([...allCatNames, cur.category].filter(Boolean)),
              );
              return (
                <div
                  key={c.subnetNumber}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "52px 1fr 220px 110px",
                    gap: 16,
                    alignItems: "start",
                    padding: "16px 20px",
                    borderBottom:
                      i < filtered.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                    borderLeft: isDirty
                      ? "2px solid var(--accent)"
                      : "2px solid transparent",
                    background: isDirty ? "rgba(59,130,246,.03)" : "transparent",
                    transition: "background .15s",
                  }}
                >
                  {/* SN chip */}
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#93c5fd",
                      background: "rgba(59,130,246,.1)",
                      border: "1px solid rgba(59,130,246,.2)",
                      borderRadius: 8,
                      height: 40,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {c.subnetNumber}
                  </div>

                  {/* Name + description */}
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <input
                      value={cur.name || ""}
                      placeholder="Subnet name"
                      onChange={(e) =>
                        updateField(c.subnetNumber, "name", e.target.value)
                      }
                    />
                    <input
                      value={cur.description || ""}
                      placeholder="Short description (optional)"
                      onChange={(e) =>
                        updateField(
                          c.subnetNumber,
                          "description",
                          e.target.value,
                        )
                      }
                      style={{ fontSize: 13, color: "var(--muted)" }}
                    />
                    <input
                      value={
                        Array.isArray(cur.githubRepos)
                          ? cur.githubRepos.join(", ")
                          : cur.githubRepos || ""
                      }
                      placeholder="GitHub repos — owner/repo, comma-separated"
                      onChange={(e) =>
                        updateField(
                          c.subnetNumber,
                          "githubRepos",
                          e.target.value,
                        )
                      }
                      style={{
                        fontSize: 12,
                        color: "#c4b5fd",
                        fontFamily: "var(--mono)",
                      }}
                    />
                  </div>

                  {/* Category */}
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <select
                      value={cur.category || "Others"}
                      onChange={(e) =>
                        updateField(c.subnetNumber, "category", e.target.value)
                      }
                    >
                      {options.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Actions / status */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      alignItems: "stretch",
                      justifyContent: "center",
                      minHeight: 40,
                    }}
                  >
                    {isDirty ? (
                      <>
                        <button
                          onClick={() => handleSave(c.subnetNumber)}
                          disabled={isSaving}
                          style={{
                            padding: "8px 0",
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#fff",
                            background: "linear-gradient(135deg,#3b82f6,#6366f1)",
                            opacity: isSaving ? 0.6 : 1,
                            cursor: isSaving ? "not-allowed" : "pointer",
                          }}
                        >
                          {isSaving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => handleCancel(c.subnetNumber)}
                          disabled={isSaving}
                          style={{
                            padding: "7px 0",
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 500,
                            color: "var(--muted)",
                            background: "transparent",
                            border: "1px solid var(--border)",
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : justSaved ? (
                      <div style={{ textAlign: "center" }}>
                        <Badge color="green">✓ Saved</Badge>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center" }}>
                        <Badge color={catColor(cur.category)}>
                          {cur.category || "Others"}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};











// ── SUBNET INTELLIGENCE v2 ────────────────────────────────────────────────────
// NAV:   { id:"subnets", icon:"⬡", label:"Subnet Intel" }
// PAGES: subnets: SubnetIntel

function SubnetIntel() {
  const [tab, setTab] = useState("today");
  const [todayReports, setToday] = useState([]);
  const [allReports, setAll] = useState([]);
  const [leaderboard, setLb] = useState([]);
  const [schedule, setSched] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [err, setErr] = useState("");
  const [openReport, setOpen] = useState(null); // full detail modal
  const [configMap, setConfigMap] = useState({}); // subnet -> { name, category, description }

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const [today, lb, sc, cfg] = await Promise.all([
        api("/subnets/today"),
        api("/subnets/leaderboard"),
        api("/subnets/schedule"),
        api("/subnet-config"),
      ]);
      setToday(today);
      setLb(lb);
      setSched(sc);
      const map = {};
      for (const c of cfg) map[c.subnetNumber] = c;
      setConfigMap(map);
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const runNow = async (nums = null) => {
    setRunning(true);
    try {
      await api("/subnets/run", {
        method: "POST",
        body: JSON.stringify({ subnetNumbers: nums }),
      });
      setTimeout(load, 4000);
    } catch (e) {
      setErr(e.message);
    }
    setRunning(false);
  };

  const pauseAnalysis = async (days = null) => {
    setPausing(true);
    setErr("");
    try {
      await api("/subnets/pause", {
        method: "POST",
        body: JSON.stringify(days ? { days } : {}),
      });
      await load();
    } catch (e) {
      setErr(e.message);
    }
    setPausing(false);
  };

  const resumeAnalysis = async () => {
    setPausing(true);
    setErr("");
    try {
      await api("/subnets/resume", { method: "POST" });
      await load();
    } catch (e) {
      setErr(e.message);
    }
    setPausing(false);
  };

  // ── colour helpers
  // Score color: 8 and above is green, anything below 8 is blue.
  const scoreColor = (s) => (s >= 8 ? "#10b981" : "#3b82f6");

  const sentColor = (s) =>
    s === "positive"
      ? "#10b981"
      : s === "negative"
        ? "#ef4444"
        : s === "mixed"
          ? "#f59e0b"
          : "#64748b";

  const confColor = (c) =>
    c === "HIGH" ? "#10b981" : c === "MEDIUM" ? "#f59e0b" : "#64748b";

  // Map a raw backend error into a short, user-facing reason.
  const friendlyError = (msg) => {
    const m = (msg || "").toLowerCase();
    if (/rate.?limit|\b429\b|quota|exceed|too many/.test(m))
      return "Limit exceeded — try again later";
    if (/timeout|timed out|etimedout|econnreset/.test(m))
      return "Timed out — try again";
    if (/json|parse/.test(m)) return "Analysis error — couldn't read the report";
    if (/not enough|no data|insufficient/.test(m))
      return "Not enough messages to analyze";
    return "Something went wrong";
  };

  // ── Score ring SVG
  const ScoreRing = ({ score, size = 60 }) => {
    if (!score) return null;
    const r = size / 2 - 6;
    const circ = 2 * Math.PI * r;
    const dash = (score / 10) * circ;
    return (
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          flexShrink: 0,
        }}
      >
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,.07)"
            strokeWidth={5}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={scoreColor(score)}
            strokeWidth={5}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: size > 52 ? 15 : 11,
              fontWeight: 800,
              color: scoreColor(score),
              fontFamily: "var(--mono)",
              lineHeight: 1,
            }}
          >
            {score?.toFixed(1)}
          </span>
          <span
            style={{
              fontSize: 8,
              color: "var(--muted)",
              textTransform: "uppercase",
            }}
          >
            /10
          </span>
        </div>
      </div>
    );
  };

  // ── Mini breakdown bar
  const MiniBar = ({ label, value }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 5,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "var(--muted)",
          width: 170,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 5,
          borderRadius: 3,
          background: "rgba(255,255,255,.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${(value / 10) * 100}%`,
            height: "100%",
            background: scoreColor(value),
            borderRadius: 3,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: scoreColor(value),
          fontFamily: "var(--mono)",
          width: 26,
          textAlign: "right",
        }}
      >
        {value?.toFixed(1)}
      </span>
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────────
  // TODAY CARD — brief, clickable
  // ────────────────────────────────────────────────────────────────────────────
 const TodayTabContent = ({
  todayReports,
  setOpen,
  scoreColor,
  sentColor,
  ScoreRing,
  configMap = {}, // ← NEW: { [subnetNumber]: { name, category } }
}) => {
  // Sort ascending: subnet 1 first, subnet 150 last
  const sorted = [...todayReports].sort(
    (a, b) => a.subnetNumber - b.subnetNumber,
  );

  return sorted.length === 0 ? (
    <Card style={{ padding: 52 }}>
      <Empty msg="No reports yet — go to Schedule tab and click Run to generate today's analysis" />
    </Card>
  ) : (
    <>
      {/* Date header */}
      <div
        style={{
          padding: "20px 28px",
          background:
            "linear-gradient(135deg, rgba(59,130,246,.08), rgba(139,92,246,.05))",
          border: "1px solid rgba(59,130,246,.15)",
          borderRadius: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: ".12em",
            marginBottom: 6,
          }}
        >
          Daily Intelligence Report
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            background: "linear-gradient(135deg,#60a5fa,#a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: "-.5px",
          }}
        >
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
          {sorted.length} subnet{sorted.length !== 1 ? "s" : ""} analyzed
          today
        </div>
      </div>

      <Card style={{ overflow: "hidden" }}>
        {sorted.map((r, i) => {
          const rpt = r.report?.report || r.report || {};
          const score = rpt.investabilityScore;

          // ── Resolve display name: client config > hardcoded meta > AI name > channel name cleanup
          const config = configMap[r.subnetNumber];
          const meta = SUBNET_META[r.subnetNumber];
          const displayName =
            config?.name ||
            meta?.name ||
            rpt.subnetName ||
            extractCleanName(r.channelName) ||
            r.channelName;

          // ── Resolve description: hardcoded meta > AI brief > AI one-liner
          const description =
            meta?.description ||
            rpt.briefDescription ||
            rpt.oneLiner ||
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
                  i < sorted.length - 1 ? "1px solid var(--border)" : "none",
                cursor: "pointer",
                transition: "background .12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,.025)";
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

              {/* Subnet Number badge */}
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

              {/* Name + Category + Description */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    marginBottom: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>{displayName}</span>
                  {config?.category && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 5,
                        background: "rgba(167,139,250,.15)",
                        border: "1px solid rgba(167,139,250,.3)",
                        color: "#c4b5fd",
                        textTransform: "uppercase",
                        letterSpacing: ".05em",
                      }}
                    >
                      {config.category}
                    </span>
                  )}
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

              {/* Sentiment pill */}
              {rpt.overallSentiment && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 10px",
                    borderRadius: 5,
                    flexShrink: 0,
                    background: `${sentColor(rpt.overallSentiment)}18`,
                    color: sentColor(rpt.overallSentiment),
                    border: `1px solid ${sentColor(rpt.overallSentiment)}35`,
                  }}
                >
                  {rpt.overallSentiment}
                </span>
              )}

              {/* Score ring */}
              <ScoreRing score={score} size={52} />

              {/* Arrow */}
              <span
                style={{ color: "var(--muted)", fontSize: 16, flexShrink: 0 }}
              >
                →
              </span>
            </div>
          );
        })}
      </Card>
    </>
  );
};

  // ────────────────────────────────────────────────────────────────────────────
  // FULL REPORT MODAL
  // ────────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  // REPLACEMENT: Full ReportModal component
  // Drop this in place of the existing ReportModal inside SubnetIntel.jsx
  // ─────────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────────
  // REPLACEMENT: ReportModal component
  // Changes:
  //   1. Header uses SUBNET_META clean name + description
  //   2. Bottom analysis cards replaced with flowing paragraph + bullet layout
  //   3. Positives/Concerns also get bullet-point detail paragraphs
  // ─────────────────────────────────────────────────────────────────────────────
  const ReportModal = ({ r, onClose }) => {
    const rpt = r.report?.report || r.report || {}; // ← this line is missing
    const score = rpt.investabilityScore;
    // Header shows the FINAL combined verdict (Discord + GitHub); the Investability
    // Analysis section below keeps the Discord-only `score`. Falls back to the
    // Discord score when no verdict was computed.
    const headerScore = rpt.combinedVerdict?.combinedScore ?? rpt.investabilityScore;
    const headerLabel = rpt.combinedVerdict?.scoreLabel || rpt.scoreLabel;
    const bd = rpt.investabilityBreakdown || {};
    const raiseTo9 = Array.isArray(rpt.raiseTo9)
      ? rpt.raiseTo9
      : rpt.raiseTo9
      ? [rpt.raiseTo9]
      : [];
    const mom = rpt.monthOverMonth?.hasPrevious ? rpt.monthOverMonth : null;
    const momPrevDate = mom?.previousDate
      ? new Date(mom.previousDate).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

   const config = configMap[r.subnetNumber];
    const subnetMeta = SUBNET_META[r.subnetNumber];
    const displayName =
      config?.name ||
      subnetMeta?.name ||
      rpt.subnetName ||
      extractCleanName(r.channelName) ||
      r.channelName;
    const metaDescription =
      config?.description ||
      subnetMeta?.description ||
      rpt.briefDescription ||
      null;

    const [chatMessages, setChatMsgs] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoad] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    const sendChat = async () => {
      if (!chatInput.trim() || chatLoading) return;
      const q = chatInput.trim();
      setChatInput("");
      setChatMsgs((prev) => [...prev, { role: "user", content: q }]);
      setChatLoad(true);
      try {
        const res = await api(`/subnets/chat/${r.subnetNumber}`, {
          method: "POST",
          body: JSON.stringify({ question: q, days: 30 }),
        });
        setChatMsgs((prev) => [
          ...prev,
          { role: "assistant", content: res.answer },
        ]);
      } catch (e) {
        setChatMsgs((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${e.message}` },
        ]);
      }
      setChatLoad(false);
    };

    const PRESETS = [
      "What are the main topics discussed?",
      "Evaluate the investability and give it a score 1-10.",
      "What improvements have been made since last month?",
      "What are the most important developments to watch?",
      "What technical issues are users facing?",
      "What is the community sentiment about this subnet?",
    ];

    // ── Section wrapper
    const Section = ({ icon, title, children, accentColor = "#3b82f6" }) => (
      <div style={{ marginBottom: 36 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 18,
            paddingBottom: 12,
            borderBottom: `2px solid ${accentColor}30`,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              flexShrink: 0,
              background: `${accentColor}18`,
              border: `1px solid ${accentColor}35`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            {icon}
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#e2e8f0",
              textTransform: "uppercase",
              letterSpacing: ".1em",
            }}
          >
            {title}
          </span>
        </div>
        {children}
      </div>
    );

    // ── Topic block with numbered heading + bullets
    const TopicBlock = ({ topic, index }) => (
      <div
        style={{
          marginBottom: 24,
          paddingBottom: 24,
          borderBottom: "1px solid rgba(255,255,255,.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              flexShrink: 0,
              background: "rgba(59,130,246,.15)",
              border: "1px solid rgba(59,130,246,.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "#60a5fa",
              fontFamily: "var(--mono)",
              marginTop: 1,
            }}
          >
            {index + 1}
          </div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#f1f5f9",
              margin: 0,
              lineHeight: 1.4,
              flex: 1,
            }}
          >
            {topic.title}
          </h3>
        </div>
        {topic.description && (
          <p
            style={{
              fontSize: 14,
              color: "#94a3b8",
              margin: "0 0 12px 38px",
              lineHeight: 1.75,
            }}
          >
            {topic.description}
          </p>
        )}
        {topic.bulletPoints?.length > 0 && (
          <ul
            style={{
              margin: "0 0 0 38px",
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            {topic.bulletPoints.map((bp, j) => (
              <li
                key={j}
                style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "#3b82f6",
                    flexShrink: 0,
                    marginTop: 8,
                  }}
                />
                <span
                  style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}
                >
                  {bp}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );

    // ── Prose block — label + paragraph text (replaces the old grid cards)
    const ProseBlock = ({ label, labelColor = "#93c5fd", text, prefix }) => {
      if (!text) return null;
      // Split on ". " to turn long sentences into readable bullet points
      const sentences = text
        .split(/(?<=\.)\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

      return (
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: labelColor,
              textTransform: "uppercase",
              letterSpacing: ".08em",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {prefix && <span>{prefix}</span>}
            {label}
          </div>
          {sentences.length > 1 ? (
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {sentences.map((s, i) => (
                <li
                  key={i}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: labelColor,
                      flexShrink: 0,
                      marginTop: 8,
                      opacity: 0.6,
                    }}
                  />
                  <span
                    style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.75 }}
                  >
                    {s}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p
              style={{
                fontSize: 13,
                color: "#cbd5e1",
                margin: 0,
                lineHeight: 1.75,
              }}
            >
              {text}
            </p>
          )}
        </div>
      );
    };

    return (
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.85)",
          zIndex: 1000,
          overflowY: "auto",
          padding: "20px 16px",
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: 900,
            margin: "0 auto",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 22,
            overflow: "hidden",
          }}
        >
          {/* ── STICKY MODAL HEADER */}
          <div
            style={{
              padding: "22px 28px",
              borderBottom: "1px solid var(--border)",
              background: `linear-gradient(135deg,${scoreColor(headerScore)}0d,transparent)`,
              display: "flex",
              alignItems: "center",
              gap: 16,
              position: "sticky",
              top: 0,
              zIndex: 10,
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 14,
                flexShrink: 0,
                background: `${scoreColor(headerScore)}20`,
                border: `1px solid ${scoreColor(headerScore)}45`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 800,
                color: scoreColor(headerScore),
                fontFamily: "var(--mono)",
              }}
            >
              {r.subnetNumber}
            </div>

            <div style={{ flex: 1 }}>
              {/* ── Clean name from SUBNET_META */}
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>
                {displayName}
              </h2>
              {/* ── Clean description from SUBNET_META */}
              {metaDescription && (
                <div
                  style={{
                    padding: "10px 16px",
                    borderRadius: 9,
                    margin: "6px 0 4px",
                    background: "rgba(59,130,246,.06)",
                    borderLeft: "3px solid rgba(59,130,246,.5)",
                    borderTop: "1px solid rgba(59,130,246,.12)",
                    borderBottom: "1px solid rgba(59,130,246,.12)",
                    borderRight: "none",
                    fontSize: 13,
                    color: "#93c5fd",
                    fontStyle: "italic",
                    lineHeight: 1.7,
                  }}
                >
                  {metaDescription}
                </div>
              )}
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                Subnet {r.subnetNumber} ·{" "}
                {new Date(r.reportDate || r.generatedAt).toLocaleDateString(
                  "en-US",
                  {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  },
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
              }}
            >
              <ScoreRing score={headerScore} size={72} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: scoreColor(headerScore),
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                }}
              >
                {headerLabel}
              </span>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                color: "var(--muted)",
                fontSize: 22,
                cursor: "pointer",
                border: "none",
                padding: "0 4px",
                marginLeft: 8,
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: "28px 28px 0" }}>
            {/* ── DOCUMENT META STRIP */}
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 24,
                padding: "14px 18px",
                background: "rgba(255,255,255,.025)",
                border: "1px solid rgba(255,255,255,.07)",
                borderRadius: 12,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 5,
                  background: "rgba(99,102,241,.15)",
                  border: "1px solid rgba(99,102,241,.3)",
                  color: "#a5b4fc",
                  letterSpacing: ".05em",
                }}
              >
                SN{r.subnetNumber}
              </span>
              {rpt.overallSentiment && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 10px",
                    borderRadius: 5,
                    background: `${sentColor(rpt.overallSentiment)}18`,
                    color: sentColor(rpt.overallSentiment),
                    border: `1px solid ${sentColor(rpt.overallSentiment)}35`,
                  }}
                >
                  {rpt.overallSentiment} sentiment
                </span>
              )}
              {rpt.samplingMethod === "stratified_random" && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "3px 9px",
                    borderRadius: 5,
                    fontWeight: 600,
                    background: "rgba(245,158,11,.1)",
                    border: "1px solid rgba(245,158,11,.2)",
                    color: "#fbbf24",
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                  }}
                >
                  {/* Sampled {rpt.messageCount}/{rpt.totalMessages} */}
                </span>
              )}
              {/* {rpt.messageCount > 0 && rpt.samplingMethod !== "stratified_random" && (
              <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }}>
                {rpt.messageCount?.toLocaleString()} msgs · {rpt.analyzedDays || 7}d window
              </span>
            )} */}
              {rpt.mainTopics?.length > 0 && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 12,
                    color: "var(--muted)",
                  }}
                >
                  {rpt.mainTopics.length} topics identified
                </span>
              )}
            </div>

            {/* ── ONE-LINER PULL QUOTE */}
            {/* {rpt.oneLiner && (
            <div style={{
              padding: "16px 20px", borderRadius: 11, marginBottom: 28,
              background: "rgba(59,130,246,.06)",
              borderLeft: "3px solid rgba(59,130,246,.5)",
              borderRight: "none", borderTop: "1px solid rgba(59,130,246,.12)", borderBottom: "1px solid rgba(59,130,246,.12)",
              fontSize: 15, color: "#93c5fd", fontStyle: "italic", lineHeight: 1.7,
            }}>"{rpt.oneLiner}"</div>
          )} */}

            {rpt.sentimentDetail && (
              <p
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  lineHeight: 1.7,
                  margin: "0 0 28px",
                }}
              >
                {rpt.sentimentDetail}
              </p>
            )}

            {/* ── DATA COVERAGE NOTICE
                A quiet Discord channel no longer blocks a report — the GitHub half
                still runs. Say so explicitly, so a missing/short Discord section
                reads as "little was said" rather than "the analysis broke". */}
            {(() => {
              const dc = rpt.dataCoverage;
              if (!dc) return null;
              const vol = dc.discordVolume;
              if (vol !== "none" && vol !== "low") return null;

              const isNone = vol === "none";
              const color = isNone ? "#f59e0b" : "#eab308";
              const text = isNone
                ? dc.hasGithubData
                  ? "No Discord discussion was found in this period. This report is based on GitHub development activity only — treat the community signal as unavailable, not negative."
                  : "No Discord discussion was found in this period."
                : "This Discord channel was very quiet in this period, so the community analysis rests on a small number of messages. Read it as low-confidence.";

              return (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: "12px 16px",
                    borderRadius: 11,
                    marginBottom: 24,
                    background: `${color}0f`,
                    border: `1px solid ${color}38`,
                  }}
                >
                  <span style={{ fontSize: 15, lineHeight: 1.5 }}>⚠️</span>
                  <div
                    style={{ fontSize: 12.5, color: color, lineHeight: 1.65 }}
                  >
                    <strong style={{ fontWeight: 700 }}>
                      {isNone ? "Limited data — GitHub only" : "Low chat volume"}
                    </strong>
                    <div style={{ marginTop: 3, color: "var(--muted)" }}>
                      {text}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ═══════════════════════════════════════════════════════
              SECTION 1 — ALL TOPICS
          ═══════════════════════════════════════════════════════ */}
            {rpt.mainTopics?.length > 0 && (
              <Section
                icon="💬"
                title={`Discord — Topics Discussed (${rpt.mainTopics.length})`}
                accentColor="#3b82f6"
              >
                {rpt.briefDescription && (
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: 9,
                      marginBottom: 20,
                      background: "rgba(255,255,255,.03)",
                      border: "1px solid rgba(255,255,255,.07)",
                      fontSize: 13,
                      color: "#94a3b8",
                      lineHeight: 1.7,
                    }}
                  >
                    <strong style={{ color: "#cbd5e1", fontWeight: 600 }}>
                      Overview:{" "}
                    </strong>
                    {rpt.briefDescription}
                  </div>
                )}
                {rpt.mainTopics.map((topic, i) => (
                  <TopicBlock key={i} topic={topic} index={i} />
                ))}
              </Section>
            )}

            {/* ═══════════════════════════════════════════════════════
              SECTION 2 — INVESTABILITY (Discord-derived)
              Hidden when the channel had no usable messages this period — the
              report is then built from GitHub alone and there is no community score.
          ═══════════════════════════════════════════════════════ */}
            {score != null && (
            <Section
              icon="💰"
              title="Investability Analysis"
              accentColor="#10b981"
            >
              {/* Score ring + breakdown bars */}
              <div
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "20px 22px",
                  marginBottom: 28,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 28,
                    marginBottom: rpt.bottomLine ? 20 : 0,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ScoreRing score={score} size={90} />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: scoreColor(score),
                      }}
                    >
                      {rpt.scoreLabel}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    {[
                      ["Technology", bd.technology],
                      ["Team Execution", bd.teamExecution],
                      ["Commercial Potential", bd.commercialPotential],
                      ["Economic Maturity", bd.economicMaturity],
                      ["Decentralization", bd.decentralization],
                    ].map(
                      ([label, val]) =>
                        val != null && (
                          <MiniBar key={label} label={label} value={val} />
                        ),
                    )}
                  </div>
                </div>
                {rpt.bottomLine && (
                  <div
                    style={{
                      padding: "12px 14px",
                      background: "rgba(255,255,255,.03)",
                      border: "1px solid var(--border)",
                      borderRadius: 9,
                      fontSize: 13,
                      color: "#cbd5e1",
                      lineHeight: 1.75,
                    }}
                  >
                    <strong style={{ color: "#e2e8f0", fontWeight: 600 }}>
                      Bottom line:{" "}
                    </strong>
                    {rpt.bottomLine}
                  </div>
                )}
              </div>

              {/* Positives — bullet list */}
              {rpt.positives?.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#10b981",
                      textTransform: "uppercase",
                      letterSpacing: ".08em",
                      marginBottom: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>✅</span> What Pushes It Higher
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    {rpt.positives.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-start",
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#10b981",
                            flexShrink: 0,
                            marginTop: 7,
                          }}
                        />
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#e2e8f0",
                              }}
                            >
                              {p.category}
                            </span>
                            {p.score != null && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontFamily: "var(--mono)",
                                  color: "#10b981",
                                  background: "rgba(16,185,129,.1)",
                                  border: "1px solid rgba(16,185,129,.25)",
                                  padding: "1px 7px",
                                  borderRadius: 4,
                                }}
                              >
                                {p.score}/10
                              </span>
                            )}
                          </div>
                          <p
                            style={{
                              fontSize: 13,
                              color: "#94a3b8",
                              margin: 0,
                              lineHeight: 1.75,
                            }}
                          >
                            {p.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Concerns — bullet list */}
              {rpt.concerns?.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#f59e0b",
                      textTransform: "uppercase",
                      letterSpacing: ".08em",
                      marginBottom: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>⚠️</span> What Holds It Back
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    {rpt.concerns.map((c, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-start",
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#f59e0b",
                            flexShrink: 0,
                            marginTop: 7,
                          }}
                        />
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#e2e8f0",
                              }}
                            >
                              {c.category}
                            </span>
                            {c.score != null && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontFamily: "var(--mono)",
                                  color: "#f59e0b",
                                  background: "rgba(245,158,11,.1)",
                                  border: "1px solid rgba(245,158,11,.25)",
                                  padding: "1px 7px",
                                  borderRadius: 4,
                                }}
                              >
                                {c.score}/10
                              </span>
                            )}
                          </div>
                          <p
                            style={{
                              fontSize: 13,
                              color: "#94a3b8",
                              margin: 0,
                              lineHeight: 1.75,
                            }}
                          >
                            {c.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── PROSE BLOCKS (replaced the old 2-col grid) */}
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,.06)",
                  paddingTop: 24,
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                }}
              >
                <ProseBlock
                  label="What Impresses Most"
                  labelColor="#93c5fd"
                  prefix="💡"
                  text={rpt.whatImpresses}
                />
                
                {rpt.raiseTo9?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#10b981",
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                        marginBottom: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>🚀</span> What Would need to be done for you to give this subnet a higher rating one month from now
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        padding: 0,
                        listStyle: "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {rpt.raiseTo9 .map((item, i) => (
                        <li
                          key={i}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                          }}
                        >
                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: "50%",
                              background: "#10b981",
                              flexShrink: 0,
                              marginTop: 8,
                              opacity: 0.6,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 13,
                              color: "#cbd5e1",
                              lineHeight: 1.75,
                            }}
                          >
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ── MONTH-OVER-MONTH PROGRESS — did last period's goals get done? */}
                {mom && (
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#60a5fa",
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                        marginBottom: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <span>📈</span> Progress Since Last Report
                      {momPrevDate && (
                        <span
                          style={{
                            fontWeight: 500,
                            color: "#64748b",
                            textTransform: "none",
                            letterSpacing: 0,
                          }}
                        >
                          (compared to {momPrevDate})
                        </span>
                      )}
                    </div>

                    {/* Score change badge */}
                    {mom.currentScore != null && mom.previousScore != null && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 12,
                        }}
                      >
                        <span style={{ fontSize: 13, color: "#94a3b8" }}>
                          Investability
                        </span>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#cbd5e1",
                          }}
                        >
                          {mom.previousScore}
                        </span>
                        <span style={{ color: "#64748b" }}>→</span>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#e2e8f0",
                          }}
                        >
                          {mom.currentScore}
                        </span>
                        {mom.scoreDelta != null && mom.scoreDelta !== 0 && (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 20,
                              color:
                                mom.direction === "up" ? "#10b981" : "#ef4444",
                              background:
                                mom.direction === "up"
                                  ? "rgba(16,185,129,.12)"
                                  : "rgba(239,68,68,.12)",
                            }}
                          >
                            {mom.direction === "up" ? "▲" : "▼"}{" "}
                            {Math.abs(mom.scoreDelta)}
                          </span>
                        )}
                      </div>
                    )}

                    {mom.summary && (
                      <p
                        style={{
                          fontSize: 13,
                          color: "#cbd5e1",
                          lineHeight: 1.75,
                          margin: "0 0 14px",
                        }}
                      >
                        {mom.summary}
                      </p>
                    )}

                    {/* Checklist of last period's goals */}
                    {mom.improvements?.length > 0 && (
                      <ul
                        style={{
                          margin: "0 0 14px",
                          padding: 0,
                          listStyle: "none",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {mom.improvements.map((im, i) => {
                          const s = (im.status || "").toLowerCase();
                          const cfg =
                            s === "done"
                              ? {
                                  c: "#10b981",
                                  bg: "rgba(16,185,129,.12)",
                                  icon: "✓",
                                  label: "Done",
                                }
                              : s === "in_progress"
                              ? {
                                  c: "#f59e0b",
                                  bg: "rgba(245,158,11,.12)",
                                  icon: "◐",
                                  label: "In progress",
                                }
                              : {
                                  c: "#94a3b8",
                                  bg: "rgba(148,163,184,.12)",
                                  icon: "○",
                                  label: "Not addressed",
                                };
                          return (
                            <li
                              key={i}
                              style={{
                                display: "flex",
                                gap: 10,
                                alignItems: "flex-start",
                              }}
                            >
                              <span
                                style={{
                                  flexShrink: 0,
                                  marginTop: 1,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: cfg.c,
                                  background: cfg.bg,
                                  borderRadius: 6,
                                  padding: "2px 8px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {cfg.icon} {cfg.label}
                              </span>
                              <span
                                style={{
                                  fontSize: 13,
                                  color: "#cbd5e1",
                                  lineHeight: 1.7,
                                }}
                              >
                                {im.item}
                                {im.evidence && (
                                  <span
                                    style={{
                                      display: "block",
                                      fontSize: 12,
                                      color: "#64748b",
                                      marginTop: 2,
                                    }}
                                  >
                                    {im.evidence}
                                  </span>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {mom.newProgress?.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#10b981",
                            textTransform: "uppercase",
                            letterSpacing: ".07em",
                            marginBottom: 6,
                          }}
                        >
                          New progress this period
                        </div>
                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: 18,
                            color: "#cbd5e1",
                            fontSize: 13,
                            lineHeight: 1.7,
                          }}
                        >
                          {mom.newProgress.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {mom.regressions?.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#ef4444",
                            textTransform: "uppercase",
                            letterSpacing: ".07em",
                            marginBottom: 6,
                          }}
                        >
                          Regressions / new concerns
                        </div>
                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: 18,
                            color: "#cbd5e1",
                            fontSize: 13,
                            lineHeight: 1.7,
                          }}
                        >
                          {mom.regressions.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <ProseBlock
                  label="What Would Lower the Rating"
                  labelColor="#ef4444"
                  prefix="⚠️"
                  text={rpt.lowerRating}
                />
                <ProseBlock
                  label="How It Compares to Other Subnets"
                  labelColor="#c4b5fd"
                  prefix="📊"
                  text={rpt.comparisonContext}
                />
              </div>
            </Section>
            )}

            {/* ═══════════════════════════════════════════════════════
              SECTION 2c — GITHUB DEVELOPMENT (separate from Discord)
          ═══════════════════════════════════════════════════════ */}
            {rpt.githubAnalysis?.stats?.repoCount > 0 &&
              (() => {
                const gh = rpt.githubAnalysis;
                const s = gh.stats;
                const act = gh.activity;
                const fmtDate = (d) =>
                  d ? new Date(d).toISOString().split("T")[0] : "—";
                const momColor =
                  act?.momentum === "high"
                    ? "#10b981"
                    : act?.momentum === "moderate"
                      ? "#f59e0b"
                      : "#94a3b8";

                const StatTile = ({ label, value }) => (
                  <div
                    style={{
                      flex: "1 1 90px",
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 11,
                      padding: "14px 16px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: "#c4b5fd",
                        fontFamily: "var(--mono)",
                      }}
                    >
                      {value}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                        marginTop: 4,
                      }}
                    >
                      {label}
                    </div>
                  </div>
                );

                return (
                  <Section
                    icon="🐙"
                    title="GitHub Development"
                    accentColor="#8b5cf6"
                  >
                    {/* Aggregate repo health tiles */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                        marginBottom: 20,
                      }}
                    >
                      <StatTile label="Repos" value={s.repoCount} />
                      <StatTile
                        label="Stars"
                        value={(s.totalStars || 0).toLocaleString()}
                      />
                      <StatTile
                        label="Forks"
                        value={(s.totalForks || 0).toLocaleString()}
                      />
                      <StatTile
                        label="Open Issues"
                        value={(s.totalOpenIssues || 0).toLocaleString()}
                      />
                      {act?.momentum && (
                        <div
                          style={{
                            flex: "1 1 90px",
                            background: `${momColor}14`,
                            border: `1px solid ${momColor}35`,
                            borderRadius: 11,
                            padding: "14px 16px",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: momColor,
                              textTransform: "capitalize",
                            }}
                          >
                            {act.momentum}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--muted)",
                              textTransform: "uppercase",
                              letterSpacing: ".06em",
                              marginTop: 4,
                            }}
                          >
                            Momentum
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Languages + last push meta line */}
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        marginBottom: 18,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 14,
                      }}
                    >
                      {s.languages?.length > 0 && (
                        <span>🧩 {s.languages.join(", ")}</span>
                      )}
                      {s.lastPushedAt && (
                        <span>⏱️ Last push {fmtDate(s.lastPushedAt)}</span>
                      )}
                    </div>

                    {/* Per-repo list */}
                    {s.repos?.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          marginBottom: act ? 24 : 0,
                        }}
                      >
                        {s.repos.map((r, i) => (
                          <a
                            key={i}
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: 12,
                              padding: "10px 14px",
                              borderRadius: 9,
                              background: "rgba(139,92,246,.06)",
                              border: "1px solid rgba(139,92,246,.15)",
                              textDecoration: "none",
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#c4b5fd",
                              }}
                            >
                              {r.fullName}
                            </span>
                            {r.archived && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: "#f59e0b",
                                  border: "1px solid rgba(245,158,11,.3)",
                                  borderRadius: 4,
                                  padding: "1px 5px",
                                  textTransform: "uppercase",
                                }}
                              >
                                Archived
                              </span>
                            )}
                            <span
                              style={{
                                marginLeft: "auto",
                                fontSize: 12,
                                color: "var(--muted)",
                                fontFamily: "var(--mono)",
                              }}
                            >
                              ★{(r.stars || 0).toLocaleString()} · ⑂
                              {(r.forks || 0).toLocaleString()} · {r.openIssues}{" "}
                              open
                              {r.latestReleaseTag
                                ? ` · ${r.latestReleaseTag}`
                                : ""}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}

                    {/* LLM activity summary */}
                    {act && (
                      <>
                        {act.summary && (
                          <p
                            style={{
                              fontSize: 13.5,
                              color: "#cbd5e1",
                              lineHeight: 1.75,
                              margin: "0 0 18px",
                            }}
                          >
                            {act.summary}
                          </p>
                        )}

                        {act.devFocus?.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                              marginBottom: 20,
                            }}
                          >
                            {act.devFocus.map((f, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "#c4b5fd",
                                  background: "rgba(139,92,246,.1)",
                                  border: "1px solid rgba(139,92,246,.25)",
                                  borderRadius: 20,
                                  padding: "4px 12px",
                                }}
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Full development report — bulleted topic blocks,
                            same style as the Discord topics */}
                        {act.topics?.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "var(--muted)",
                                textTransform: "uppercase",
                                letterSpacing: ".08em",
                                marginBottom: 16,
                              }}
                            >
                              Development Report ({act.topics.length})
                            </div>
                            {act.topics.map((topic, i) => (
                              <TopicBlock key={i} topic={topic} index={i} />
                            ))}
                          </div>
                        )}

                        {act.recentHighlights?.length > 0 && (
                          <div style={{ marginBottom: 20 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "var(--muted)",
                                textTransform: "uppercase",
                                letterSpacing: ".08em",
                                marginBottom: 12,
                              }}
                            >
                              ✨ Recent Highlights
                            </div>
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: 18,
                                color: "#cbd5e1",
                                fontSize: 13,
                                lineHeight: 1.8,
                              }}
                            >
                              {act.recentHighlights.map((h, i) => (
                                <li key={i}>{h}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {act.concerns?.length > 0 && (
                          <div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#f87171",
                                textTransform: "uppercase",
                                letterSpacing: ".08em",
                                marginBottom: 12,
                              }}
                            >
                              ⚠️ Repository Concerns
                            </div>
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: 18,
                                color: "#cbd5e1",
                                fontSize: 13,
                                lineHeight: 1.8,
                              }}
                            >
                              {act.concerns.map((c, i) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </Section>
                );
              })()}

            {/* ═══════════════════════════════════════════════════════
              SECTION 3 — SIGNALS & ISSUES
          ═══════════════════════════════════════════════════════ */}
            {(rpt.emergingSignals?.length > 0 ||
              rpt.userIssues?.length > 0 ||
              rpt.openQuestions?.length > 0) && (
              <Section icon="📡" title="Discord — Signals & Issues" accentColor="#f59e0b">
                {/* Emerging signals — full width stacked */}
                {rpt.emergingSignals?.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                        marginBottom: 12,
                      }}
                    >
                      Emerging Signals
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {rpt.emergingSignals.map((s, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            gap: 12,
                            alignItems: "flex-start",
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: confColor(s.confidence),
                              flexShrink: 0,
                              marginTop: 7,
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 7,
                                marginBottom: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: "#e2e8f0",
                                }}
                              >
                                {s.signal}
                              </span>
                              <span
                                style={{
                                  fontSize: 9,
                                  padding: "1px 6px",
                                  borderRadius: 3,
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: ".05em",
                                  background: `${confColor(s.confidence)}20`,
                                  color: confColor(s.confidence),
                                  border: `1px solid ${confColor(s.confidence)}40`,
                                }}
                              >
                                {s.confidence}
                              </span>
                            </div>
                            {s.description && (
                              <p
                                style={{
                                  fontSize: 13,
                                  color: "#94a3b8",
                                  margin: "0 0 4px",
                                  lineHeight: 1.7,
                                }}
                              >
                                {s.description}
                              </p>
                            )}
                            {s.evidence && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "var(--dim)",
                                  fontStyle: "italic",
                                  borderLeft: "2px solid var(--border)",
                                  paddingLeft: 10,
                                  marginTop: 4,
                                }}
                              >
                                "{s.evidence}"
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* User Issues */}
                {rpt.userIssues?.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                        marginBottom: 12,
                      }}
                    >
                      User Issues
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {rpt.userIssues.map((u, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                          }}
                        >
                          <span
                            style={{
                              color: "#ef4444",
                              flexShrink: 0,
                              fontSize: 13,
                              fontWeight: 700,
                              marginTop: 1,
                            }}
                          >
                            !
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              color: "#94a3b8",
                              lineHeight: 1.7,
                            }}
                          >
                            {u}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Open Questions */}
                {rpt.openQuestions?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                        marginBottom: 12,
                      }}
                    >
                      Open Questions
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {rpt.openQuestions.map((q, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                          }}
                        >
                          <span
                            style={{
                              color: "#f59e0b",
                              flexShrink: 0,
                              fontSize: 13,
                              fontWeight: 700,
                              marginTop: 1,
                            }}
                          >
                            ?
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              color: "#94a3b8",
                              lineHeight: 1.7,
                            }}
                          >
                            {q}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* ═══════════════════════════════════════════════════════
              SECTION 4 — DEVELOPMENTS TO WATCH
          ═══════════════════════════════════════════════════════ */}
            {rpt.developmentsToWatch?.length > 0 && (
              <Section
                icon="🔭"
                title="Developments to Watch"
                accentColor="#8b5cf6"
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {rpt.developmentsToWatch.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#8b5cf6",
                          flexShrink: 0,
                          marginTop: 7,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 13,
                          color: "#94a3b8",
                          lineHeight: 1.75,
                        }}
                      >
                        {d}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ═══════════════════════════════════════════════════════
              SECTION 5 — FINAL COMBINED VERDICT (Discord + GitHub)
          ═══════════════════════════════════════════════════════ */}
            {rpt.combinedVerdict?.combinedScore != null &&
              (() => {
                const cv = rpt.combinedVerdict;
                const scoreColor =
                  cv.combinedScore >= 7
                    ? "#10b981"
                    : cv.combinedScore >= 5
                      ? "#f59e0b"
                      : "#ef4444";
                const ao = cv.alphaOutlook || {};
                const confColor =
                  ao.confidence === "HIGH"
                    ? "#10b981"
                    : ao.confidence === "MEDIUM"
                      ? "#f59e0b"
                      : "#94a3b8";
                return (
                  <Section
                    icon="🎯"
                    title="Final Investment Verdict"
                    accentColor="#10b981"
                  >
                    {/* Combined score header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 20,
                        padding: "20px 22px",
                        borderRadius: 14,
                        marginBottom: 22,
                        background: `${scoreColor}0d`,
                        border: `1px solid ${scoreColor}30`,
                      }}
                    >
                      <div style={{ textAlign: "center", flexShrink: 0 }}>
                        <div
                          style={{
                            fontSize: 40,
                            fontWeight: 800,
                            lineHeight: 1,
                            color: scoreColor,
                            fontFamily: "var(--mono)",
                          }}
                        >
                          {cv.combinedScore}
                          <span
                            style={{ fontSize: 18, color: "var(--muted)" }}
                          >
                            /10
                          </span>
                        </div>
                        {cv.scoreLabel && (
                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              color: scoreColor,
                              textTransform: "uppercase",
                              letterSpacing: ".06em",
                            }}
                          >
                            {cv.scoreLabel}
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--muted)",
                            textTransform: "uppercase",
                            letterSpacing: ".08em",
                            marginBottom: 8,
                          }}
                        >
                          Combined Score · Discord + GitHub
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13.5,
                            color: "#cbd5e1",
                            lineHeight: 1.75,
                          }}
                        >
                          {cv.rationale}
                        </p>
                      </div>
                    </div>

                    {/* What would raise the rating */}
                    {cv.raiseRating?.length > 0 && (
                      <div style={{ marginBottom: 24 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "var(--muted)",
                            textTransform: "uppercase",
                            letterSpacing: ".08em",
                            marginBottom: 12,
                          }}
                        >
                          ⬆️ What Would Raise This Rating
                        </div>
                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: 18,
                            color: "#cbd5e1",
                            fontSize: 13,
                            lineHeight: 1.8,
                          }}
                        >
                          {cv.raiseRating.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Alpha token outlook */}
                    {ao.answer && (
                      <div
                        style={{
                          padding: "16px 18px",
                          borderRadius: 12,
                          background: "rgba(59,130,246,.06)",
                          border: "1px solid rgba(59,130,246,.15)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 10,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#93c5fd",
                            }}
                          >
                            📈 Near-Term Alpha Token Outlook
                          </span>
                          {ao.confidence && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: confColor,
                                border: `1px solid ${confColor}40`,
                                borderRadius: 5,
                                padding: "2px 7px",
                                textTransform: "uppercase",
                                letterSpacing: ".05em",
                              }}
                            >
                              {ao.confidence} confidence
                            </span>
                          )}
                        </div>
                        <p
                          style={{
                            margin: "0 0 12px",
                            fontSize: 13,
                            color: "#cbd5e1",
                            lineHeight: 1.75,
                          }}
                        >
                          {ao.answer}
                        </p>
                        {ao.catalysts?.length > 0 && (
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: 18,
                              color: "#94a3b8",
                              fontSize: 12.5,
                              lineHeight: 1.7,
                            }}
                          >
                            {ao.catalysts.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </Section>
                );
              })()}
          </div>

          {/* ═══════════════════════════════════════════════════════
            CHAT SECTION
        ═══════════════════════════════════════════════════════ */}
          <div
            style={{
              margin: "0 28px 28px",
              border: "1px solid var(--border)",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border)",
                background: "rgba(59,130,246,.05)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 15 }}>💬</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                Ask about {displayName}
              </span>
              <span
                style={{ fontSize: 12, color: "var(--muted)", marginLeft: 4 }}
              >
                — based on scraped channel data
              </span>
            </div>

            {chatMessages.length === 0 && (
              <div
                style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: ".07em",
                  }}
                >
                  Quick questions
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {PRESETS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setChatInput(q)}
                      style={{
                        padding: "5px 12px",
                        background: "rgba(255,255,255,.04)",
                        border: "1px solid var(--border)",
                        borderRadius: 7,
                        fontSize: 12,
                        color: "var(--muted)",
                        cursor: "pointer",
                        fontFamily: "var(--font)",
                        transition: "all .15s",
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.borderColor = "rgba(59,130,246,.4)";
                        e.target.style.color = "#93c5fd";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.borderColor = "var(--border)";
                        e.target.style.color = "var(--muted)";
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.length > 0 && (
              <div
                style={{
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  maxHeight: 360,
                  overflowY: "auto",
                }}
              >
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      flexDirection:
                        msg.role === "user" ? "row-reverse" : "row",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        flexShrink: 0,
                        background:
                          msg.role === "user"
                            ? "rgba(59,130,246,.2)"
                            : "rgba(139,92,246,.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                      }}
                    >
                      {msg.role === "user" ? "👤" : "🧠"}
                    </div>
                    <div
                      style={{
                        maxWidth: "78%",
                        padding: "10px 14px",
                        borderRadius: 10,
                        fontSize: 13,
                        lineHeight: 1.7,
                        background:
                          msg.role === "user"
                            ? "rgba(59,130,246,.12)"
                            : "rgba(255,255,255,.04)",
                        border: `1px solid ${msg.role === "user" ? "rgba(59,130,246,.25)" : "var(--border)"}`,
                        color: msg.role === "user" ? "#93c5fd" : "#cbd5e1",
                        whiteSpace: msg.role === "user" ? "pre-wrap" : "normal",
                      }}
                    >
                      {msg.role === "user" ? (
                        msg.content
                      ) : (
                        <RichText text={msg.content} />
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: "flex", gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: "rgba(139,92,246,.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                      }}
                    >
                      🧠
                    </div>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: "rgba(255,255,255,.04)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        gap: 4,
                        alignItems: "center",
                      }}
                    >
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: "var(--muted)",
                            animation: `pulse 1.2s ${i * 0.2}s infinite`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}

            <div
              style={{
                padding: "12px 14px",
                borderTop:
                  chatMessages.length > 0 ? "1px solid var(--border)" : "none",
                display: "flex",
                gap: 8,
              }}
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && sendChat()
                }
                placeholder={`Ask anything about ${displayName}…`}
                style={{ flex: 1 }}
                disabled={chatLoading}
              />
              <button
                onClick={sendChat}
                disabled={chatLoading || !chatInput.trim()}
                style={{
                  padding: "10px 20px",
                  background: "linear-gradient(135deg,#3b82f6,#6366f1)",
                  color: "white",
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor:
                    chatLoading || !chatInput.trim()
                      ? "not-allowed"
                      : "pointer",
                  border: "none",
                  opacity: chatLoading || !chatInput.trim() ? 0.5 : 1,
                  fontFamily: "var(--font)",
                  flexShrink: 0,
                }}
              >
                {chatLoading ? "…" : "Ask →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── LEADERBOARD
  const LeaderboardView = () => (
    <Card style={{ overflow: "hidden" }}>
      <CardHeader
        title="Subnet Investability Leaderboard"
        action={<Badge color="blue">{leaderboard.length} subnets ranked</Badge>}
      />
      {leaderboard.length === 0 ? (
        <Empty msg="No reports yet" />
      ) : (
        leaderboard.map((r, i) => {
          const rpt = r.report || {};
          // Show the final combined verdict (Discord + GitHub); fall back to the
          // Discord-only investability score when no verdict was computed.
          const score = rpt.combinedVerdict?.combinedScore ?? rpt.investabilityScore;
          return (
            <div
              key={r._id}
              onClick={() => setOpen(r)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 20px",
                borderBottom:
                  i < leaderboard.length - 1
                    ? "1px solid var(--border)"
                    : "none",
                cursor: "pointer",
                transition: "background .1s",
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
                  width: 26,
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  color:
                    i < 3 ? ["#fbbf24", "#9ca3af", "#c97c3a"][i] : "var(--dim)",
                }}
              >
                #{i + 1}
              </div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 9,
                  flexShrink: 0,
                  background: `${scoreColor(score)}18`,
                  border: `1px solid ${scoreColor(score)}35`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  color: scoreColor(score),
                  fontFamily: "var(--mono)",
                }}
              >
                {r.subnetNumber}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {configMap[r.subnetNumber]?.name || rpt.subnetName || r.channelName}
                    {configMap[r.subnetNumber]?.category && (
                      <Badge color="purple">{configMap[r.subnetNumber].category}</Badge>
                    )}
                  </span>
                </div>
                {rpt.oneLiner && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {rpt.oneLiner}
                  </div>
                )}
              </div>
              <ScoreRing score={score} size={44} />
            </div>
          );
        })
      )}
    </Card>
  );

  // ── SCHEDULE
  const ScheduleView = () => {
    const sc = schedule;
    if (!sc) return <Empty msg="No schedule data" />;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 12,
          }}
        >
          {[
            { label: "Cycle", val: sc.schedule?.cycleNumber || 1 },
            {
              label: "Progress",
              val: `${sc.currentIndex || 0} / ${sc.total || "?"}`,
            },
            { label: "Completion", val: `${sc.progressPercent || 0}%` },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: ".07em",
                  marginBottom: 6,
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#93c5fd" }}>
                {s.val}
              </div>
            </div>
          ))}
        </div>

        {/* Pause / Resume control */}
        <Card
          style={{
            padding: 20,
            border: sc.isPaused
              ? "1px solid rgba(245,158,11,.4)"
              : "1px solid var(--border)",
            background: sc.isPaused ? "rgba(245,158,11,.06)" : "var(--card)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                {sc.isPaused ? "⏸️ Analysis Paused" : "▶️ Analysis Active"}
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--muted)",
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {sc.isPaused
                  ? sc.resumeAt
                    ? `Held — auto-resumes on ${new Date(
                        sc.resumeAt,
                      ).toLocaleDateString()}. Continues from subnet ${
                        sc.upcoming?.[0]?.subnetNumber ?? "?"
                      }.`
                    : `Held indefinitely. Continues from subnet ${
                        sc.upcoming?.[0]?.subnetNumber ?? "?"
                      } when resumed.`
                  : "Daily analysis runs automatically. Pause to hold the rotation without missing reports — it resumes from where it stopped."}
              </p>
            </div>
            {sc.isPaused ? (
              <button
                onClick={() => resumeAnalysis()}
                disabled={pausing}
                style={{
                  padding: "10px 22px",
                  background: "linear-gradient(135deg,#10b981,#059669)",
                  color: "white",
                  borderRadius: 9,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: pausing ? "not-allowed" : "pointer",
                  border: "none",
                  opacity: pausing ? 0.5 : 1,
                  fontFamily: "var(--font)",
                  whiteSpace: "nowrap",
                }}
              >
                {pausing ? "…" : "▶ Resume"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  ["Pause 3d", 3],
                  ["Pause 7d", 7],
                  ["Pause ∞", null],
                ].map(([label, days]) => (
                  <button
                    key={label}
                    onClick={() => pauseAnalysis(days)}
                    disabled={pausing}
                    style={{
                      padding: "10px 16px",
                      background: "rgba(245,158,11,.12)",
                      color: "#fbbf24",
                      borderRadius: 9,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: pausing ? "not-allowed" : "pointer",
                      border: "1px solid rgba(245,158,11,.3)",
                      opacity: pausing ? 0.5 : 1,
                      fontFamily: "var(--font)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {pausing ? "…" : `⏸ ${label}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card style={{ padding: 20 }}>
          <div
            style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}
          >
            Cycle {sc.schedule?.cycleNumber || 1} — {sc.total || "?"} total
            subnets
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: "rgba(255,255,255,.05)",
              overflow: "hidden",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: `${sc.progressPercent || 0}%`,
                height: "100%",
                background: "linear-gradient(90deg,#3b82f6,#6366f1)",
                borderRadius: 4,
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Resets after all {sc.total || "?"} subnets and begins cycle{" "}
            {(sc.schedule?.cycleNumber || 1) + 1}
          </div>
        </Card>

        {sc.upcoming?.length > 0 && (
          <Card style={{ padding: 20 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: ".08em",
                marginBottom: 14,
              }}
            >
              Next 3 in Rotation
            </div>
            {sc.upcoming.map((u, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 7,
                    background: "rgba(59,130,246,.1)",
                    border: "1px solid rgba(59,130,246,.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#93c5fd",
                    fontFamily: "var(--mono)",
                  }}
                >
                  {u.subnetNumber}
                </div>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>
                  #{u.name}
                </span>
              </div>
            ))}
          </Card>
        )}

        <Card style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Manual Trigger
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--muted)",
              marginBottom: 14,
              lineHeight: 1.6,
            }}
          >
            {sc.isPaused
              ? "Analysis is paused — resume it above before triggering a rotation run."
              : sc.manualRunLocked
                ? `Manual run can only be used once per week. Available again on ${new Date(
                    sc.manualRunAvailableAt,
                  ).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}.`
                : "Runs next 3 subnets immediately without waiting for 08:00 UTC. Backfills channel data then runs AI analysis. Can be used once per week."}
          </p>
          <button
            onClick={() => runNow()}
            disabled={running || sc.isPaused || sc.manualRunLocked}
            style={{
              padding: "10px 24px",
              background: "linear-gradient(135deg,#3b82f6,#6366f1)",
              color: "white",
              borderRadius: 9,
              fontSize: 14,
              fontWeight: 600,
              cursor:
                running || sc.isPaused || sc.manualRunLocked
                  ? "not-allowed"
                  : "pointer",
              border: "none",
              opacity: running || sc.isPaused || sc.manualRunLocked ? 0.5 : 1,
              fontFamily: "var(--font)",
            }}
          >
            {running
              ? "⏳ Running…"
              : sc.manualRunLocked
                ? "🔒 Available Next Week"
                : "▶ Run Next 3 Subnets Now"}
          </button>
        </Card>
      </div>
    );
  };

  // ── MAIN RENDER
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {openReport && (
        <ReportModal r={openReport} onClose={() => setOpen(null)} />
      )}

      {/* Header */}
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
            Subnet Intelligence
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            Automated daily analysis · 3 subnets/day · 150-subnet rotation ·
            click any card for full report + chat
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
            ["today", "📋 Today"],
            ["leaderboard", "🏆 Leaderboard"],
            ["schedule", "⏰ Schedule"],
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
                fontFamily: "var(--font)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {err && <ErrBox msg={err} />}

      {loading ? (
        <div
          style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}
        >
          <Spinner size={36} />
        </div>
      ) : // Replace the today tab content block with this:
      tab === "today" ? (
        todayReports.length === 0 ? (
          <Card style={{ padding: 52 }}>
            <Empty msg="No reports yet — go to Schedule tab and click Run to generate today's analysis" />
          </Card>
        ) : (
          <>
            <div
              style={{
                padding: "20px 28px",
                background:
                  "linear-gradient(135deg,rgba(59,130,246,.08),rgba(139,92,246,.05))",
                border: "1px solid rgba(59,130,246,.15)",
                borderRadius: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: ".12em",
                  marginBottom: 6,
                }}
              >
                Daily Intelligence Report
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  background: "linear-gradient(135deg,#60a5fa,#a78bfa)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  letterSpacing: "-.5px",
                }}
              >
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <div
                style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}
              >
                {(() => {
                  const failed = todayReports.filter(
                    (r) => r.status === "failed",
                  ).length;
                  const ok = todayReports.length - failed;
                  return (
                    <>
                      {ok} subnet{ok !== 1 ? "s" : ""} analyzed
                      {failed > 0 && (
                        <span style={{ color: "#ef4444" }}>
                          {" "}
                          · {failed} unavailable
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <Card style={{ overflow: "hidden" }}>
              {[...todayReports]
                .sort((a, b) => {
                  // Failed rows sink to the bottom; otherwise sort by subnet number
                  const af = a.status === "failed" ? 1 : 0;
                  const bf = b.status === "failed" ? 1 : 0;
                  return af - bf || a.subnetNumber - b.subnetNumber;
                })
                .map((r, i, arr) => {
                  const config = configMap[r.subnetNumber];
                  const meta = SUBNET_META[r.subnetNumber];
                  const displayName =
                    config?.name ||
                    meta?.name ||
                    r.report?.subnetName ||
                    extractCleanName(r.channelName) ||
                    r.channelName;
                  const category = config?.category || meta?.category;

                  // ── Failed / unavailable subnet — show name + category + reason
                  if (r.status === "failed") {
                    return (
                      <div
                        key={r._id}
                        title={r.error || "Report unavailable"}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          padding: "18px 22px",
                          borderBottom:
                            i < arr.length - 1
                              ? "1px solid var(--border)"
                              : "none",
                          background: "rgba(239,68,68,.04)",
                        }}
                      >
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

                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 11,
                            flexShrink: 0,
                            background: "rgba(239,68,68,.12)",
                            border: "1px solid rgba(239,68,68,.35)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                            fontWeight: 800,
                            color: "#ef4444",
                            fontFamily: "var(--mono)",
                          }}
                        >
                          {r.subnetNumber}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              marginBottom: 4,
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              {displayName}
                              {category && (
                                <Badge color="purple">{category}</Badge>
                              )}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#ef4444",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span>⚠</span>
                            {friendlyError(r.error)}
                          </div>
                        </div>

                        <Badge color="red">Unavailable</Badge>
                      </div>
                    );
                  }

                  const rpt = r.report?.report || r.report || {};
                  // Show the final combined verdict (Discord + GitHub); fall back
                  // to the Discord-only score when no verdict was computed.
                  const score = rpt.combinedVerdict?.combinedScore ?? rpt.investabilityScore;
                  const description =
                    meta?.description ||
                    rpt.briefDescription ||
                    rpt.oneLiner ||
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
                          i < arr.length - 1
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

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {displayName}
                            {config?.category && <Badge color="purple">{config.category}</Badge>}
                          </span>
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

                      {rpt.overallSentiment && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 10px",
                            borderRadius: 5,
                            flexShrink: 0,
                            background: `${sentColor(rpt.overallSentiment)}18`,
                            color: sentColor(rpt.overallSentiment),
                            border: `1px solid ${sentColor(rpt.overallSentiment)}35`,
                          }}
                        >
                          {rpt.overallSentiment}
                        </span>
                      )}

                      <ScoreRing score={score} size={52} />
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
          </>
        )
      ) : tab === "leaderboard" ? (
        <LeaderboardView />
      ) : (
        <ScheduleView />
      )}
    </div>
  );
}
// ── OVERVIEW ─────────────────────────────────────────────────────────────────
// function Overview() {
//   const [data, setData] = useState(null);
//   const [loading, setLoad] = useState(true);
//   const [err, setErr] = useState("");

//   useEffect(() => {
//     Promise.all([api("/messages/stats"), api("/servers")])
//       .then(([s, sv]) => setData({ s, sv }))
//       .catch((e) => setErr(e.message))
//       .finally(() => setLoad(false));
//   }, []);

//   if (loading)
//     return (
//       <div
//         style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}
//       >
//         <Spinner size={36} />
//       </div>
//     );
//   if (err) return <ErrBox msg={err} />;

//   const { s, sv } = data;
//   const src = s.bySource || [];
//   const srcColors = {
//     discord: "#5865F2",
//     github: "#3b82f6",
//     twitter: "#06b6d4",
//     other: "#64748b",
//   };

//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
//       <div className="fu">
//         <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
//           Overview
//         </h2>
//         <p style={{ color: "var(--muted)", fontSize: 14 }}>
//           All sources · all time
//         </p>
//       </div>

//       <div
//         style={{
//           display: "grid",
//           gridTemplateColumns: "repeat(4,1fr)",
//           gap: 16,
//         }}
//       >
//         {[
//           {
//             label: "Total Messages",
//             val: s.total?.toLocaleString() || "0",
//             sub: "all channels",
//             icon: "💬",
//             accent: true,
//           },
//           {
//             label: "Servers",
//             val: sv.length,
//             sub: `${sv.filter((x) => x.scrapeEnabled).length} scraping`,
//             icon: "🖥️",
//           },
//           // {label:"Top Author",val:s.topAuthors?.[0]?._id||"—",sub:s.topAuthors?.[0]?`${s.topAuthors[0].count} msgs`:"",icon:"👤"},
//           {
//             label: "Sources",
//             val: src.length,
//             sub: src.map((x) => x._id).join(", ") || "none",
//             icon: "📡",
//           },
//         ].map((c, i) => (
//           <div
//             key={c.label}
//             className={`fu${i + 1}`}
//             style={{
//               background: c.accent
//                 ? "linear-gradient(135deg,rgba(59,130,246,.12),rgba(139,92,246,.08))"
//                 : "var(--card)",
//               border: `1px solid ${c.accent ? "rgba(59,130,246,.25)" : "var(--border)"}`,
//               borderRadius: 16,
//               padding: "20px 24px",
//             }}
//           >
//             <div
//               style={{
//                 display: "flex",
//                 justifyContent: "space-between",
//                 alignItems: "center",
//                 marginBottom: 6,
//               }}
//             >
//               <span
//                 style={{
//                   fontSize: 11,
//                   fontWeight: 600,
//                   color: "var(--muted)",
//                   textTransform: "uppercase",
//                   letterSpacing: ".08em",
//                 }}
//               >
//                 {c.label}
//               </span>
//               <span style={{ fontSize: 18, opacity: 0.6 }}>{c.icon}</span>
//             </div>
//             <div
//               style={{
//                 fontSize: 26,
//                 fontWeight: 700,
//                 color: c.accent ? "#93c5fd" : "var(--text)",
//               }}
//             >
//               {c.val}
//             </div>
//             <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
//               {c.sub}
//             </div>
//           </div>
//         ))}
//       </div>

//       <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
//         <Card className="fu2">
//           <CardHeader
//             title="Daily Activity"
//             action={<Badge color="blue">Last 30 days</Badge>}
//           />
//           <div style={{ padding: "20px 16px 16px" }}>
//             {(s.byDay || []).length === 0 ? (
//               <Empty msg="No activity yet — run a backfill" />
//             ) : (
//               <ResponsiveContainer width="100%" height={200}>
//                 <AreaChart data={s.byDay}>
//                   <defs>
//                     <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
//                       <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
//                       <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
//                     </linearGradient>
//                   </defs>
//                   <CartesianGrid
//                     strokeDasharray="3 3"
//                     stroke="rgba(255,255,255,.04)"
//                   />
//                   <XAxis
//                     dataKey="_id"
//                     tick={{ fontSize: 11, fill: "#475569" }}
//                     axisLine={false}
//                     tickLine={false}
//                   />
//                   <YAxis
//                     tick={{ fontSize: 11, fill: "#475569" }}
//                     axisLine={false}
//                     tickLine={false}
//                   />
//                   <Tooltip content={<Tip />} />
//                   <Area
//                     type="monotone"
//                     dataKey="count"
//                     name="Messages"
//                     stroke="#3b82f6"
//                     fill="url(#ga)"
//                     strokeWidth={2}
//                     dot={false}
//                   />
//                 </AreaChart>
//               </ResponsiveContainer>
//             )}
//           </div>
//         </Card>

//         <Card className="fu3">
//           <CardHeader title="By Source" />
//           <div style={{ padding: 20 }}>
//             {src.length === 0 ? (
//               <Empty msg="No data" />
//             ) : (
//               <>
//                 <ResponsiveContainer width="100%" height={120}>
//                   <PieChart>
//                     <Pie
//                       data={src}
//                       cx="50%"
//                       cy="50%"
//                       innerRadius={32}
//                       outerRadius={52}
//                       dataKey="count"
//                       paddingAngle={4}
//                     >
//                       {src.map((x, i) => (
//                         <Cell key={i} fill={srcColors[x._id] || "#64748b"} />
//                       ))}
//                     </Pie>
//                     <Tooltip content={<Tip />} />
//                   </PieChart>
//                 </ResponsiveContainer>
//                 <div
//                   style={{
//                     display: "flex",
//                     flexDirection: "column",
//                     gap: 8,
//                     marginTop: 12,
//                   }}
//                 >
//                   {src.map((x) => (
//                     <div
//                       key={x._id}
//                       style={{
//                         display: "flex",
//                         alignItems: "center",
//                         justifyContent: "space-between",
//                         fontSize: 13,
//                       }}
//                     >
//                       <div
//                         style={{
//                           display: "flex",
//                           alignItems: "center",
//                           gap: 8,
//                         }}
//                       >
//                         <div
//                           style={{
//                             width: 8,
//                             height: 8,
//                             borderRadius: 2,
//                             background: srcColors[x._id] || "#64748b",
//                           }}
//                         />
//                         <span
//                           style={{
//                             color: "var(--muted)",
//                             textTransform: "capitalize",
//                           }}
//                         >
//                           {x._id}
//                         </span>
//                       </div>
//                       <span
//                         style={{
//                           fontWeight: 600,
//                           fontFamily: "var(--mono)",
//                           fontSize: 12,
//                         }}
//                       >
//                         {x.count}
//                       </span>
//                     </div>
//                   ))}
//                 </div>
//               </>
//             )}
//           </div>
//         </Card>
//       </div>

//       {/* {(s.topAuthors||[]).length>0 && (
//         <Card className="fu4">
//           <CardHeader title="Top Authors" action={<Badge color="gray">Top 10</Badge>}/>
//           <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)"}}>
//             {s.topAuthors.slice(0,10).map((a,i)=>(
//               <div key={a._id} style={{padding:"14px 20px",borderRight:i%5<4?"1px solid var(--border)":"none",borderBottom:i<5?"1px solid var(--border)":"none"}}>
//                 <div style={{fontSize:13,fontWeight:600,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a._id}</div>
//                 <div style={{fontSize:14,color:"var(--accent)",fontFamily:"var(--mono)",fontWeight:600}}>{a.count}</div>
//               </div>
//             ))}
//           </div>
//         </Card>
//       )} */}
//     </div>
//   );
// }

// ── SERVERS ──────────────────────────────────────────────────────────────────
// Correct known server-name misspellings coming from Discord/DB for display.
const cleanServerName = (name = "") =>
  name.replace(/\bBit+ensor\b/gi, "Bittensor");

// Subnet number from a channel name, e.g. "11--trajectory-rl" → 11; 9999 if none.
const channelSubnetNum = (name = "") => {
  const m = name.match(/^(\d+)/);
  const n = m ? parseInt(m[1], 10) : 9999;
  return n === 0 ? 9999 : n;
};

function Servers() {
  const [sv, setSv] = useState([]);
  const [ch, setCh] = useState([]);
  const [configMap, setConfigMap] = useState({}); // subnet -> { name, category }
  const [sel, setSel] = useState(null);
  const [loading, setL] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([
      api("/servers"),
      api("/channels"),
      api("/subnet-config").catch(() => []),
    ])
      .then(([s, c, cfg]) => {
        setSv(s);
        setCh(c);
        const map = {};
        for (const x of cfg) map[x.subnetNumber] = x;
        setConfigMap(map);
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

  const scCh = ch
    .filter((c) => c.serverId === sel)
    .sort(
      (a, b) =>
        channelSubnetNum(a.name) - channelSubnetNum(b.name) ||
        a.name.localeCompare(b.name),
    );

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
                      {cleanServerName(s.name)}
                    </div>
                    {/* <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {s.memberCount?.toLocaleString()} members
                    </div> */}
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
                ? `Channels — ${cleanServerName(sv.find((s) => s.discordId === sel)?.name || "")}`
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
            scCh.map((c, i) => {
              const num = channelSubnetNum(c.name);
              const isSubnet = num !== 9999;
              const cfg = configMap[num];
              const meta = SUBNET_META[num];
              const displayName = isSubnet
                ? cfg?.name ||
                  meta?.name ||
                  extractCleanName(c.name) ||
                  c.name
                : extractCleanName(c.name) || c.name;
              const category = isSubnet ? cfg?.category || meta?.category : null;
              return (
                <div
                  key={c.discordId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "13px 20px",
                    gap: 12,
                    borderBottom:
                      i < scCh.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 9,
                        flexShrink: 0,
                        background: isSubnet
                          ? "rgba(59,130,246,.1)"
                          : "rgba(255,255,255,.04)",
                        border: isSubnet
                          ? "1px solid rgba(59,130,246,.2)"
                          : "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: isSubnet ? 12 : 15,
                        fontWeight: 700,
                        color: isSubnet ? "#93c5fd" : "var(--muted)",
                        fontFamily: "var(--mono)",
                      }}
                    >
                      {isSubnet ? num : "#"}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {displayName}
                        </span>
                        {category && (
                          <Badge color="purple">{category}</Badge>
                        )}
                      </div>
                      {isSubnet && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--muted)",
                            marginTop: 1,
                          }}
                        >
                          Subnet {num}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexShrink: 0,
                    }}
                  >
                    <Badge color={c.scrapeEnabled ? "green" : "gray"}>
                      {c.scrapeEnabled ? "Scraping" : "Off"}
                    </Badge>
                    <Toggle
                      on={c.scrapeEnabled}
                      onToggle={() => toggleCh(c.discordId, c.scrapeEnabled)}
                    />
                  </div>
                </div>
              );
            })
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
            {pag ? "Browse scraped messages" : "Loading…"}
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
                    background: "rgba(148,163,184,.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                    marginTop: 2,
                  }}
                >
                  {m.source === "github" ? "🐙" : "💬"}
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
                  <div
                    style={{
                      padding: "20px 22px",
                      fontSize: 14,
                      color: "#cbd5e1",
                      lineHeight: 1.75,
                    }}
                  >
                    <RichText text={result.answer} />
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


// ── SETTINGS ─────────────────────────────────────────────────────────────────
// function Settings() {
//   const [saved, setSaved] = useState(false);
//   const F = ({ label, type = "text", placeholder, defaultValue = "" }) => (
//     <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
//       <label
//         style={{
//           fontSize: 12,
//           fontWeight: 600,
//           color: "var(--muted)",
//           textTransform: "uppercase",
//           letterSpacing: ".06em",
//         }}
//       >
//         {label}
//       </label>
//       <input
//         type={type}
//         defaultValue={defaultValue}
//         placeholder={placeholder}
//       />
//     </div>
//   );
//   return (
//     <div
//       style={{
//         display: "flex",
//         flexDirection: "column",
//         gap: 20,
//         maxWidth: 620,
//       }}
//     >
//       <div className="fu">
//         <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
//           Settings
//         </h2>
//         <p style={{ color: "var(--muted)", fontSize: 14 }}>
//           API keys and configuration
//         </p>
//       </div>
//       {[
//         {
//           title: "Discord",
//           e: "🤖",
//           f: [
//             { label: "Bot Token", type: "password", placeholder: "MTxxxxxxx…" },
//           ],
//         },
//         {
//           title: "Groq AI",
//           e: "🧠",
//           f: [
//             { label: "API Key", type: "password", placeholder: "gsk_…" },
//             {
//               label: "Model",
//               placeholder: "llama-3.3-70b-versatile",
//               defaultValue: "llama-3.3-70b-versatile",
//             },
//           ],
//         },
//         {
//           title: "GitHub",
//           e: "🐙",
//           f: [
//             {
//               label: "Personal Access Token",
//               type: "password",
//               placeholder: "ghp_…",
//             },
//           ],
//         },
//       ].map((s, i) => (
//         <Card key={s.title} className={`fu${i + 1}`} style={{ padding: 24 }}>
//           <div
//             style={{
//               display: "flex",
//               alignItems: "center",
//               gap: 8,
//               marginBottom: 20,
//             }}
//           >
//             <span style={{ fontSize: 20 }}>{s.e}</span>
//             <span style={{ fontSize: 15, fontWeight: 700 }}>{s.title}</span>
//           </div>
//           <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
//             {s.f.map((f) => (
//               <F key={f.label} {...f} />
//             ))}
//           </div>
//         </Card>
//       ))}
//       <div
//         className="fu4"
//         style={{
//           padding: "16px 20px",
//           background: "rgba(59,130,246,.06)",
//           border: "1px solid rgba(59,130,246,.15)",
//           borderRadius: 12,
//         }}
//       >
//         <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
//           ℹ️ Note
//         </div>
//         <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
//           Edit{" "}
//           <code
//             style={{
//               fontFamily: "var(--mono)",
//               background: "rgba(255,255,255,.06)",
//               padding: "1px 6px",
//               borderRadius: 4,
//             }}
//           >
//             backend/.env
//           </code>{" "}
//           directly and restart the server for changes to take effect.
//         </p>
//       </div>
//       <button
//         className="fu4"
//         onClick={() => {
//           setSaved(true);
//           setTimeout(() => setSaved(false), 2500);
//         }}
//         style={{
//           alignSelf: "flex-start",
//           padding: "12px 28px",
//           background: saved
//             ? "rgba(16,185,129,.2)"
//             : "linear-gradient(135deg,#3b82f6,#6366f1)",
//           border: saved ? "1px solid rgba(16,185,129,.4)" : "none",
//           color: saved ? "var(--green)" : "white",
//           borderRadius: 10,
//           fontSize: 14,
//           fontWeight: 600,
//           cursor: "pointer",
//           transition: "all .3s",
//         }}
//       >
//         {saved ? "✓ Saved!" : "Save Configuration"}
//       </button>
//     </div>
//   );
// }

// ── HISTORY PAGE ─────────────────────────────────────────────────────────────
// Drop-in addition to your existing frontend file.
// 1. Add "history" to the NAV array:
//    { id:"history", icon:"◷", label:"History" }
// 2. Add History to PAGES map:
//    history: History
// 3. Paste this entire function into the file alongside the other page components.

function History() {
  const [timeline, setTimeline] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("timeline"); // "timeline" | "topics"
  const [expanded, setExpanded] = useState(new Set());
  const [detailItem, setDetail] = useState(null); // full detail modal
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      api("/analytics/history/timeline?limit=200"),
      api("/analytics/history/topics"),
    ])
      .then(([tl, tp]) => {
        setTimeline(tl);
        setTopics(tp);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── helpers
  const sentColor = (s) =>
    s === "positive"
      ? "#10b981"
      : s === "negative"
        ? "#ef4444"
        : s === "mixed"
          ? "#f59e0b"
          : "#64748b";

  const typeIcon = (t) =>
    t === "daily_summary"
      ? "🧠"
      : t === "trend_analysis"
        ? "📈"
        : t === "custom"
          ? "💬"
          : "◎";

  const typeLabel = (t) =>
    t === "daily_summary"
      ? "Summary"
      : t === "trend_analysis"
        ? "Trends"
        : t === "custom"
          ? "Ask AI"
          : t;

  const confidenceColor = (c) =>
    c === "HIGH" ? "#10b981" : c === "MEDIUM" ? "#f59e0b" : "#64748b";

  const ago = (iso) => {
    const d = Date.now() - new Date(iso).getTime();
    const h = Math.floor(d / 3.6e6);
    const days = Math.floor(h / 24);
    if (days > 30) return `${Math.floor(days / 30)}mo ago`;
    if (days > 0) return `${days}d ago`;
    if (h > 0) return `${h}h ago`;
    return `${Math.floor(d / 6e4)}m ago`;
  };

  // ── filter timeline items
  const filteredTimeline = timeline
    .map((month) => ({
      ...month,
      items: month.items.filter((item) => {
        if (filterType !== "all" && item.type !== filterType) return false;
        if (search) {
          const s = search.toLowerCase();
          const inTopics = [...item.keyTopics, ...item.trendingTopics].some(
            (t) => t.toLowerCase().includes(s),
          );
          const inName = item.targetName?.toLowerCase().includes(s);
          const inSummary = (item.summary || "").toLowerCase().includes(s);
          return inTopics || inName || inSummary;
        }
        return true;
      }),
    }))
    .filter((m) => m.items.length > 0);

  // ── topic trend sparkline (simple bar)
  const Sparkline = ({ data }) => {
    if (!data?.length) return null;
    const max = Math.max(...data.map((d) => d.count), 1);
    return (
      <div
        style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 24 }}
      >
        {data.slice(-12).map((d, i) => (
          <div
            key={i}
            title={`${d.month}: ${d.count}`}
            style={{
              width: 6,
              borderRadius: 2,
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
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.7)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 680,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            background: "var(--card)",
            zIndex: 1,
            borderRadius: "20px 20px 0 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{typeIcon(item.type)}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {typeLabel(item.type)}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {item.targetName} ·{" "}
                {new Date(item.generatedAt).toLocaleString()}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              color: "var(--muted)",
              fontSize: 20,
              cursor: "pointer",
              border: "none",
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Channels */}
          {item.channels?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {item.channels.map((c) => (
                <Badge key={c} color="indigo">
                  #{c}
                </Badge>
              ))}
              
            </div>
          )}

          {/* Sentiment */}
          {item.sentiment && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: ".07em",
                }}
              >
                Sentiment
              </span>
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  background: `${sentColor(item.sentiment)}22`,
                  color: sentColor(item.sentiment),
                  border: `1px solid ${sentColor(item.sentiment)}44`,
                }}
              >
                {item.sentiment}
              </span>
            </div>
          )}

          {/* Summary */}
          {item.summary && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  marginBottom: 10,
                }}
              >
                Summary
              </div>
              {Array.isArray(item.summary) ? (
                item.summary.map((s, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", gap: 8, marginBottom: 6 }}
                  >
                    <span
                      style={{
                        color: "var(--accent)",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      •
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: "#cbd5e1",
                        lineHeight: 1.6,
                      }}
                    >
                      {s}
                    </span>
                  </div>
                ))
              ) : (
                <p
                  style={{
                    fontSize: 13,
                    color: "#cbd5e1",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {item.summary}
                </p>
              )}
            </div>
          )}

          {/* Key Topics */}
          {[...item.keyTopics, ...item.trendingTopics].filter(Boolean).length >
            0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  marginBottom: 10,
                }}
              >
                Topics
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[...new Set([...item.keyTopics, ...item.trendingTopics])].map(
                  (t, i) => (
                    <span
                      key={i}
                      style={{
                        padding: "4px 11px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 500,
                        background: "rgba(59,130,246,.1)",
                        border: "1px solid rgba(59,130,246,.2)",
                        color: "#93c5fd",
                      }}
                    >
                      {t}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Emerging Signals */}
          {item.emergingSignals?.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  marginBottom: 10,
                }}
              >
                Emerging Signals
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {item.emergingSignals.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,.03)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#e2e8f0",
                        }}
                      >
                        {s.signal}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 4,
                          background: `${confidenceColor(s.confidence)}22`,
                          color: confidenceColor(s.confidence),
                          border: `1px solid ${confidenceColor(s.confidence)}44`,
                          textTransform: "uppercase",
                          letterSpacing: ".06em",
                        }}
                      >
                        {s.confidence}
                      </span>
                    </div>
                    {s.description && (
                      <p
                        style={{
                          fontSize: 12,
                          color: "#94a3b8",
                          margin: "0 0 4px",
                          lineHeight: 1.5,
                        }}
                      >
                        {s.description}
                      </p>
                    )}
                    {s.evidence && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--dim)",
                          fontStyle: "italic",
                          borderLeft: "2px solid var(--border)",
                          paddingLeft: 8,
                        }}
                      >
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
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  marginBottom: 10,
                }}
              >
                Key Insights
              </div>
              {item.highlights.map((h, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: 8, marginBottom: 6 }}
                >
                  <span
                    style={{
                      color: "var(--green)",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    ◆
                  </span>
                  <span
                    style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.55 }}
                  >
                    {h}
                  </span>
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
      {filteredTimeline.length === 0 ? (
        <Empty msg="No analyses match your filters" />
      ) : (
        filteredTimeline.map((month, mi) => (
          <div key={month.month}>
            {/* Month header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  padding: "6px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  background:
                    "linear-gradient(135deg,rgba(59,130,246,.15),rgba(139,92,246,.1))",
                  border: "1px solid rgba(59,130,246,.25)",
                  color: "#93c5fd",
                }}
              >
                {month.label}
              </div>
              <div
                style={{ height: 1, flex: 1, background: "var(--border)" }}
              />
              <span
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  fontFamily: "var(--mono)",
                }}
              >
                {month.count} {month.count === 1 ? "analysis" : "analyses"}
              </span>
            </div>

            {/* Items in this month */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                paddingLeft: 16,
                borderLeft: "2px solid var(--border)",
              }}
            >
              {month.items.map((item, ii) => {
                const allTopics = [
                  ...new Set([...item.keyTopics, ...item.trendingTopics]),
                ];
                const isExpanded = expanded.has(item._id);

                return (
                  <div
                    key={item._id}
                    style={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      overflow: "hidden",
                      transition: "border-color .15s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor =
                        "rgba(59,130,246,.3)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = "var(--border)")
                    }
                  >
                    {/* Item header row */}
                    <div
                      onClick={() =>
                        setExpanded((prev) => {
                          const n = new Set(prev);
                          n.has(item._id)
                            ? n.delete(item._id)
                            : n.add(item._id);
                          return n;
                        })
                      }
                      style={{
                        padding: "14px 18px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        cursor: "pointer",
                      }}
                    >
                      {/* Type icon */}
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 9,
                          flexShrink: 0,
                          background: "rgba(59,130,246,.08)",
                          border: "1px solid rgba(59,130,246,.15)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 15,
                        }}
                      >
                        {typeIcon(item.type)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 4,
                            flexWrap: "wrap",
                          }}
                        >
                          <Badge color="blue">{typeLabel(item.type)}</Badge>
                          {item.sentiment && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: 5,
                                background: `${sentColor(item.sentiment)}18`,
                                color: sentColor(item.sentiment),
                                border: `1px solid ${sentColor(item.sentiment)}35`,
                              }}
                            >
                              {item.sentiment}
                            </span>
                          )}
                          {item.channels?.length > 0 && (
                            <span
                              style={{ fontSize: 12, color: "var(--muted)" }}
                            >
                              {item.channels
                                .slice(0, 3)
                                .map((c) => `#${c}`)
                                .join(", ")}
                              {item.channels.length > 3
                                ? ` +${item.channels.length - 3}`
                                : ""}
                            </span>
                          )}
                        </div>
                        {/* Topic chips preview */}
                        {allTopics.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 4,
                            }}
                          >
                            {allTopics.slice(0, 5).map((t, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: 11,
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  background: "rgba(255,255,255,.05)",
                                  border: "1px solid var(--border)",
                                  color: "var(--muted)",
                                }}
                              >
                                {t}
                              </span>
                            ))}
                            {allTopics.length > 5 && (
                              <span
                                style={{ fontSize: 11, color: "var(--dim)" }}
                              >
                                +{allTopics.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ fontSize: 11, color: "var(--dim)" }}>
                          {ago(item.generatedAt)}
                        </span>
                        {/* View detail button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetail(item);
                          }}
                          style={{
                            padding: "5px 12px",
                            background: "rgba(59,130,246,.1)",
                            border: "1px solid rgba(59,130,246,.2)",
                            borderRadius: 7,
                            color: "#93c5fd",
                            fontSize: 12,
                            cursor: "pointer",
                            fontFamily: "var(--font)",
                          }}
                        >
                          View →
                        </button>
                        <span
                          style={{
                            color: "var(--muted)",
                            fontSize: 14,
                            transition: "transform .2s",
                            transform: isExpanded ? "rotate(180deg)" : "none",
                          }}
                        >
                          ▾
                        </span>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div
                        style={{
                          padding: "0 18px 16px",
                          borderTop: "1px solid var(--border)",
                        }}
                      >
                        {/* Summary */}
                        {item.summary && (
                          <div style={{ paddingTop: 14 }}>
                            {Array.isArray(item.summary) ? (
                              item.summary.slice(0, 3).map((s, i) => (
                                <div
                                  key={i}
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    marginBottom: 5,
                                  }}
                                >
                                  <span
                                    style={{
                                      color: "var(--accent)",
                                      flexShrink: 0,
                                    }}
                                  >
                                    •
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 13,
                                      color: "#94a3b8",
                                      lineHeight: 1.55,
                                    }}
                                  >
                                    {s}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p
                                style={{
                                  fontSize: 13,
                                  color: "#94a3b8",
                                  lineHeight: 1.6,
                                  margin: 0,
                                }}
                              >
                                {typeof item.summary === "string"
                                  ? item.summary.substring(0, 300) +
                                    (item.summary.length > 300 ? "…" : "")
                                  : ""}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Emerging signals preview */}
                        {item.emergingSignals?.length > 0 && (
                          <div
                            style={{
                              marginTop: 12,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--muted)",
                                textTransform: "uppercase",
                                letterSpacing: ".07em",
                                marginBottom: 4,
                              }}
                            >
                              Signals
                            </div>
                            {item.emergingSignals.slice(0, 3).map((s, i) => (
                              <div
                                key={i}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 10,
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    fontWeight: 700,
                                    background: `${confidenceColor(s.confidence)}22`,
                                    color: confidenceColor(s.confidence),
                                    border: `1px solid ${confidenceColor(s.confidence)}44`,
                                    textTransform: "uppercase",
                                    letterSpacing: ".05em",
                                    flexShrink: 0,
                                  }}
                                >
                                  {s.confidence}
                                </span>
                                <span
                                  style={{ fontSize: 12, color: "#94a3b8" }}
                                >
                                  {s.signal}
                                </span>
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
      )}
    </div>
  );

  // ── TOPICS TAB ──────────────────────────────────────────────────────────────
  const TopicsTab = () => {
    const [topicSearch, setTopicSearch] = useState("");
    const filtered = topics.filter(
      (t) =>
        !topicSearch ||
        t.label.toLowerCase().includes(topicSearch.toLowerCase()),
    );

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <input
          value={topicSearch}
          onChange={(e) => setTopicSearch(e.target.value)}
          placeholder="Search topics…"
          style={{ maxWidth: 320 }}
        />

        {filtered.length === 0 ? (
          <Empty msg="No topics found" />
        ) : (
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
                  borderBottom:
                    i < filtered.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                {/* Rank */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    flexShrink: 0,
                    background:
                      i < 3 ? "rgba(59,130,246,.15)" : "rgba(255,255,255,.04)",
                    border: `1px solid ${i < 3 ? "rgba(59,130,246,.3)" : "var(--border)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: i < 3 ? "#93c5fd" : "var(--muted)",
                  }}
                >
                  #{i + 1}
                </div>

                {/* Topic name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      marginBottom: 4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {topic.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    Appeared in {topic.monthlyData.length} month
                    {topic.monthlyData.length !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Sparkline */}
                <Sparkline data={topic.monthlyData} />

                {/* Count */}
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: "var(--mono)",
                    color: "#93c5fd",
                    minWidth: 32,
                    textAlign: "right",
                  }}
                >
                  {topic.totalCount}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    );
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {detailItem && (
        <DetailModal item={detailItem} onClose={() => setDetail(null)} />
      )}

      {/* Header */}
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
            Analysis History
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            Track discussions over time ·{" "}
            {timeline.reduce((s, m) => s + m.count, 0)} total analyses
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
            ["timeline", "◷ Timeline"],
            ["topics", "◈ Topics"],
          ].map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "7px 18px",
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
                fontFamily: "var(--font)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters — only on timeline tab */}
      {tab === "timeline" && (
        <div
          className="fu1"
          style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
        >
          <div style={{ flex: 1, position: "relative", minWidth: 200 }}>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted)",
              }}
            >
              ⌕
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topics, channels, summaries…"
              style={{ paddingLeft: 36 }}
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="all">All Types</option>
            <option value="daily_summary">Summary</option>
            <option value="trend_analysis">Trends</option>
            <option value="custom">Ask AI</option>
          </select>
          <button
            onClick={() => {
              setSearch("");
              setFilterType("all");
            }}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--muted)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Stats row */}
      {!loading && tab === "timeline" && (
        <div
          className="fu2"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 12,
          }}
        >
          {[
            {
              label: "Total Analyses",
              val: timeline.reduce((s, m) => s + m.count, 0),
              icon: "◎",
            },
            { label: "Months Tracked", val: timeline.length, icon: "◷" },
            { label: "Topics Extracted", val: topics.length, icon: "◈" },
            {
              label: "Latest",
              val: timeline[0]?.label || "—",
              icon: "◆",
              small: true,
            },
          ].map((c, i) => (
            <div
              key={i}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "14px 18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: ".07em",
                  }}
                >
                  {c.label}
                </span>
                <span style={{ opacity: 0.4 }}>{c.icon}</span>
              </div>
              <div
                style={{
                  fontSize: c.small ? 14 : 22,
                  fontWeight: 700,
                  color: "#93c5fd",
                }}
              >
                {c.val}
              </div>
            </div>
          ))}
        </div>
      )}

      {err && <ErrBox msg={err} />}

      {loading ? (
        <div
          style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}
        >
          <Spinner size={36} />
        </div>
      ) : tab === "timeline" ? (
        <TimelineTab />
      ) : (
        <TopicsTab />
      )}
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
    // overview: Overview,
    servers: Servers,
    analytics: Analytics,
    settings: SubnetSettings,
    // history: History,
    subnets: SubnetIntel,
  };
  const Page = PAGES[page] || SubnetIntel;

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