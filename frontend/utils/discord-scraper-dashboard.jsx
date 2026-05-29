import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

// ── Mock data ────────────────────────────────────────────────────────────────
const MOCK_SERVERS = [
  { discordId: "1001", name: "Rust Lang Community", memberCount: 14200, scrapeEnabled: true, iconUrl: null },
  { discordId: "1002", name: "Next.js Devs", memberCount: 28900, scrapeEnabled: true, iconUrl: null },
  { discordId: "1003", name: "Open Source Hub", memberCount: 5400, scrapeEnabled: false, iconUrl: null },
];
const MOCK_CHANNELS = [
  { discordId: "c001", serverId: "1001", name: "general", scrapeEnabled: true, messageCount: 12400 },
  { discordId: "c002", serverId: "1001", name: "help", scrapeEnabled: true, messageCount: 8900 },
  { discordId: "c003", serverId: "1001", name: "showcase", scrapeEnabled: false, messageCount: 2100 },
  { discordId: "c004", serverId: "1002", name: "general", scrapeEnabled: true, messageCount: 31000 },
  { discordId: "c005", serverId: "1002", name: "jobs", scrapeEnabled: true, messageCount: 4500 },
];
const MOCK_MESSAGES = Array.from({ length: 18 }, (_, i) => ({
  _id: `m${i}`,
  discordId: `msg${i}`,
  authorUsername: ["alice_dev", "bob_coder", "charlie_rust", "diana_js", "evan_ops"][i % 5],
  content: [
    "Just pushed a new crate for async error handling — feedback welcome!",
    "Has anyone benchmarked tokio vs async-std on M3 chips?",
    "The new Next.js app router is incredible once you understand it",
    "Looking for contributors on my open source Rust HTTP client",
    "Weekly standup notes posted in #announcements",
    "PSA: v2.1.0 just dropped with breaking changes in the query API",
    "Anyone have experience deploying to fly.io with websockets?",
    "Sharing my talk slides from RustConf 2025 — DM me",
    "Hot take: bun > node for most backend use cases now",
    "PR merged! Thanks everyone for the thorough review 🎉",
  ][i % 10],
  discordCreatedAt: new Date(Date.now() - i * 3600000 * 2).toISOString(),
  source: i % 7 === 0 ? "github" : "discord",
  sentiment: ["positive", "neutral", "negative", "positive", "neutral"][i % 5],
  channelId: ["c001","c002","c004","c005"][i % 4],
}));
const DAILY_ACTIVITY = [
  { date: "Apr 29", messages: 420 }, { date: "Apr 30", messages: 380 },
  { date: "May 01", messages: 510 }, { date: "May 02", messages: 290 },
  { date: "May 03", messages: 640 }, { date: "May 04", messages: 580 },
  { date: "May 05", messages: 470 },
];
const SOURCE_DIST = [
  { name: "Discord", value: 78, color: "#5865F2" },
  { name: "GitHub", value: 14, color: "#24292F" },
  { name: "Twitter", value: 8, color: "#1DA1F2" },
];
const SENTIMENT_DATA = [
  { period: "Mon", positive: 62, neutral: 28, negative: 10 },
  { period: "Tue", positive: 55, neutral: 32, negative: 13 },
  { period: "Wed", positive: 71, neutral: 21, negative: 8 },
  { period: "Thu", positive: 48, neutral: 38, negative: 14 },
  { period: "Fri", positive: 66, neutral: 24, negative: 10 },
  { period: "Sat", positive: 73, neutral: 20, negative: 7 },
  { period: "Sun", positive: 69, neutral: 22, negative: 9 },
];
const MOCK_AI_SUMMARY = {
  summary: "This week's community activity was dominated by discussions around the recent v2.1.0 release, with significant engagement around breaking changes in the query API. The community responded mostly positively, with active contributors jumping in to help with migration questions. GitHub activity spiked on Tuesday following a major PR merge. Sentiment remained broadly positive with a mid-week dip correlating with a reported regression bug (since patched).",
  keyTopics: ["v2.1.0 release", "query API migration", "async runtime benchmarks", "deployment patterns", "contributor onboarding"],
  sentiment: "positive",
  highlights: [
    "PR merged with 47 approvals — highest this quarter",
    "RustConf 2025 talk slides shared, 200+ DM requests",
    "New crate for async error handling gained 120 GitHub stars in 48h",
  ],
  activeUsers: ["alice_dev", "bob_coder", "diana_js"],
  messageCount: 3290,
  date: "2026-05-05",
};

// ── Icons ────────────────────────────────────────────────────────────────────
const Icon = ({ path, size = 18, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={path} />
  </svg>
);
const ICONS = {
  hash: "M4 9h16M4 15h16M10 3L8 21M16 3l-2 18",
  server: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z",
  message: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  brain: "M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  settings: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  search: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  filter: "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  refresh: "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  trending: "M23 6l-9.5 9.5-5-5L1 18",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
  github: "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  check: "M20 6L9 17l-5-5",
  x: "M18 6L6 18M6 6l12 12",
  dot: "M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0",
};

// ── Shared components ─────────────────────────────────────────────────────────
const Badge = ({ children, color = "blue" }) => {
  const colors = {
    blue: "bg-blue-500/15 text-blue-300 border-blue-500/20",
    green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    red: "bg-red-500/15 text-red-300 border-red-500/20",
    yellow: "bg-amber-500/15 text-amber-300 border-amber-500/20",
    purple: "bg-violet-500/15 text-violet-300 border-violet-500/20",
    gray: "bg-white/5 text-zinc-400 border-white/10",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[color]}`}>
      {children}
    </span>
  );
};

const Stat = ({ label, value, sub, accent = false }) => (
  <div className={`rounded-xl p-5 border ${accent ? "bg-indigo-600/10 border-indigo-500/30" : "bg-white/[0.03] border-white/[0.06]"}`}>
    <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-3xl font-bold tabular-nums ${accent ? "text-indigo-300" : "text-white"}`}>{value}</p>
    {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
  </div>
);

const sentimentColor = s => ({ positive: "text-emerald-400", negative: "text-red-400", neutral: "text-zinc-400", mixed: "text-amber-400" }[s] || "text-zinc-400");
const sourceIcon = s => ({ github: ICONS.github, discord: ICONS.server, twitter: ICONS.message }[s] || ICONS.dot);

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ email: "admin@example.com", password: "admin123" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true); setErr("");
    await new Promise(r => setTimeout(r, 900));
    if (form.password.length >= 3) {
      onLogin({ username: "Admin", email: form.email, role: "admin" }, "mock_token");
    } else { setErr("Invalid credentials"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center p-4" style={{ fontFamily: "'DM Mono', 'Fira Mono', monospace" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M20 4l-2 14.5-6 2-6-2L4 4" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M6 8h12M5.5 12h13M7 16h10" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">DataHarvest</h1>
          <p className="text-zinc-500 text-sm mt-1">Community Intelligence Platform</p>
        </div>

        <form onSubmit={handle} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-8 space-y-4">
          {err && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-widest block mb-2">Email</label>
            <input
              type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-widest block mb-2">Password</label>
            <input
              type="password" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? "Authenticating…" : "Sign In"}
          </button>
        </form>
        <p className="text-center text-xs text-zinc-600 mt-4">Demo: any email + password ≥ 3 chars</p>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV = [
  { id: "overview", label: "Overview", icon: ICONS.activity },
  { id: "servers", label: "Servers", icon: ICONS.server },
  { id: "messages", label: "Messages", icon: ICONS.message },
  { id: "analytics", label: "AI Insights", icon: ICONS.brain },
  { id: "scraper", label: "Scraper Jobs", icon: ICONS.download },
  { id: "settings", label: "Settings", icon: ICONS.settings },
];

function Sidebar({ active, onNav, user, onLogout }) {
  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-white/[0.06] bg-[#0d0e14]">
      <div className="px-4 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/25 border border-indigo-500/30 flex items-center justify-center">
            <Icon path={ICONS.zap} size={14} className="text-indigo-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-none">DataHarvest</div>
            <div className="text-[10px] text-zinc-600 mt-0.5">v1.0.0 · prod</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(n => (
          <button key={n.id} onClick={() => onNav(n.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
              active === n.id
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/20"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
            }`}>
            <Icon path={n.icon} size={15} />
            {n.label}
          </button>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="text-xs">
              <div className="text-zinc-300 font-medium">{user?.username}</div>
              <div className="text-zinc-600">{user?.role}</div>
            </div>
          </div>
          <button onClick={onLogout} className="text-zinc-600 hover:text-zinc-400 transition-colors">
            <Icon path={ICONS.logout} size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Overview</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Last 7 days across all connected sources</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Total Messages" value="48.3K" sub="+12% vs last week" accent />
        <Stat label="Active Servers" value="3" sub="2 scraping enabled" />
        <Stat label="Channels Tracked" value="5" sub="of 12 total" />
        <Stat label="AI Analyses" value="24" sub="0.4K tokens used" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Daily Message Volume</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={DAILY_ACTIVITY}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#52525b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#52525b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#13141a", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="messages" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Source Distribution</h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={SOURCE_DIST} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                dataKey="value" paddingAngle={3}>
                {SOURCE_DIST.map((s, i) => <Cell key={i} fill={s.color} opacity={0.85} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#13141a", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {SOURCE_DIST.map(s => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-zinc-400">{s.name}</span>
                </div>
                <span className="text-zinc-300 font-medium">{s.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Sentiment Trend (7 days)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={SENTIMENT_DATA} barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#52525b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#52525b" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#13141a", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="positive" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="neutral" fill="#3f3f46" radius={[3, 3, 0, 0]} />
            <Bar dataKey="negative" fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Servers ───────────────────────────────────────────────────────────────────
function ServersPage() {
  const [servers, setServers] = useState(MOCK_SERVERS);
  const [selectedServer, setSelectedServer] = useState(null);
  const channels = MOCK_CHANNELS.filter(c => c.serverId === selectedServer);

  const toggleServer = id => setServers(s => s.map(sv => sv.discordId === id ? { ...sv, scrapeEnabled: !sv.scrapeEnabled } : sv));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Servers & Channels</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Configure which servers and channels to monitor</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Discord Servers</span>
            <Badge color="gray">{servers.length}</Badge>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {servers.map(sv => (
              <div key={sv.discordId}
                onClick={() => setSelectedServer(sv.discordId)}
                className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors ${selectedServer === sv.discordId ? "bg-indigo-600/10" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-300">
                    {sv.name[0]}
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">{sv.name}</div>
                    <div className="text-xs text-zinc-500">{sv.memberCount?.toLocaleString()} members</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={sv.scrapeEnabled ? "green" : "gray"}>{sv.scrapeEnabled ? "Active" : "Paused"}</Badge>
                  <button
                    onClick={e => { e.stopPropagation(); toggleServer(sv.discordId); }}
                    className={`w-9 h-5 rounded-full transition-colors ${sv.scrapeEnabled ? "bg-indigo-600" : "bg-zinc-700"} relative`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${sv.scrapeEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
              {selectedServer ? `Channels — ${servers.find(s => s.discordId === selectedServer)?.name}` : "Select a Server"}
            </span>
          </div>
          {!selectedServer ? (
            <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">← Select a server</div>
          ) : channels.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">No channels found</div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {channels.map(ch => (
                <div key={ch.discordId} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon path={ICONS.hash} size={14} className="text-zinc-600" />
                    <span className="text-sm text-zinc-300">{ch.name}</span>
                    <span className="text-xs text-zinc-600">{ch.messageCount?.toLocaleString()} msgs</span>
                  </div>
                  <Badge color={ch.scrapeEnabled ? "green" : "gray"}>{ch.scrapeEnabled ? "On" : "Off"}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Messages ──────────────────────────────────────────────────────────────────
function MessagesPage() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sentimentFilter, setSentimentFilter] = useState("all");

  const filtered = MOCK_MESSAGES.filter(m => {
    if (search && !m.content.toLowerCase().includes(search.toLowerCase()) && !m.authorUsername.toLowerCase().includes(search.toLowerCase())) return false;
    if (sourceFilter !== "all" && m.source !== sourceFilter) return false;
    if (sentimentFilter !== "all" && m.sentiment !== sentimentFilter) return false;
    return true;
  });

  const timeAgo = (iso) => {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Messages</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{filtered.length} results</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-white/[0.07] rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
          <Icon path={ICONS.download} size={13} />Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Icon path={ICONS.search} size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search messages or authors…"
            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40" />
        </div>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none">
          <option value="all">All Sources</option>
          <option value="discord">Discord</option>
          <option value="github">GitHub</option>
          <option value="twitter">Twitter</option>
        </select>
        <select value={sentimentFilter} onChange={e => setSentimentFilter(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none">
          <option value="all">All Sentiment</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
        </select>
      </div>

      {/* Message list */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="divide-y divide-white/[0.04]">
          {filtered.map(msg => (
            <div key={msg._id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-indigo-600/30 to-violet-600/30 border border-white/10 flex items-center justify-center text-xs font-bold text-indigo-300 mt-0.5">
                    {msg.authorUsername[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{msg.authorUsername}</span>
                      <Badge color={msg.source === "github" ? "gray" : msg.source === "twitter" ? "blue" : "purple"}>{msg.source}</Badge>
                      <span className={`text-xs ${sentimentColor(msg.sentiment)}`}>● {msg.sentiment}</span>
                    </div>
                    <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{msg.content}</p>
                  </div>
                </div>
                <span className="text-xs text-zinc-600 shrink-0 mt-1">{timeAgo(msg.discordCreatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── AI Analytics ──────────────────────────────────────────────────────────────
function AnalyticsPage() {
  const [view, setView] = useState("summary");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(MOCK_AI_SUMMARY);
  const [question, setQuestion] = useState("");

  const run = async (type) => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1800));
    setResult(MOCK_AI_SUMMARY);
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">AI Insights</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Powered by GPT-4o mini · results cached 24h</p>
        </div>
        <div className="flex items-center gap-2">
          {["summary", "trends", "ask"].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${view === v ? "bg-indigo-600/25 text-indigo-300 border border-indigo-500/30" : "text-zinc-500 hover:text-zinc-300 border border-transparent"}`}>
              {v === "ask" ? "Ask AI" : v === "trends" ? "Trends" : "Summary"}
            </button>
          ))}
        </div>
      </div>

      {view === "ask" && (
        <div className="flex gap-3">
          <input value={question} onChange={e => setQuestion(e.target.value)}
            placeholder="e.g. What are the most common pain points users mention?"
            className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40" />
          <button onClick={() => run("custom")}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">
            {loading ? "…" : "Ask"}
          </button>
        </div>
      )}

      {view !== "ask" && (
        <button onClick={() => run(view)} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-sm rounded-lg transition-colors">
          <Icon path={loading ? ICONS.refresh : ICONS.brain} size={14} className={loading ? "animate-spin" : ""} />
          {loading ? "Generating…" : `Generate ${view === "summary" ? "Daily Summary" : "Trend Analysis"}`}
        </button>
      )}

      {loading && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-zinc-500">Analyzing {Math.floor(Math.random() * 400 + 200)} messages…</p>
          </div>
        </div>
      )}

      {!loading && result && (
        <div className="space-y-4">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Icon path={ICONS.brain} size={14} className="text-indigo-400" />
              <span className="text-sm font-semibold text-zinc-300">Summary</span>
              <Badge color={result.sentiment === "positive" ? "green" : result.sentiment === "negative" ? "red" : "gray"}>
                {result.sentiment}
              </Badge>
              <span className="ml-auto text-xs text-zinc-600">{result.messageCount?.toLocaleString()} messages analyzed</span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">{result.summary}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Key Topics</h4>
              <div className="flex flex-wrap gap-2">
                {result.keyTopics?.map(t => (
                  <span key={t} className="px-2 py-1 bg-indigo-600/10 border border-indigo-500/20 text-indigo-300 rounded text-xs">{t}</span>
                ))}
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Highlights</h4>
              <ul className="space-y-1.5">
                {result.highlights?.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                    <Icon path={ICONS.check} size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Scraper Jobs ──────────────────────────────────────────────────────────────
function ScraperPage() {
  const [jobs, setJobs] = useState([
    { id: "j1", status: "completed", channelId: "c001", count: 12480, completedAt: new Date(Date.now() - 7200000).toISOString() },
    { id: "j2", status: "running", serverId: "1002", startedAt: new Date(Date.now() - 1200000).toISOString() },
    { id: "j3", status: "failed", channelId: "c003", error: "Rate limit exceeded", startedAt: new Date(Date.now() - 86400000).toISOString() },
  ]);
  const [form, setForm] = useState({ type: "channel", id: "", limit: "" });

  const statusColor = { completed: "green", running: "blue", failed: "red" };
  const statusIcon = { completed: ICONS.check, running: ICONS.refresh, failed: ICONS.x };

  const startJob = () => {
    const newJob = { id: `j${Date.now()}`, status: "running", ...( form.type === "channel" ? { channelId: form.id } : { serverId: form.id }), startedAt: new Date().toISOString() };
    setJobs(j => [newJob, ...j]);
    setTimeout(() => setJobs(j => j.map(jj => jj.id === newJob.id ? { ...jj, status: "completed", count: Math.floor(Math.random() * 5000) } : jj)), 3000);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white">Scraper Jobs</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Trigger backfills and monitor job status</p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Start New Job</h3>
        <div className="grid grid-cols-3 gap-3">
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none">
            <option value="channel">Channel Backfill</option>
            <option value="server">Server Backfill</option>
            <option value="github">GitHub Import</option>
          </select>
          <input value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
            placeholder={form.type === "github" ? "owner/repo" : "Channel or Server ID"}
            className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40" />
          <button onClick={startJob}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">
            Start Job
          </button>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Recent Jobs</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {jobs.map(job => (
            <div key={job.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${job.status === "completed" ? "bg-emerald-500/15" : job.status === "running" ? "bg-blue-500/15" : "bg-red-500/15"}`}>
                  <Icon path={statusIcon[job.status]} size={13} className={job.status === "completed" ? "text-emerald-400" : job.status === "running" ? "text-blue-400 animate-spin" : "text-red-400"} />
                </div>
                <div>
                  <div className="text-sm text-zinc-300 font-medium">
                    {job.channelId ? `Channel ${job.channelId}` : job.serverId ? `Server ${job.serverId}` : job.id}
                  </div>
                  <div className="text-xs text-zinc-600">
                    {job.error || (job.count ? `${job.count?.toLocaleString()} messages` : "In progress…")}
                  </div>
                </div>
              </div>
              <Badge color={statusColor[job.status]}>{job.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const Field = ({ label, placeholder, type = "text", defaultValue = "" }) => (
    <div>
      <label className="text-xs text-zinc-500 uppercase tracking-widest block mb-2">{label}</label>
      <input type={type} defaultValue={defaultValue} placeholder={placeholder}
        className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-white">Settings</h2>
        <p className="text-xs text-zinc-500 mt-0.5">API tokens and system configuration</p>
      </div>
      {[
        { title: "Discord", fields: [{ label: "Bot Token", placeholder: "MTxxxxxxx…", type: "password" }] },
        { title: "OpenAI", fields: [{ label: "API Key", placeholder: "sk-proj-…", type: "password" }, { label: "Model", placeholder: "gpt-4o-mini", defaultValue: "gpt-4o-mini" }] },
        { title: "GitHub", fields: [{ label: "Personal Access Token", placeholder: "ghp_…", type: "password" }] },
      ].map(section => (
        <div key={section.title} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300">{section.title}</h3>
          {section.fields.map(f => <Field key={f.label} {...f} />)}
        </div>
      ))}
      <button onClick={save}
        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">
        {saved ? <><Icon path={ICONS.check} size={14} />Saved!</> : "Save Configuration"}
      </button>
    </div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("overview");
  const [user, setUser] = useState(null);

  if (!user) return <LoginPage onLogin={(u) => setUser(u)} />;

  const pages = { overview: Overview, servers: ServersPage, messages: MessagesPage, analytics: AnalyticsPage, scraper: ScraperPage, settings: SettingsPage };
  const PageComponent = pages[page] || Overview;

  return (
    <div className="flex h-screen bg-[#0a0b0f] text-white overflow-hidden" style={{ fontFamily: "'DM Mono', 'Fira Mono', 'Courier New', monospace" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } 
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
      <Sidebar active={page} onNav={setPage} user={user} onLogout={() => setUser(null)} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <PageComponent />
        </div>
      </main>
    </div>
  );
}
