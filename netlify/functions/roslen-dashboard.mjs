
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE = "__Secure-roslen-session";
const PATH = "/.netlify/functions/roslen-dashboard";
const DURATION = 30 * 24 * 60 * 60;

function secureHeaders(extra = {}) {
  return {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    ...extra
  };
}

function reply(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: secureHeaders(headers)
  });
}

function json(data, status = 200) {
  return reply(JSON.stringify(data), status, {
    "Content-Type": "application/json"
  });
}

function equal(a, b) {
  const x = Buffer.from(String(a ?? ""));
  const y = Buffer.from(String(b ?? ""));
  return x.length === y.length && timingSafeEqual(x, y);
}

function sign(value, secret) {
  return createHmac("sha256", secret)
    .update(value)
    .digest("base64url");
}

function createSession(secret) {
  const expiry = Math.floor(Date.now() / 1000) + DURATION;
  const payload = `v1.${expiry}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${sign(payload, secret)}`;
}

function validSession(request, secret) {
  const raw = request.headers.get("cookie") || "";
  const match = raw.split(";").map(x => x.trim())
    .find(x => x.startsWith(COOKIE + "="));

  if (!match) return false;

  const parts = match.slice(COOKIE.length + 1).split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return false;

  const expiry = Number(parts[1]);
  if (!Number.isSafeInteger(expiry)) return false;
  if (expiry <= Date.now() / 1000) return false;

  const payload = parts.slice(0, 3).join(".");
  return equal(parts[3], sign(payload, secret));
}

function sessionCookie(value, age = DURATION) {
  return `${COOKIE}=${value}; Path=${PATH}; Max-Age=${age}; HttpOnly; Secure; SameSite=Strict`;
}

const CSS = `
:root {
  color-scheme: dark;
  --bg: #0d1017;
  --panel: #191e28;
  --line: #303744;
  --text: #f6f7f9;
  --muted: #a4aebb;
  --orange: #ff812c;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: radial-gradient(circle at 80% 0%,#352015,transparent 35%),var(--bg);
  color: var(--text);
  font: 15px/1.5 system-ui,Arial,sans-serif;
}
main { max-width: 1080px; margin: auto; padding: 35px 20px; }
header {
  display: flex; justify-content: space-between;
  align-items: center; gap: 15px; flex-wrap: wrap;
  margin-bottom: 30px;
}
h1 { font-size: clamp(28px,5vw,46px); margin: 5px 0; }
h2 { font-size: 18px; margin: 0 0 18px; }
p { color: var(--muted); }
.brand { color: var(--orange); font-size: 12px; font-weight: 800; letter-spacing: .2em; }
.cards { display: grid; grid-template-columns: repeat(3,1fr); gap: 15px; }
.card {
  background: linear-gradient(145deg,#1b2330,#141920);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 22px;
}
.label { color: var(--muted); font-size: 13px; }
.number { font-size: clamp(32px,5vw,52px); font-weight: 800; margin-top: 12px; }
.charts { display: grid; grid-template-columns: 1.1fr 1fr; gap: 15px; margin-top: 16px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
button {
  background: #29313e; color: white;
  border: 1px solid #455064; border-radius: 9px;
  padding: 11px 15px; cursor: pointer;
  font: inherit;
}
button:hover { border-color: var(--orange); }
button:disabled { opacity: .5; }
.primary { background: var(--orange); color: #15100b; font-weight: 800; border: 0; }
input {
  width: 100%; padding: 14px;
  color: white; background: #10151d;
  border: 1px solid #445064;
  border-radius: 9px; font: inherit;
  margin: 10px 0 20px;
}
.login { max-width: 440px; margin: 10vh auto; }
.error { color: #ff9999; }
.country { display: flex; gap: 12px; align-items: center; margin: 17px 0; }
.country-name { width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.country-bar { flex: 1; height: 10px; border-radius: 20px; background: #343b47; overflow: hidden; }
.country-fill { display: block; height: 100%; background: var(--orange); border-radius: 20px; }
.country-count { min-width: 35px; text-align: right; }
svg { width: 100%; height: auto; }
svg text { fill: #a4aebb; font-size: 10px; }
.status { margin-top: 20px; font-size: 12px; }
@media(max-width:700px) {
  .cards,.charts { grid-template-columns: 1fr; }
  main { padding: 18px 14px; }
}
`;

function page(content) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>ROSLEN Analytics</title>
<style>${CSS}</style>
</head>
<body><main>${content}</main></body>
</html>`;
}

function html(content, status = 200, headers = {}) {
  return reply(page(content), status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    ...headers
  });
}

function loginPage(error = "") {
  return `<div class="card login">
    <div class="brand">ROSLEN · PRIVÉ</div>
    <h1>Analytics Center</h1>
    <p>Connecte-toi une fois. Ta session sera conservée pendant 30 jours sur cet appareil.</p>
    ${error ? '<p class="error">Mot de passe incorrect.</p>' : ""}
    <form method="POST">
      <input type="hidden" name="action" value="login">
      <label for="password">Mot de passe</label>
      <input id="password" name="password" type="password" required autocomplete="current-password">
      <button class="primary" type="submit">Se connecter</button>
    </form>
  </div>`;
}

function dashboardPage() {
  return `<header>
    <div>
      <div class="brand">ROSLEN · WEB ANALYTICS</div>
      <h1>Vue d'ensemble</h1>
      <p>Statistiques Cloudflare · Visites et pays</p>
    </div>
    <form method="POST">
      <input type="hidden" name="action" value="logout">
      <button type="submit">Déconnexion</button>
    </form>
  </header>

  <section class="cards">
    <div class="card">
      <div class="label">Visites aujourd'hui</div>
      <div class="number" id="today">—</div>
    </div>
    <div class="card">
      <div class="label">7 derniers jours</div>
      <div class="number" id="week">—</div>
    </div>
    <div class="card">
      <div class="label">30 derniers jours</div>
      <div class="number" id="month">—</div>
    </div>
  </section>

  <section class="charts">
    <div class="card">
      <div class="row">
        <h2>Visites par jour</h2>
        <button id="refresh" type="button">Actualiser</button>
      </div>
      <svg id="chart" viewBox="0 0 520 230">
        <text x="15" y="110">Chargement...</text>
      </svg>
      <p>Évolution quotidienne · UTC</p>
    </div>
    <div class="card">
      <h2>Visites par pays</h2>
      <div id="countries">Chargement...</div>
      <p>Répartition des visites sur 30 jours</p>
    </div>
  </section>

  <p class="status" id="status">Connexion à Cloudflare...</p>

  <script>
  const numberFormat = new Intl.NumberFormat("fr-FR");
  const $ = id => document.getElementById(id);
  const SVG_NS = "http://www.w3.org/2000/svg";

  function svgElement(parent, tag, attributes, label) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [key,value] of Object.entries(attributes || {})) {
      el.setAttribute(key, String(value));
    }
    if (label !== undefined) el.textContent = label;
    parent.appendChild(el);
    return el;
  }

  function chart(rows) {
    const root = $("chart");
    root.replaceChildren();

    rows = [...rows].sort((a,b) => a.date.localeCompare(b.date));

    if (!rows.length) {
      svgElement(root,"text",{x:15,y:110},"Aucune donnée disponible");
      return;
    }

    const max = Math.max(1,...rows.map(x => Number(x.visits)||0));
    const left=35, right=505, top=20, bottom=190;
    const width=right-left, height=bottom-top;

    for (let i=0;i<=4;i++) {
      const y=bottom-(i/4)*height;
      svgElement(root,"line",{
        x1:left,y1:y,x2:right,y2:y,
        stroke:"#354052","stroke-width":1
      });
      svgElement(root,"text",{x:2,y:y+4},
        String(Math.round(max*i/4)));
    }

    const coords=rows.map((r,i)=>({
      x:left+(rows.length===1 ? .5 : i/(rows.length-1))*width,
      y:bottom-(Number(r.visits)||0)/max*height,
      date:r.date,visits:r.visits
    }));

    svgElement(root,"polyline",{
      points:coords.map(p=>p.x+","+p.y).join(" "),
      fill:"none",stroke:"#ff812c",
      "stroke-width":3,"stroke-linejoin":"round"
    });

    coords.forEach(p=>{
      const circle=svgElement(root,"circle",{
        cx:p.x,cy:p.y,r:4,fill:"#ffb06d"
      });
      svgElement(circle,"title",{},
        p.date+" : "+p.visits+" visites");
    });

    for (const i of new Set([
      0,Math.floor((rows.length-1)/2),rows.length-1
    ])) {
      svgElement(root,"text",{
        x:coords[i].x,y:217,"text-anchor":"middle"
      },rows[i].date.slice(5));
    }
  }

  function countryFlag(code) {
    if (!/^[A-Z]{2}$/.test(code)) return "🌐";
    return [...code]
      .map(c=>String.fromCodePoint(127397+c.charCodeAt(0)))
      .join("");
  }

  function drawCountries(data) {
    const root=$("countries");
    root.replaceChildren();

    const rows=[...data]
      .filter(x=>Number(x.visits)>0)
      .sort((a,b)=>b.visits-a.visits);

    if (!rows.length) {
      root.textContent="Aucune donnée disponible";
      return;
    }

    const total=rows.reduce((s,x)=>s+Number(x.visits),0);
    const displayNames=new Intl.DisplayNames(["fr"],{type:"region"});

    for (const item of rows.slice(0,30)) {
      const visits=Number(item.visits);
      const code=String(item.country||"").toUpperCase();
      const country=/^[A-Z]{2}$/.test(code)
        ? displayNames.of(code)
        : item.country;

      const row=document.createElement("div");
      row.className="country";

      const name=document.createElement("div");
      name.className="country-name";
      name.textContent=countryFlag(code)+" "+country;

      const bar=document.createElement("div");
      bar.className="country-bar";

      const fill=document.createElement("span");
      fill.className="country-fill";
      fill.style.width=(visits/total*100)+"%";
      bar.appendChild(fill);

      const count=document.createElement("div");
      count.className="country-count";
      count.textContent=numberFormat.format(visits);

      row.append(name,bar,count);
      root.appendChild(row);
    }
  }

  async function refresh() {
    const button=$("refresh");
    button.disabled=true;
    $("status").textContent="Synchronisation Cloudflare...";

    try {
      const response=await fetch(location.pathname+"?data=1",{
        credentials:"same-origin",
        cache:"no-store"
      });

      if (response.status===401) {
        location.reload();
        return;
      }

      const data=await response.json();

      if (!response.ok) {
        throw new Error(data.error||"Erreur API");
      }

      $("today").textContent=numberFormat.format(data.today||0);
      $("week").textContent=numberFormat.format(data.last7Days||0);
      $("month").textContent=numberFormat.format(data.last30Days||0);

      chart(data.daily||[]);
      drawCountries(data.countries||[]);

      $("status").textContent=
        "Mis à jour à "+new Date().toLocaleTimeString("fr-FR");

    } catch(error) {
      $("status").textContent="Erreur : "+error.message;
    } finally {
      button.disabled=false;
    }
  }

  $("refresh").addEventListener("click",refresh);
  refresh();
  setInterval(refresh,300000);
  </script>`;
}

async function cloudflareStats() {
  const account=process.env.CLOUDFLARE_ACCOUNT_ID;
  const token=process.env.CLOUDFLARE_API_TOKEN;

  if (!account || !token) {
    return json({error:"Variables Cloudflare manquantes"},503);
  }

  const now=new Date();
  const midnight=Date.UTC(
    now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()
  );

  const start=new Date(midnight-29*86400000).toISOString();

  // Pas de filtre siteTag : configuration que tu as testée
  // et qui fonctionne actuellement sur ton compte.
  const query = `
    query($account: string!, $from: Time!) {
      viewer {
        accounts(filter: { accountTag: $account }) {
          daily: rumPageloadEventsAdaptiveGroups(
            limit: 100,
            filter: { datetime_geq: $from },
            orderBy: [date_ASC]
          ) {
            dimensions { date }
            sum { visits }
          }
          countries: rumPageloadEventsAdaptiveGroups(
            limit: 300,
            filter: { datetime_geq: $from },
            orderBy: [count_DESC]
          ) {
            dimensions { countryName }
            sum { visits }
          }
        }
      }
    }
   `;

  try {
    const response=await fetch(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        method:"POST",
        headers:{
          Authorization:"Bearer "+token,
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          query,
          variables:{account,from:start}
        }),
        signal:AbortSignal.timeout(12000)
      }
    );

    const result=await response.json();

    if (!response.ok || result.errors?.length) {
      console.error("Cloudflare error",
        response.status,result.errors?.map(e=>e.message));
      return json({error:"Requête Cloudflare refusée"},502);
    }

    const accountData=result.data?.viewer?.accounts?.[0];

    if (!accountData) {
      return json({error:"Compte Cloudflare introuvable"},502);
    }

    const daily=(accountData.daily||[]).map(r=>({
      date:r.dimensions.date,
      visits:Number(r.sum?.visits)||0
    }));

    const countries=(accountData.countries||[]).map(r=>({
      country:r.dimensions.countryName,
      visits:Number(r.sum?.visits)||0
    }));

    const today=new Date(midnight).toISOString().slice(0,10);
    const seven=new Date(midnight-6*86400000)
      .toISOString().slice(0,10);

    const sum=fn=>daily.filter(fn)
      .reduce((total,r)=>total+r.visits,0);

    return json({
      today:sum(r=>r.date===today),
      last7Days:sum(r=>r.date>=seven),
      last30Days:sum(()=>true),
      daily,
      countries
    });

  } catch(error) {
    console.error("Cloudflare connection error",error.message);
    return json({error:"Connexion Cloudflare impossible"},502);
  }
}


export default async function handler(request) {
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return reply("Méthode non autorisée", 405);
  }

  if (url.searchParams.has("data")) {
    return cloudflareStats();
  }

  return html(dashboardPage());
}

  const url=new URL(request.url);
  const logged=validSession(request,secret);

  if (request.method==="POST") {
    const origin = request.headers.get("origin");
    if (origin !== "https://roslen.live") {
      return reply("Requête refusée", 403);
    }

    const form=await request.formData();

    if (form.get("action")==="logout") {
      return reply("",303,{
        Location:url.pathname,
        "Set-Cookie":sessionCookie("",0)
      });
    }

    if (form.get("action")==="login") {
      if (!equal(form.get("password"),password)) {
        return html(loginPage(true),401);
      }

      return reply("",303,{
        Location:url.pathname,
        "Set-Cookie":sessionCookie(createSession(secret))
      });
    }

    return reply("Action invalide",400);
  }

  if (request.method!=="GET") {
    return reply("Méthode non autorisée",405);
  }

  if (url.searchParams.has("data")) {
    if (!logged) return json({error:"Non autorisé"},401);
    return cloudflareStats();
  }

  if (!logged) return html(loginPage());
  return html(dashboardPage());
}
