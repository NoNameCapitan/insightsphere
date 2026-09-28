// Apple Music sign-in page: loads Apple's MusicKit JS, asks Apple for a
// Music User Token and hands it to the local app. Nothing else leaves the page.
const $ = (id) => document.getElementById(id);
const state = new URLSearchParams(location.search).get("state") || "";
const status = (text, bad = false) => { $("status").textContent = text; $("status").classList.toggle("err", bad); };

async function send(body) {
  const res = await fetch("/connect/apple_music/token", {
    method: "POST", headers: { "Content-Type": "application/json", "X-MusicDNA-Client": "3" },
    body: JSON.stringify({ state, ...body }),
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON */ }
  return data;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = resolve; s.onerror = () => reject(new Error("Couldn't load MusicKit from Apple. Are you online?"));
    document.head.appendChild(s);
  });
}

async function main() {
  let cfg;
  try {
    const res = await fetch(`/connect/apple_music/config?state=${encodeURIComponent(state)}`);
    cfg = await res.json();
    if (!cfg.ok) throw new Error(cfg.error || "This sign-in expired. Start again from Sources.");
  } catch (e) { status(e.message, true); return; }
  try {
    const ready = new Promise((resolve) => document.addEventListener("musickitloaded", resolve, { once: true }));
    await loadScript(cfg.musickit_js);
    if (!window.MusicKit) await ready;
    await window.MusicKit.configure({ developerToken: cfg.developer_token, app: { name: cfg.app_name, build: cfg.build } });
  } catch (e) {
    status(`${e.message || e} Check the developer token in Sources → Apple Music → Setup.`, true);
    return;
  }
  status("Ready. Apple will open a sign-in window.");
  const btn = $("authorize");
  btn.disabled = false;
  btn.focus();
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    status("Waiting for Apple…");
    let token;
    try {
      token = await window.MusicKit.getInstance().authorize();
    } catch (e) {
      const r = await send({ error: String(e && e.message || e || "cancelled") });
      status("Apple sign-in didn't complete. Nothing was changed.", true);
      setTimeout(() => { location.href = r.next || "/#/sources"; }, 1800);
      return;
    }
    status("Checking access…");
    const r = await send({ music_user_token: token });
    if (!r.ok) status(r.error || "Apple Music refused the connection.", true);
    location.href = r.next || "/#/sources";
  });
}
main();
