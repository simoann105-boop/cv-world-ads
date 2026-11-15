import * as admin from "firebase-admin";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";

const APP_ID = process.env.ONESIGNAL_APP_ID || "01a6beb2-665b-4684-b4f4-19c04c918706";
const COUNTRIES = {
  qa: { name: "Qatar", code: "QA", terms: ["qatar", "doha", "lusail", "al wakrah", "al rayyan"] },
  ae: { name: "United Arab Emirates", code: "AE", terms: ["uae", "united arab emirates", "dubai", "abu dhabi", "sharjah"] },
  sa: { name: "Saudi Arabia", code: "SA", terms: ["saudi", "saudi arabia", "riyadh", "jeddah", "dammam"] },
};
const SEEDS = [
  { provider: "smartrecruiters", board: "AccorHotel", company: "Accor", countries: ["qa", "ae", "sa"] },
  { provider: "smartrecruiters", board: "EtihadAirways5", company: "Etihad Airways", countries: ["ae", "sa"] },
  { provider: "smartrecruiters", board: "VAMSystems", company: "VAM Systems", countries: ["qa", "ae", "sa"] },
];
const PROVIDERS = {
  smartrecruiters: new Set(["jobs.smartrecruiters.com"]),
  greenhouse: new Set(["boards.greenhouse.io", "job-boards.greenhouse.io"]),
  lever: new Set(["jobs.lever.co"]),
  ashby: new Set(["jobs.ashbyhq.com"]),
};

function firestore() {
  if (!admin.getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT repository secret.");
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    admin.initializeApp({ credential: admin.cert(JSON.parse(json)) });
  }
  return getFirestore();
}

function clean(value = "") {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

function normalized(value = "") {
  return clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function parseSource(urlValue, company = "") {
  try {
    const url = new URL(urlValue);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const provider = Object.entries(PROVIDERS).find(([, hosts]) => hosts.has(host))?.[0];
    const board = url.pathname.split("/").filter(Boolean)[0];
    return provider && board ? { provider, board, company } : null;
  } catch {
    return null;
  }
}

function matchesCountry(location, code) {
  const value = normalized(location);
  return COUNTRIES[code].terms.some((term) => (` ${value} `).includes(` ${term} `));
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
}

async function discoverSources(db) {
  const sources = new Map(SEEDS.map((source) => [`${source.provider}/${source.board}`, source]));
  const jobs = await db.collection("jobs").where("isActive", "==", true).limit(1500).get();
  for (const doc of jobs.docs) {
    const job = doc.data() || {};
    const source = parseSource(job.applyLink, job.company);
    if (source) {
      const key = `${source.provider}/${source.board}`;
      if (!sources.has(key)) sources.set(key, source);
    }
  }
  return [...sources.values()].slice(0, 60);
}

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
  return response.json();
}

async function fetchBoard(source, country) {
  const countryInfo = COUNTRIES[country];
  let items;
  if (source.provider === "smartrecruiters") {
    const url = new URL(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(source.board)}/postings`);
    // SmartRecruiters expects lowercase ISO country codes. Uppercase is accepted
    // but silently returns an empty result set.
    url.searchParams.set("country", countryInfo.code.toLowerCase());
    url.searchParams.set("limit", "100");
    items = [];
    let totalFound = Infinity;
    for (let offset = 0; offset < totalFound && offset < 1000; offset += 100) {
      url.searchParams.set("offset", String(offset));
      const page = await getJson(url);
      const content = page.content || [];
      items.push(...content);
      totalFound = Number(page.totalFound ?? content.length);
      if (content.length < 100) break;
    }
    return items.filter((item) => matchesCountry(`${item.location?.country || ""} ${item.location?.fullLocation || ""} ${item.location?.city || ""}`, country)).map((item) => ({
      title: item.name, company: item.company?.name || source.company || source.board,
      location: item.location?.fullLocation || item.location?.city || countryInfo.name,
      applyLink: `https://jobs.smartrecruiters.com/${source.board}/${item.id}`,
      description: [item.department?.label, item.function?.label, item.typeOfEmployment?.label].filter(Boolean).join(" - "),
      postedAt: item.releasedDate,
    }));
  }
  if (source.provider === "greenhouse") {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.board)}/jobs?content=true`;
    items = (await getJson(url)).jobs || [];
    return items.filter((item) => matchesCountry(item.location?.name, country)).map((item) => ({
      title: item.title, company: source.company || source.board, location: item.location?.name || countryInfo.name,
      applyLink: item.absolute_url, description: clean(item.content), postedAt: item.updated_at,
    }));
  }
  if (source.provider === "lever") {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(source.board)}?mode=json`;
    items = await getJson(url);
    return items.filter((item) => matchesCountry(item.categories?.location, country)).map((item) => ({
      title: item.text, company: source.company || source.board, location: item.categories?.location || countryInfo.name,
      applyLink: item.hostedUrl || item.applyUrl, description: clean(item.descriptionPlain || item.description),
      postedAt: item.createdAt ? new Date(item.createdAt) : null,
    }));
  }
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(source.board)}`;
  items = (await getJson(url)).jobs || [];
  return items.filter((item) => matchesCountry(`${item.location || ""} ${(item.secondaryLocations || []).map((loc) => loc.location).join(" ")}`, country)).map((item) => ({
    title: item.title, company: source.company || source.board, location: item.location || countryInfo.name,
    applyLink: item.applyUrl, description: clean(item.descriptionPlain), postedAt: item.publishedAt,
  }));
}

function category(job) {
  const value = `${job.title} ${job.description}`.toLowerCase();
  if (/nurse|doctor|medical|health|hospital|صيدلي|طبيب|تمريض/.test(value)) return "Healthcare";
  if (/teacher|school|education|مدرس|معلم|تعليم/.test(value)) return "Education";
  if (/engineer|maintenance|construction|technician|مهندس|فني/.test(value)) return "Engineering";
  if (/software|developer|data|cyber|it support|تقنية|برمج/.test(value)) return "IT";
  if (/account|finance|audit|محاسب|مالية/.test(value)) return "Finance";
  if (/hotel|restaurant|chef|waiter|hospitality|فندق|مطعم/.test(value)) return "Hospitality";
  return "General";
}

function government(job) {
  return job.country === "qa" && /hamad|hospital|health|police|ministry|government|education|university|ashghal|kahramaa|qatarenergy|sidra|phcc|lekhwiya|civil defence|وزارة|حمد|الشرطة|حكوم|تعليم|صحة/i
    .test(`${job.title} ${job.company} ${job.description} ${job.location}`);
}

async function saveJobs(db, candidates, stats) {
  const processed = new Set();
  const processedLinks = new Set();
  const validHosts = new Set(Object.values(PROVIDERS).flatMap((hosts) => [...hosts]));
  const prepared = [];
  for (const raw of candidates) {
    const title = clean(raw.title);
    let apply;
    try { apply = new URL(raw.applyLink); } catch { continue; }
    const host = apply.hostname.toLowerCase().replace(/^www\./, "");
    if (title.length < 3 || apply.protocol !== "https:" || !validHosts.has(host)) continue;
    const company = clean(raw.company) || "Verified Employer";
    const location = clean(raw.location) || COUNTRIES[raw.country].name;
    const key = [normalized(title), normalized(company), normalized(location), raw.country].join("|");
    if (processed.has(key)) continue;
    processed.add(key);
    if (processedLinks.has(apply.href)) continue;
    processedLinks.add(apply.href);
    prepared.push({ raw, title, company, location, key, apply: apply.href, id: createHash("sha256").update(key).digest("hex").slice(0, 40) });
  }

  const collection = db.collection("jobs");
  const existingById = new Map();
  for (let i = 0; i < prepared.length; i += 100) {
    const refs = prepared.slice(i, i + 100).map((item) => collection.doc(item.id));
    const docs = await db.getAll(...refs);
    for (const doc of docs) if (doc.exists) existingById.set(doc.id, doc);
  }
  const existingByLink = new Map();
  const links = prepared.filter((item) => !existingById.has(item.id)).map((item) => item.apply);
  for (let i = 0; i < links.length; i += 30) {
    const snapshot = await collection.where("applyLink", "in", links.slice(i, i + 30)).get();
    for (const doc of snapshot.docs) existingByLink.set(doc.get("applyLink"), doc);
  }

  const writer = db.bulkWriter();
  const writes = [];
  for (const item of prepared) {
    const existing = existingById.get(item.id) || existingByLink.get(item.apply);
    const ref = existing?.ref || collection.doc(item.id);
    const prior = existing?.data() || {};
    const payload = {
      title: item.title, company: item.company, location: item.location,
      city: item.location.split(",")[0].trim(), country: item.raw.country,
      category: category({ ...item.raw, title: item.title }), source: `${item.company} Careers`, sourceType: "official_ats",
      officialSource: true, applyLink: item.apply, description: clean(item.raw.description),
      isGovernment: government({ ...item.raw, title: item.title, company: item.company, location: item.location }),
      isActive: true, isExpired: false, hasDirectApply: true, directApplyType: "link",
      qualityScore: 75 + (clean(item.raw.description).length > 250 ? 15 : 0),
      postedAt: parseDate(item.raw.postedAt) || prior.postedAt || Timestamp.now(),
      sourcePostedAt: parseDate(item.raw.postedAt), updatedAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(), hash: ref.id, canonicalKey: item.key,
    };
    if (!existing) { payload.createdAt = FieldValue.serverTimestamp(); stats.newJobs += 1; }
    writes.push(writer.set(ref, payload, { merge: true }));
    stats.savedJobs += 1;
    stats.byCountry[item.raw.country] += 1;
  }
  await Promise.all(writes);
  await writer.close();
}

async function sendPush(stats) {
  const key = process.env.ONESIGNAL_REST_API_KEY;
  if (!key) throw new Error("Missing ONESIGNAL_REST_API_KEY repository secret.");
  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: APP_ID, target_channel: "push", included_segments: ["Total Subscriptions"],
      headings: { en: "New jobs are live", ar: "وظائف جديدة متاحة الآن" },
      contents: {
        en: `${stats.newJobs} new verified job${stats.newJobs === 1 ? "" : "s"} added to CV World.`,
        ar: `أضفنا ${stats.newJobs} وظيفة موثوقة جديدة إلى CV World.`,
      },
      data: { type: "new_jobs", countries: stats.byCountry },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.id) throw new Error(`OneSignal rejected notification: ${JSON.stringify(body.errors || body)}`);
  return { status: "accepted", id: body.id, recipients: Number(body.recipients || 0) };
}

async function main() {
  const db = firestore();
  const dryRun = process.env.DRY_RUN === "true";
  if (!dryRun && !process.env.ONESIGNAL_REST_API_KEY) throw new Error("Missing ONESIGNAL_REST_API_KEY; refusing to add jobs without push capability.");
  const stats = { fetchedJobs: 0, savedJobs: 0, newJobs: 0, byCountry: { qa: 0, ae: 0, sa: 0 }, sourceErrors: [] };
  const sources = await discoverSources(db);
  const tasks = sources.flatMap((source) => (source.countries || Object.keys(COUNTRIES)).map((country) => ({ source, country })));
  const candidates = [];
  for (let i = 0; i < tasks.length; i += 6) {
    const batch = await Promise.all(tasks.slice(i, i + 6).map(async ({ source, country }) => {
      try { return (await fetchBoard(source, country)).map((job) => ({ ...job, country })); }
      catch (error) { stats.sourceErrors.push(`${source.provider}/${source.board}/${country}: ${error.message}`); return []; }
    }));
    candidates.push(...batch.flat());
  }
  if (!tasks.length || stats.sourceErrors.length === tasks.length) {
    throw new Error(`All job source checks failed. ${stats.sourceErrors[0] || "No supported sources found."}`);
  }
  stats.fetchedJobs = candidates.length;
  if (dryRun) {
    console.log(JSON.stringify({ dryRun, sources: sources.length, tasks: tasks.length, ...stats }, null, 2));
    return;
  }
  await saveJobs(db, candidates, stats);
  const state = db.collection("job_sync_state").doc("github");
  const oldState = (await state.get()).data() || {};
  const pending = oldState.pendingNotification || { newJobs: 0, byCountry: { qa: 0, ae: 0, sa: 0 } };
  if (stats.newJobs) {
    pending.newJobs += stats.newJobs;
    for (const country of Object.keys(stats.byCountry)) pending.byCountry[country] += stats.byCountry[country];
    await state.set({ pendingNotification: pending }, { merge: true });
  }
  let notification = { status: "no_new_jobs" };
  if (pending.newJobs > 0) {
    notification = await sendPush(pending);
    await state.set({ pendingNotification: FieldValue.delete() }, { merge: true });
  }
  const run = {
    name: "githubJobSync", status: "success", ...stats, notification,
    sourceErrors: stats.sourceErrors.slice(0, 30), githubRunId: process.env.GITHUB_RUN_ID || null,
    createdAt: FieldValue.serverTimestamp(),
  };
  await db.collection("scraper_runs").add(run);
  await state.set({ lastRunAt: FieldValue.serverTimestamp(), status: "success", ...stats, notification }, { merge: true });
  console.log(JSON.stringify({ ...run, sourceErrors: stats.sourceErrors.length }));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
