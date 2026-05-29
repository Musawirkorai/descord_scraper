import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

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
const setToken = t => { _token = t; };

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(_token ? { Authorization: `Bearer ${_token}` } : {}), ...(opts.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── SHARED ───────────────────────────────────────────────────────────────────
function Badge({ children, color = "gray" }) {
  const C = {
    blue:  ["rgba(59,130,246,.12)","#60a5fa","rgba(59,130,246,.2)"],
    green: ["rgba(16,185,129,.12)","#34d399","rgba(16,185,129,.2)"],
    red:   ["rgba(239,68,68,.12)","#f87171","rgba(239,68,68,.2)"],
    amber: ["rgba(245,158,11,.12)","#fbbf24","rgba(245,158,11,.2)"],
    purple:["rgba(139,92,246,.12)","#a78bfa","rgba(139,92,246,.2)"],
    cyan:  ["rgba(6,182,212,.12)","#22d3ee","rgba(6,182,212,.2)"],
    gray:  ["rgba(100,116,139,.1)","#94a3b8","rgba(100,116,139,.2)"],
    indigo:["rgba(99,102,241,.12)","#818cf8","rgba(99,102,241,.2)"],
  };
  const [bg,text,border] = C[color]||C.gray;
  return <span style={{display:"inline-flex",alignItems:"center",padding:"3px 9px",borderRadius:6,fontSize:12,fontWeight:500,background:bg,color:text,border:`1px solid ${border}`}}>{children}</span>;
}

const Card = ({ children, style={}, className="" }) =>
  <div className={className} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:16,...style}}>{children}</div>;

const CardHeader = ({ title, action }) => (
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid var(--border)"}}>
    <span style={{fontSize:12,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".08em"}}>{title}</span>
    {action}
  </div>
);

const Spinner = ({size=28}) => <div style={{width:size,height:size,border:"2px solid rgba(59,130,246,.2)",borderTop:"2px solid #3b82f6",borderRadius:"50%",animation:"spin 1s linear infinite"}} />;
const Empty = ({msg="No data"}) => <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"48px 24px",gap:12}}><span style={{fontSize:32,opacity:.3}}>◎</span><span style={{color:"var(--muted)",fontSize:14}}>{msg}</span></div>;
const ErrBox = ({msg}) => <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:10,padding:"12px 16px",fontSize:14,color:"#f87171"}}>⚠ {msg}</div>;

const Tip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return <div style={{background:"#1e293b",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"10px 14px",fontSize:13}}><div style={{color:"var(--muted)",marginBottom:6,fontWeight:600}}>{label}</div>{payload.map((p,i)=><div key={i} style={{color:p.color,display:"flex",gap:8,alignItems:"center",marginBottom:2}}><span style={{width:6,height:6,borderRadius:"50%",background:p.color,display:"inline-block"}}/>{p.name}: <strong>{p.value}</strong></div>)}</div>;
};

// ── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email,setEmail] = useState("admin@test.com");
  const [pass,setPass]   = useState("admin123");
  const [loading,setLoading] = useState(false);
  const [err,setErr] = useState("");

  const submit = async e => {
    e.preventDefault(); setLoading(true); setErr("");
    try {
      const d = await api("/auth/login",{method:"POST",body:JSON.stringify({email,password:pass})});
      setToken(d.token); onLogin(d.user,d.token);
    } catch(e) { setErr(e.message); }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:"20%",left:"50%",transform:"translateX(-50%)",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(59,130,246,.06) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)",backgroundSize:"60px 60px",pointerEvents:"none"}}/>
      <div className="fu" style={{width:"100%",maxWidth:420,padding:24,position:"relative"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{width:62,height:62,borderRadius:18,margin:"0 auto 18px",background:"linear-gradient(135deg,rgba(59,130,246,.2),rgba(139,92,246,.2))",border:"1px solid rgba(59,130,246,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>⚡</div>
          <h1 style={{fontSize:28,fontWeight:700,marginBottom:8}}><span className="gt">DataHarvest</span></h1>
          <p style={{color:"var(--muted)",fontSize:15}}>Community Intelligence Platform</p>
        </div>
        <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:18}}>
          {err && <ErrBox msg={err}/>}
          {[["Email","email",email,setEmail,"admin@test.com"],["Password","password",pass,setPass,"••••••••"]].map(([label,type,val,setter,ph])=>(
            <div key={label} style={{display:"flex",flexDirection:"column",gap:8}}>
              <label style={{fontSize:12,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em"}}>{label}</label>
              <input type={type} value={val} onChange={e=>setter(e.target.value)} placeholder={ph} required/>
            </div>
          ))}
          <button type="submit" disabled={loading} style={{marginTop:4,padding:"13px 24px",borderRadius:10,fontSize:15,fontWeight:600,background:loading?"rgba(59,130,246,.4)":"linear-gradient(135deg,#3b82f6,#6366f1)",color:"white",cursor:loading?"not-allowed":"pointer",border:"none",boxShadow:"0 4px 20px rgba(59,130,246,.3)"}}>
            {loading?"Signing in…":"Sign In →"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── SIDEBAR ──────────────────────────────────────────────────────────────────
const NAV = [{id:"overview",icon:"▦",label:"Overview"},{id:"servers",icon:"◈",label:"Servers"},{id:"messages",icon:"◉",label:"Messages"},{id:"analytics",icon:"◆",label:"AI Insights"},{id:"scraper",icon:"◎",label:"Scraper Jobs"},{id:"settings",icon:"◐",label:"Settings"}];

function Sidebar({active,onNav,user,onLogout}) {
  return (
    <aside style={{width:230,flexShrink:0,display:"flex",flexDirection:"column",background:"var(--surface)",borderRight:"1px solid var(--border)",height:"100vh",position:"sticky",top:0}}>
      <div style={{padding:"20px 16px 16px",borderBottom:"1px solid var(--border)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:9,background:"linear-gradient(135deg,rgba(59,130,246,.25),rgba(139,92,246,.25))",border:"1px solid rgba(59,130,246,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>⚡</div>
          <div><div style={{fontSize:15,fontWeight:700}}>DataHarvest</div><div style={{fontSize:11,color:"var(--muted)",fontFamily:"var(--mono)"}}>v1.0 · live</div></div>
        </div>
      </div>
      <div style={{padding:"10px 16px",borderBottom:"1px solid var(--border)"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--green)"}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:"var(--green)",animation:"pulse 2s infinite",display:"inline-block"}}/>
          Bot online
        </div>
      </div>
      <nav style={{flex:1,padding:"8px",overflowY:"auto"}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>onNav(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,marginBottom:2,fontSize:14,fontWeight:500,cursor:"pointer",background:active===n.id?"linear-gradient(135deg,rgba(59,130,246,.15),rgba(139,92,246,.1))":"transparent",color:active===n.id?"#93c5fd":"var(--muted)",border:active===n.id?"1px solid rgba(59,130,246,.2)":"1px solid transparent",transition:"all .15s",textAlign:"left"}}>
            <span style={{fontSize:15,width:20,textAlign:"center"}}>{n.icon}</span>{n.label}
          </button>
        ))}
      </nav>
      <div style={{padding:"12px 16px",borderTop:"1px solid var(--border)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#3b82f6,#6366f1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"white"}}>{user?.username?.[0]?.toUpperCase()}</div>
            <div><div style={{fontSize:13,fontWeight:600}}>{user?.username}</div><div style={{fontSize:11,color:"var(--muted)"}}>{user?.role}</div></div>
          </div>
          <button onClick={onLogout} style={{background:"transparent",color:"var(--muted)",fontSize:18,padding:4,borderRadius:6}} title="Logout">⏻</button>
        </div>
      </div>
    </aside>
  );
}

// ── OVERVIEW ─────────────────────────────────────────────────────────────────
function Overview() {
  const [data,setData]     = useState(null);
  const [loading,setLoad]  = useState(true);
  const [err,setErr]       = useState("");

  useEffect(()=>{
    Promise.all([api("/messages/stats"),api("/servers")])
      .then(([s,sv])=>setData({s,sv}))
      .catch(e=>setErr(e.message))
      .finally(()=>setLoad(false));
  },[]);

  if(loading) return <div style={{display:"flex",justifyContent:"center",paddingTop:80}}><Spinner size={36}/></div>;
  if(err) return <ErrBox msg={err}/>;

  const {s,sv} = data;
  const src = s.bySource||[];
  const srcColors = {discord:"#5865F2",github:"#3b82f6",twitter:"#06b6d4",other:"#64748b"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <div className="fu"><h2 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Overview</h2><p style={{color:"var(--muted)",fontSize:14}}>All sources · all time</p></div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
        {[
          {label:"Total Messages",val:s.total?.toLocaleString()||"0",sub:"all channels",icon:"💬",accent:true},
          {label:"Servers",val:sv.length,sub:`${sv.filter(x=>x.scrapeEnabled).length} scraping`,icon:"🖥️"},
          {label:"Top Author",val:s.topAuthors?.[0]?._id||"—",sub:s.topAuthors?.[0]?`${s.topAuthors[0].count} msgs`:"",icon:"👤"},
          {label:"Sources",val:src.length,sub:src.map(x=>x._id).join(", ")||"none",icon:"📡"},
        ].map((c,i)=>(
          <div key={c.label} className={`fu${i+1}`} style={{background:c.accent?"linear-gradient(135deg,rgba(59,130,246,.12),rgba(139,92,246,.08))":"var(--card)",border:`1px solid ${c.accent?"rgba(59,130,246,.25)":"var(--border)"}`,borderRadius:16,padding:"20px 24px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:11,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".08em"}}>{c.label}</span><span style={{fontSize:18,opacity:.6}}>{c.icon}</span></div>
            <div style={{fontSize:26,fontWeight:700,color:c.accent?"#93c5fd":"var(--text)"}}>{c.val}</div>
            <div style={{fontSize:12,color:"var(--muted)",marginTop:4}}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
        <Card className="fu2">
          <CardHeader title="Daily Activity" action={<Badge color="blue">Last 30 days</Badge>}/>
          <div style={{padding:"20px 16px 16px"}}>
            {(s.byDay||[]).length===0 ? <Empty msg="No activity yet — run a backfill"/> : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={s.byDay}>
                  <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)"/>
                  <XAxis dataKey="_id" tick={{fontSize:11,fill:"#475569"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:11,fill:"#475569"}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<Tip/>}/>
                  <Area type="monotone" dataKey="count" name="Messages" stroke="#3b82f6" fill="url(#ga)" strokeWidth={2} dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="fu3">
          <CardHeader title="By Source"/>
          <div style={{padding:20}}>
            {src.length===0 ? <Empty msg="No data"/> : (
              <>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart><Pie data={src} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="count" paddingAngle={4}>{src.map((x,i)=><Cell key={i} fill={srcColors[x._id]||"#64748b"}/>)}</Pie><Tooltip content={<Tip/>}/></PieChart>
                </ResponsiveContainer>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:12}}>
                  {src.map(x=>(
                    <div key={x._id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:13}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:2,background:srcColors[x._id]||"#64748b"}}/><span style={{color:"var(--muted)",textTransform:"capitalize"}}>{x._id}</span></div>
                      <span style={{fontWeight:600,fontFamily:"var(--mono)",fontSize:12}}>{x.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {(s.topAuthors||[]).length>0 && (
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
      )}
    </div>
  );
}

// ── SERVERS ──────────────────────────────────────────────────────────────────
function Servers() {
  const [sv,setSv]     = useState([]);
  const [ch,setCh]     = useState([]);
  const [sel,setSel]   = useState(null);
  const [loading,setL] = useState(true);
  const [err,setErr]   = useState("");

  useEffect(()=>{
    Promise.all([api("/servers"),api("/channels")])
      .then(([s,c])=>{setSv(s);setCh(c);if(s.length)setSel(s[0].discordId);})
      .catch(e=>setErr(e.message))
      .finally(()=>setL(false));
  },[]);

  const toggleSv = async (id,cur) => { try { const u=await api(`/servers/${id}`,{method:"PATCH",body:JSON.stringify({scrapeEnabled:!cur})}); setSv(s=>s.map(x=>x.discordId===id?u:x)); } catch(e){alert(e.message);} };
  const toggleCh = async (id,cur) => { try { const u=await api(`/channels/${id}`,{method:"PATCH",body:JSON.stringify({scrapeEnabled:!cur})}); setCh(c=>c.map(x=>x.discordId===id?u:x)); } catch(e){alert(e.message);} };

  if(loading) return <div style={{display:"flex",justifyContent:"center",paddingTop:80}}><Spinner size={36}/></div>;

  const scCh = ch.filter(c=>c.serverId===sel);

  const Toggle = ({on,onToggle}) => (
    <div onClick={onToggle} style={{width:38,height:21,borderRadius:11,cursor:"pointer",background:on?"var(--accent)":"var(--dim)",position:"relative",transition:"background .2s",flexShrink:0}}>
      <div style={{position:"absolute",top:2.5,left:on?19:2.5,width:16,height:16,borderRadius:"50%",background:"white",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)"}}/>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <div className="fu"><h2 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Servers & Channels</h2><p style={{color:"var(--muted)",fontSize:14}}>Manage which channels are monitored</p></div>
      {err && <ErrBox msg={err}/>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card className="fu1">
          <CardHeader title="Connected Servers" action={<Badge color="gray">{sv.length}</Badge>}/>
          {sv.length===0 ? <Empty msg="No servers yet"/> : sv.map((s,i)=>(
            <div key={s.discordId} onClick={()=>setSel(s.discordId)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",cursor:"pointer",borderBottom:i<sv.length-1?"1px solid var(--border)":"none",background:sel===s.discordId?"rgba(59,130,246,.06)":"transparent",transition:"background .15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:38,height:38,borderRadius:10,background:`linear-gradient(135deg,hsl(${i*80+200},70%,35%),hsl(${i*80+240},70%,25%))`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"white"}}>{s.name[0]}</div>
                <div><div style={{fontSize:14,fontWeight:600,marginBottom:2}}>{s.name}</div><div style={{fontSize:12,color:"var(--muted)"}}>{s.memberCount?.toLocaleString()} members</div></div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <Badge color={s.scrapeEnabled?"green":"gray"}>{s.scrapeEnabled?"Active":"Paused"}</Badge>
                <Toggle on={s.scrapeEnabled} onToggle={e=>{e.stopPropagation();toggleSv(s.discordId,s.scrapeEnabled);}}/>
              </div>
            </div>
          ))}
        </Card>

        <Card className="fu2">
          <CardHeader title={sel?`Channels — ${sv.find(s=>s.discordId===sel)?.name||""}` : "Channels"} action={<Badge color="blue">{scCh.filter(c=>c.scrapeEnabled).length} active</Badge>}/>
          {!sel ? <Empty msg="Select a server"/> : scCh.length===0 ? <Empty msg="No channels"/> : scCh.map((c,i)=>(
            <div key={c.discordId} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 20px",borderBottom:i<scCh.length-1?"1px solid var(--border)":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:"var(--muted)",fontSize:15}}>#</span>
                <div><div style={{fontSize:14,fontWeight:500}}>{c.name}</div><div style={{fontSize:12,color:"var(--muted)"}}>{(c.messageCount||0).toLocaleString()} messages</div></div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <Badge color={c.scrapeEnabled?"green":"gray"}>{c.scrapeEnabled?"Scraping":"Off"}</Badge>
                <Toggle on={c.scrapeEnabled} onToggle={()=>toggleCh(c.discordId,c.scrapeEnabled)}/>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── MESSAGES ─────────────────────────────────────────────────────────────────
function Messages() {
  const [msgs,setMsgs]     = useState([]);
  const [pag,setPag]       = useState(null);
  const [loading,setLoad]  = useState(true);
  const [err,setErr]       = useState("");
  const [search,setSearch] = useState("");
  const [source,setSource] = useState("all");
  const [sent,setSent]     = useState("all");
  const [page,setPage]     = useState(1);

  const load = useCallback(async()=>{
    setLoad(true); setErr("");
    try {
      const p = new URLSearchParams({page,limit:20});
      if(search) p.set("keyword",search);
      if(source!=="all") p.set("source",source);
      if(sent!=="all") p.set("sentiment",sent);
      const d = await api(`/messages?${p}`);
      setMsgs(d.messages); setPag(d.pagination);
    } catch(e){setErr(e.message);}
    setLoad(false);
  },[search,source,sent,page]);

  useEffect(()=>{load();},[load]);

  const SC = {positive:{c:"#10b981",l:"Positive"},neutral:{c:"#64748b",l:"Neutral"},negative:{c:"#ef4444",l:"Negative"}};
  const SRC = {discord:"indigo",github:"blue",twitter:"cyan",other:"gray"};
  const AV = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899","#6366f1"];
  const ago = iso=>{const d=Date.now()-new Date(iso).getTime(),h=Math.floor(d/3.6e6);return h<1?`${Math.floor(d/6e4)}m ago`:h<24?`${h}h ago`:`${Math.floor(h/24)}d ago`;};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div className="fu" style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
        <div><h2 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Messages</h2><p style={{color:"var(--muted)",fontSize:14}}>{pag?`${pag.total.toLocaleString()} total`:"Loading…"}</p></div>
      </div>

      <div className="fu1" style={{display:"flex",gap:12}}>
        <div style={{flex:1,position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--muted)",fontSize:16}}>⌕</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search messages or authors…" style={{paddingLeft:38}}/>
        </div>
        <select value={source} onChange={e=>{setSource(e.target.value);setPage(1);}} style={{width:150}}>
          <option value="all">All Sources</option><option value="discord">Discord</option><option value="github">GitHub</option><option value="twitter">Twitter</option>
        </select>
        <select value={sent} onChange={e=>{setSent(e.target.value);setPage(1);}} style={{width:160}}>
          <option value="all">All Sentiment</option><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option>
        </select>
        <button onClick={load} style={{padding:"10px 16px",background:"rgba(255,255,255,.05)",border:"1px solid var(--border)",borderRadius:8,color:"var(--muted)",fontSize:14}}>↻</button>
      </div>

      {err && <ErrBox msg={err}/>}

      <Card className="fu2" style={{overflow:"hidden"}}>
        {loading ? <div style={{display:"flex",justifyContent:"center",padding:48}}><Spinner/></div>
        : msgs.length===0 ? <Empty msg="No messages — run a backfill or adjust filters"/>
        : msgs.map((m,i)=>{
          const sc=SC[m.sentiment]||SC.neutral;
          return (
            <div key={m._id} style={{display:"flex",gap:14,padding:"15px 20px",borderBottom:i<msgs.length-1?"1px solid var(--border)":"none",transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.02)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{width:34,height:34,borderRadius:9,flexShrink:0,background:AV[m.authorId?.charCodeAt(0)%AV.length||0],display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"white",marginTop:2}}>{m.authorUsername?.[0]?.toUpperCase()||"?"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:5}}>
                  <span style={{fontSize:14,fontWeight:600}}>{m.authorUsername}</span>
                  <Badge color={SRC[m.source]||"gray"}>{m.source}</Badge>
                  {m.sentiment && <span style={{fontSize:12,color:sc.c,display:"flex",alignItems:"center",gap:4}}><span style={{width:5,height:5,borderRadius:"50%",background:sc.c,display:"inline-block"}}/>{sc.l}</span>}
                </div>
                <p style={{fontSize:14,color:"#cbd5e1",lineHeight:1.6}}>{m.content||<span style={{color:"var(--dim)",fontStyle:"italic"}}>No content</span>}</p>
              </div>
              <div style={{fontSize:12,color:"var(--muted)",flexShrink:0,marginTop:2,whiteSpace:"nowrap"}}>{ago(m.discordCreatedAt)}</div>
            </div>
          );
        })}
      </Card>

      {pag && pag.pages>1 && (
        <div className="fu3" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:"8px 18px",background:"rgba(255,255,255,.05)",border:"1px solid var(--border)",borderRadius:8,color:page===1?"var(--dim)":"var(--text)",cursor:page===1?"not-allowed":"pointer",fontSize:14}}>← Prev</button>
          <span style={{fontSize:14,color:"var(--muted)",padding:"0 8px"}}>Page {page} of {pag.pages}</span>
          <button onClick={()=>setPage(p=>Math.min(pag.pages,p+1))} disabled={page===pag.pages} style={{padding:"8px 18px",background:"rgba(255,255,255,.05)",border:"1px solid var(--border)",borderRadius:8,color:page===pag.pages?"var(--dim)":"var(--text)",cursor:page===pag.pages?"not-allowed":"pointer",fontSize:14}}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ── AI INSIGHTS ───────────────────────────────────────────────────────────────
function Analytics() {
  const [tab,setTab]       = useState("summary");
  const [loading,setLoad]  = useState(false);
  const [result,setResult] = useState(null);
  const [err,setErr]       = useState("");
  const [chs,setChs]       = useState([]);
  const [selCh,setSelCh]   = useState("");
  const [days,setDays]     = useState(30);
  const [q,setQ]           = useState("");
  const [hist,setHist]     = useState([]);

  useEffect(()=>{
    api("/channels").then(c=>{setChs(c);if(c.length)setSelCh(c[0].discordId);}).catch(()=>{});
    api("/analytics/history?limit=5").then(setHist).catch(()=>{});
  },[]);

  const run = async()=>{
    if(!selCh) return;
    setLoad(true); setErr(""); setResult(null);
    try {
      const ch = chs.find(c=>c.discordId===selCh);
      const body = {scope:"channel",targetId:selCh,targetName:ch?.name||"channel"};
      let d;
      if(tab==="summary") d=await api("/analytics/summary",{method:"POST",body:JSON.stringify(body)});
      else if(tab==="trends") d=await api("/analytics/trends",{method:"POST",body:JSON.stringify({...body,days})});
      else d=await api("/analytics/ask",{method:"POST",body:JSON.stringify({...body,question:q,days})});
      setResult(d);
      api("/analytics/history?limit=5").then(setHist).catch(()=>{});
    } catch(e){setErr(e.message);}
    setLoad(false);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div className="fu" style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
        <div><h2 style={{fontSize:24,fontWeight:700,marginBottom:4}}>AI Insights</h2><p style={{color:"var(--muted)",fontSize:14}}>Powered by Groq LLaMA 3.3 · cached 24h</p></div>
        <div style={{display:"flex",gap:4,background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:4}}>
          {["summary","trends","ask"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:"7px 18px",borderRadius:7,fontSize:13,fontWeight:500,cursor:"pointer",background:tab===t?"rgba(59,130,246,.2)":"transparent",color:tab===t?"#93c5fd":"var(--muted)",border:tab===t?"1px solid rgba(59,130,246,.3)":"1px solid transparent",transition:"all .15s",textTransform:"capitalize"}}>
              {t==="ask"?"Ask AI":t}
            </button>
          ))}
        </div>
      </div>

      <Card className="fu1" style={{padding:20}}>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          <select value={selCh} onChange={e=>setSelCh(e.target.value)} style={{width:200}}>
            {chs.map(c=><option key={c.discordId} value={c.discordId}>#{c.name}</option>)}
          </select>
          {tab!=="summary" && (
            <select value={days} onChange={e=>setDays(Number(e.target.value))} style={{width:150}}>
              <option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
            </select>
          )}
          {tab==="ask" && <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ask anything about the messages…" style={{flex:1,minWidth:200}}/>}
          <button onClick={run} disabled={loading||(tab==="ask"&&!q)} style={{padding:"10px 24px",background:"linear-gradient(135deg,#3b82f6,#6366f1)",color:"white",borderRadius:9,fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",border:"none",opacity:loading?.7:1,whiteSpace:"nowrap",flexShrink:0}}>
            {loading?"Analyzing…":tab==="ask"?"Ask →":`Generate ${tab==="summary"?"Summary":"Trends"}`}
          </button>
        </div>
      </Card>

      {err && <ErrBox msg={err}/>}

      {loading && <Card className="fu1" style={{padding:48,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center"}}><div style={{margin:"0 auto 16px"}}><Spinner size={36}/></div><p style={{color:"var(--muted)",fontSize:14}}>Analyzing with LLaMA 3.3 70B…</p></div></Card>}

      {!loading && result && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {result.summary && (
            <Card className="fu2" style={{padding:24}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <span style={{fontSize:18}}>🧠</span><span style={{fontSize:15,fontWeight:600}}>Summary</span>
                {result.sentiment && <Badge color={result.sentiment==="positive"?"green":result.sentiment==="negative"?"red":"gray"}>{result.sentiment}</Badge>}
                {result.messageCount>0 && <span style={{marginLeft:"auto",fontSize:12,color:"var(--muted)",fontFamily:"var(--mono)"}}>{result.messageCount.toLocaleString()} msgs</span>}
              </div>
              <p style={{fontSize:14,color:"#cbd5e1",lineHeight:1.7}}>{result.summary}</p>
            </Card>
          )}
          {result.answer && (
            <Card className="fu2" style={{padding:24}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><span style={{fontSize:18}}>💬</span><span style={{fontSize:15,fontWeight:600}}>Answer</span></div>
              <p style={{fontSize:14,color:"#cbd5e1",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{result.answer}</p>
            </Card>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {result.keyTopics?.length>0 && (
              <Card className="fu3" style={{padding:20}}>
                <div style={{fontSize:12,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:14}}>Key Topics</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{result.keyTopics.map(t=><span key={t} style={{padding:"5px 11px",borderRadius:6,fontSize:13,background:"rgba(59,130,246,.1)",border:"1px solid rgba(59,130,246,.2)",color:"#93c5fd"}}>{t}</span>)}</div>
              </Card>
            )}
            {result.trendingTopics?.length>0 && (
              <Card className="fu3" style={{padding:20}}>
                <div style={{fontSize:12,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:14}}>Trending Topics</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>{result.trendingTopics.slice(0,5).map((t,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontSize:13,color:"#cbd5e1"}}>{t.topic}</span>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><Badge color={t.sentiment==="positive"?"green":t.sentiment==="negative"?"red":"gray"}>{t.sentiment}</Badge><span style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--muted)"}}>×{t.frequency}</span></div>
                  </div>
                ))}</div>
              </Card>
            )}
            {result.highlights?.length>0 && (
              <Card className="fu4" style={{padding:20}}>
                <div style={{fontSize:12,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:14}}>Highlights</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>{result.highlights.map((h,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}><span style={{color:"var(--green)",marginTop:2,flexShrink:0}}>✓</span><span style={{fontSize:13,color:"#94a3b8",lineHeight:1.5}}>{h}</span></div>)}</div>
              </Card>
            )}
          </div>
        </div>
      )}

      {hist.length>0 && (
        <Card className="fu4">
          <CardHeader title="Recent Analyses" action={<Badge color="gray">{hist.length}</Badge>}/>
          {hist.map((h,i)=>(
            <div key={h._id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 20px",borderBottom:i<hist.length-1?"1px solid var(--border)":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}><Badge color="blue">{h.type.replace("_"," ")}</Badge><span style={{fontSize:13,color:"var(--muted)"}}>{h.targetName}</span></div>
              <span style={{fontSize:12,color:"var(--dim)",fontFamily:"var(--mono)"}}>{new Date(h.generatedAt).toLocaleDateString()}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── SCRAPER JOBS ──────────────────────────────────────────────────────────────
function ScraperJobs() {
  const [jobs,setJobs]     = useState([]);
  const [chs,setChs]       = useState([]);
  const [form,setForm]     = useState({type:"channel",id:"",owner:"",repo:""});
  const [loading,setLoad]  = useState(false);
  const [err,setErr]       = useState("");

  useEffect(()=>{
    api("/channels").then(setChs).catch(()=>{});
    api("/scraper/jobs").then(setJobs).catch(()=>{});
  },[]);

  const start = async()=>{
    setLoad(true); setErr("");
    try {
      let d;
      if(form.type==="github") d=await api("/scraper/github",{method:"POST",body:JSON.stringify({owner:form.owner,repo:form.repo,includeComments:true})});
      else if(form.type==="channel") d=await api("/scraper/backfill/channel",{method:"POST",body:JSON.stringify({channelId:form.id})});
      else d=await api("/scraper/backfill/server",{method:"POST",body:JSON.stringify({serverId:form.id})});
      setJobs(j=>[{id:d.jobId||`j${Date.now()}`,status:"running",channelId:form.id||`${form.owner}/${form.repo}`,startedAt:new Date().toISOString()},...j]);
      setTimeout(()=>api("/scraper/jobs").then(setJobs).catch(()=>{}),5000);
    } catch(e){setErr(e.message);}
    setLoad(false);
  };

  const SC={completed:{c:"green",i:"✓"},running:{c:"blue",i:"↻"},failed:{c:"red",i:"✕"}};
  const ago=iso=>{const d=Math.floor((Date.now()-new Date(iso))/6e4);return d<60?`${d}m ago`:`${Math.floor(d/60)}h ago`;};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div className="fu"><h2 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Scraper Jobs</h2><p style={{color:"var(--muted)",fontSize:14}}>Trigger backfills and monitor progress</p></div>

      <Card className="fu1" style={{padding:24}}>
        <div style={{fontSize:14,fontWeight:600,marginBottom:16}}>Start New Job</div>
        {err && <div style={{marginBottom:14}}><ErrBox msg={err}/></div>}
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{width:180}}>
            <option value="channel">Channel Backfill</option><option value="server">Server Backfill</option><option value="github">GitHub Import</option>
          </select>
          {form.type==="github" ? (
            <><input value={form.owner} onChange={e=>setForm(f=>({...f,owner:e.target.value}))} placeholder="GitHub owner" style={{width:160}}/><input value={form.repo} onChange={e=>setForm(f=>({...f,repo:e.target.value}))} placeholder="Repo name" style={{width:180}}/></>
          ) : (
            <select value={form.id} onChange={e=>setForm(f=>({...f,id:e.target.value}))} style={{flex:1}}>
              <option value="">Select channel…</option>
              {chs.map(c=><option key={c.discordId} value={c.discordId}>#{c.name}</option>)}
            </select>
          )}
          <button onClick={start} disabled={loading} style={{padding:"10px 24px",background:"linear-gradient(135deg,#3b82f6,#6366f1)",color:"white",borderRadius:9,fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",border:"none",opacity:loading?.7:1,flexShrink:0}}>
            {loading?"Starting…":"Start →"}
          </button>
        </div>
      </Card>

      <Card className="fu2" style={{overflow:"hidden"}}>
        <CardHeader title="Recent Jobs" action={<button onClick={()=>api("/scraper/jobs").then(setJobs).catch(()=>{})} style={{background:"transparent",color:"var(--muted)",fontSize:16,cursor:"pointer"}}>↻</button>}/>
        {jobs.length===0 ? <Empty msg="No jobs yet — start a backfill above"/> : jobs.map((j,i)=>{
          const sc=SC[j.status]||SC.running;
          return (
            <div key={j.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"15px 20px",borderBottom:i<jobs.length-1?"1px solid var(--border)":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:34,height:34,borderRadius:9,background:j.status==="completed"?"rgba(16,185,129,.12)":j.status==="running"?"rgba(59,130,246,.12)":"rgba(239,68,68,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:j.status==="completed"?"var(--green)":j.status==="running"?"var(--accent)":"var(--red)",animation:j.status==="running"?"spin 1.5s linear infinite":"none"}}>{sc.i}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:600,marginBottom:2}}>{j.channelId||j.serverId||j.id}</div>
                  <div style={{fontSize:12,color:"var(--muted)"}}>{j.count?`${j.count.toLocaleString()} messages`:j.status==="running"?"In progress…":j.error||"Done"}</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                {j.startedAt && <span style={{fontSize:12,color:"var(--muted)",fontFamily:"var(--mono)"}}>{ago(j.startedAt)}</span>}
                <Badge color={sc.c}>{j.status}</Badge>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────
function Settings() {
  const [saved,setSaved] = useState(false);
  const F = ({label,type="text",placeholder,defaultValue=""}) => (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <label style={{fontSize:12,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em"}}>{label}</label>
      <input type={type} defaultValue={defaultValue} placeholder={placeholder}/>
    </div>
  );
  return (
    <div style={{display:"flex",flexDirection:"column",gap:20,maxWidth:620}}>
      <div className="fu"><h2 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Settings</h2><p style={{color:"var(--muted)",fontSize:14}}>API keys and configuration</p></div>
      {[{title:"Discord",e:"🤖",f:[{label:"Bot Token",type:"password",placeholder:"MTxxxxxxx…"}]},{title:"Groq AI",e:"🧠",f:[{label:"API Key",type:"password",placeholder:"gsk_…"},{label:"Model",placeholder:"llama-3.3-70b-versatile",defaultValue:"llama-3.3-70b-versatile"}]},{title:"GitHub",e:"🐙",f:[{label:"Personal Access Token",type:"password",placeholder:"ghp_…"}]}].map((s,i)=>(
        <Card key={s.title} className={`fu${i+1}`} style={{padding:24}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20}}><span style={{fontSize:20}}>{s.e}</span><span style={{fontSize:15,fontWeight:700}}>{s.title}</span></div>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>{s.f.map(f=><F key={f.label} {...f}/>)}</div>
        </Card>
      ))}
      <div className="fu4" style={{padding:"16px 20px",background:"rgba(59,130,246,.06)",border:"1px solid rgba(59,130,246,.15)",borderRadius:12}}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>ℹ️ Note</div>
        <p style={{fontSize:13,color:"var(--muted)",lineHeight:1.6}}>Edit <code style={{fontFamily:"var(--mono)",background:"rgba(255,255,255,.06)",padding:"1px 6px",borderRadius:4}}>backend/.env</code> directly and restart the server for changes to take effect.</p>
      </div>
      <button className="fu4" onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2500);}} style={{alignSelf:"flex-start",padding:"12px 28px",background:saved?"rgba(16,185,129,.2)":"linear-gradient(135deg,#3b82f6,#6366f1)",border:saved?"1px solid rgba(16,185,129,.4)":"none",color:saved?"var(--green)":"white",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",transition:"all .3s"}}>
        {saved?"✓ Saved!":"Save Configuration"}
      </button>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [page,setPage] = useState("overview");
  const [user,setUser] = useState(null);

  if(!user) return (<><style>{CSS}</style><Login onLogin={(u,t)=>{setToken(t);setUser(u);}}/></>);

  const PAGES = {overview:Overview,servers:Servers,messages:Messages,analytics:Analytics,scraper:ScraperJobs,settings:Settings};
  const Page = PAGES[page]||Overview;

  return (
    <>
      <style>{CSS}</style>
      <div className="noise" style={{display:"flex",height:"100vh",overflow:"hidden"}}>
        <Sidebar active={page} onNav={setPage} user={user} onLogout={()=>{setToken("");setUser(null);}}/>
        <main style={{flex:1,overflowY:"auto",padding:"32px 36px"}}>
          <div style={{maxWidth:1100,margin:"0 auto"}}><Page key={page} user={user}/></div>
        </main>
      </div>
    </>
  );
}