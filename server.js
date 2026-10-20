// Job Helper - free tools for job seekers. No npm packages needed (Node 18+).
const http = require("http");

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const PER_IP_PER_HOUR = +(process.env.PER_IP_PER_HOUR || 10);
const DAILY_CAP = +(process.env.DAILY_CAP || 200);

const hits = new Map();
let day = new Date().toDateString(), today = 0;

const LANG = { en: "Reply in simple English.", ml: "Reply in simple Malayalam (Malayalam script), keep job terms like resume, CTC in English." };
const PROMPTS = {
  scam: "You are a job scam expert helping people who may be vulnerable. Read the job offer / recruiter message below. Give: 1) Risk: LOW / MEDIUM / HIGH, 2) the red flags you see (asking for money or fees, only WhatsApp/Telegram contact, too-high pay for easy work, no interview, free email like gmail for a company, urgency, asking for bank/ID details), 3) what to do next, in 3 short steps. Say clearly that you cannot be 100% sure and tell them to verify the company on its official website. Never ask them to pay anything.",
  resume: "You are a career coach. Improve the resume text below: clear summary, strong bullet points with results, honest only (do not invent jobs, skills or numbers; mark missing details as [add: ...]). Return the improved resume, then 3 short tips.",
  cover: "You are a career coach. Write a short honest cover letter (under 180 words) from the candidate's details (field A) for the job (field B). Do not invent facts. Mark missing details as [add: ...].",
  interview: "You are an interview coach. For the role / job description below, give the 6 most likely interview questions, each with a short tip on how to answer honestly using the candidate's background if given. End with 3 general tips for nervous first-timers."
};

function html() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Job Helper</title>
<style>
:root{--bg:#f7f7f5;--c:#fff;--t:#1d1d1b;--b:#ddd;--a:#0a66c2}
@media(prefers-color-scheme:dark){:root{--bg:#141413;--c:#1e1e1c;--t:#f1f1ee;--b:#33332f;--a:#5aa9f0}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--t);font:16px/1.5 system-ui,sans-serif}
main{max-width:640px;margin:auto;padding:16px}h1{font-size:22px;margin:6px 0}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}.tabs button{flex:1;min-width:46%;padding:10px;border:1px solid var(--b);background:var(--c);color:var(--t);border-radius:10px;font:inherit}
.tabs button.on{background:var(--a);color:#fff;border-color:var(--a)}
textarea,select{width:100%;padding:10px;border:1px solid var(--b);border-radius:10px;background:var(--c);color:var(--t);font:inherit;margin:4px 0 10px}textarea{min-height:130px}
.go{width:100%;padding:14px;border:0;border-radius:10px;background:var(--a);color:#fff;font:600 17px system-ui}.go:disabled{opacity:.5}
pre{white-space:pre-wrap;background:var(--c);border:1px solid var(--b);border-radius:10px;padding:12px;font:inherit}small{color:#888}
</style></head><body><main>
<h1>Job Helper</h1><small>Free help for job seekers. Fake job check, resume, cover letter, interview practice.</small>
<div class="tabs" id="tabs"></div>
<label id="la"></label><textarea id="a"></textarea>
<label id="lb"></label><textarea id="b"></textarea>
<select id="lang"><option value="ml">Malayalam</option><option value="en">English</option></select>
<button class="go" id="go">Go</button>
<pre id="out" style="display:none"></pre>
<small>AI thettu parayaam. Important karyangal swayam check cheyyuka. Ee site ninte details save cheyyunnilla. Free AI (Google Gemini) aanu use cheyyunnath, athinaal phone number, bank details pole rahasyam ezhutharuthu.</small>
</main><script>
var T={scam:["Fake job check","Job offer / recruiter message ivide paste cheyyuka",""],
resume:["Resume","Ninte resume / vivarangal paste cheyyuka",""],
cover:["Cover letter","Ninte vivarangal (resume)","Job description"],
interview:["Interview","Job role / description","Ninte background (optional)"]};
var cur="scam",$=function(i){return document.getElementById(i)};
function show(k){cur=k;$("la").textContent=T[k][1];$("lb").textContent=T[k][2];$("b").style.display=T[k][2]?"block":"none";$("lb").style.display=T[k][2]?"block":"none";
 Array.prototype.forEach.call($("tabs").children,function(x){x.className=x.dataset.k===k?"on":""});$("out").style.display="none"}
Object.keys(T).forEach(function(k){var b=document.createElement("button");b.textContent=T[k][0];b.dataset.k=k;b.onclick=function(){show(k)};$("tabs").appendChild(b)});
show("scam");
$("go").onclick=function(){var g=$("go"),o=$("out");g.disabled=true;g.textContent="Wait...";o.style.display="block";o.textContent="Vayikkunnu...";
 fetch("/api",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tool:cur,a:$("a").value,b:$("b").value,lang:$("lang").value})})
 .then(function(r){return r.json()}).then(function(d){o.textContent=d.text||d.error||"Error"}).catch(function(){o.textContent="Network error. Veendum try cheyyuka."})
 .then(function(){g.disabled=false;g.textContent="Go"})};
</script></body></html>`;
}

function ipOf(req) { return (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim(); }

async function ask(tool, a, b, lang) {
  const content = PROMPTS[tool] + " " + (LANG[lang] || LANG.en) + "\n\nField A:\n" + a + (b ? "\n\nField B:\n" + b : "");
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: content }] }], generationConfig: { maxOutputTokens: 1500 } })
  });
  if (r.status === 429) throw new Error("busy");
  const d = await r.json();
  const text = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts.map(p => p.text || "").join("");
  if (!text) throw new Error("AI error");
  return text;
}

http.createServer((req, res) => {
  if (req.method === "GET") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(html()); }
  if (req.method === "POST" && req.url === "/api") {
    let body = "";
    req.on("data", c => { body += c; if (body.length > 20000) req.destroy(); });
    req.on("end", async () => {
      const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
      try {
        if (!KEY) return send(500, { error: "Server not set up (GEMINI_API_KEY missing)." });
        const now = new Date();
        if (now.toDateString() !== day) { day = now.toDateString(); today = 0; }
        if (today >= DAILY_CAP) return send(429, { error: "Innathe free limit theernnu. Naale veendum try cheyyuka." });
        const ip = ipOf(req), t = Date.now();
        const list = (hits.get(ip) || []).filter(x => t - x < 3600000);
        if (list.length >= PER_IP_PER_HOUR) return send(429, { error: "Kurach kazhinju try cheyyuka (oru manikkoorinu " + PER_IP_PER_HOUR + " thavana mathram)." });
        const { tool, a, b, lang } = JSON.parse(body || "{}");
        if (!PROMPTS[tool] || !a || !a.trim()) return send(400, { error: "Text nirakkuka." });
        list.push(t); hits.set(ip, list); today++;
        const text = await ask(tool, String(a).slice(0, 6000), String(b || "").slice(0, 6000), lang);
        send(200, { text });
      } catch (e) { send(e.message === "busy" ? 429 : 500, { error: e.message === "busy" ? "Ippo thirakkaanu. Oru nimisham kazhinju veendum try cheyyuka." : "Edo thettu pattu. Veendum try cheyyuka." }); }
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(process.env.PORT || 3000);
