import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import sharp from "sharp";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const OUTPUT_DIR = path.resolve(ROOT, "marketing", "growth-engine", "out");

const CONFIG = {
  appName: "CV World",
  timezone: process.env.TIMEZONE || "Asia/Qatar",
  appLink: process.env.APP_DOWNLOAD_LINK || "https://cvworld.app",
  privacyMode: process.env.DRY_RUN === "true",
  pageId: process.env.FACEBOOK_PAGE_ID || "",
  pageToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "",
  maxJobs: Number(process.env.MAX_JOBS_PER_POST || 5),
  minHoursBetweenSimilarPosts: Number(process.env.MIN_HOURS_BETWEEN_SIMILAR_POSTS || 10),
  brandAssets: {
    logo: process.env.CVWORLD_LOGO_PATH || path.resolve(ROOT, "assets", "icon", "app_icon.png"),
  },
};

const COUNTRY_PROFILES = {
  qa: {
    ar: "قطر",
    en: "Qatar",
    flag: "🇶🇦",
    hashtags: ["#وظائف_قطر", "#وظائف_الدوحة", "#JobsInQatar", "#QatarJobs"],
  },
  ae: {
    ar: "الإمارات",
    en: "UAE",
    flag: "🇦🇪",
    hashtags: ["#وظائف_الإمارات", "#وظائف_دبي", "#UAEJobs", "#DubaiJobs"],
  },
  sa: {
    ar: "السعودية",
    en: "Saudi Arabia",
    flag: "🇸🇦",
    hashtags: ["#وظائف_السعودية", "#وظائف_الرياض", "#SaudiJobs", "#RiyadhJobs"],
  },
  ma: {
    ar: "المغرب",
    en: "Morocco",
    flag: "🇲🇦",
    hashtags: ["#وظائف_المغرب", "#فرص_عمل", "#MoroccoJobs"],
  },
  dz: {
    ar: "الجزائر",
    en: "Algeria",
    flag: "🇩🇿",
    hashtags: ["#وظائف_الجزائر", "#فرص_عمل", "#AlgeriaJobs"],
  },
  tn: {
    ar: "تونس",
    en: "Tunisia",
    flag: "🇹🇳",
    hashtags: ["#وظائف_تونس", "#فرص_عمل", "#TunisiaJobs"],
  },
};

const ARABIC_OPENERS = [
  "فرص جديدة وصلت اليوم، والذكي هو من يجهز سيرته ويتقدم بسرعة.",
  "إذا كنت تبحث عن عمل، لا تضيع وقتك بين الروابط المتفرقة. هذه فرص مختارة لك اليوم.",
  "وظائف جديدة الآن، ومع CV World تقدر تجهز CV احترافي وتبدأ التقديم بثقة.",
  "اليوم فيه فرص ممتازة للباحثين عن عمل. جهز سيرتك وخلك من أوائل المتقدمين.",
  "لا تنتظر الفرصة المثالية. تابع الوظائف الجديدة يوميا وطور سيرتك مع CV World.",
];

const ENGLISH_OPENERS = [
  "Fresh jobs are live today. Build a stronger CV and apply faster with CV World.",
  "Looking for your next role? Here are new opportunities worth checking today.",
  "New openings are moving fast. Prepare your CV and apply with confidence.",
  "A better job search starts with a better CV. CV World helps you do both.",
  "Your next opportunity may already be live. Check today’s fresh jobs on CV World.",
];

const BENEFIT_LINES_AR = [
  "✅ وظائف محدثة يوميا",
  "✅ إنشاء سيرة ذاتية احترافية مجانا",
  "✅ قوالب CV مرتبة وجاهزة",
  "✅ تقديم أسرع وروابط مباشرة عند توفرها",
];

const BENEFIT_LINES_EN = [
  "✅ Fresh jobs updated daily",
  "✅ Build a professional CV for free",
  "✅ Clean CV templates ready to use",
  "✅ Faster applying with direct links when available",
];

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT GitHub secret.");
  }

  const decoded = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(decoded);
}

function initFirebase() {
  if (admin.getApps().length) return getFirestore();
  admin.initializeApp({
    credential: admin.cert(parseServiceAccount()),
  });
  return getFirestore();
}

function nowInQatar() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFIG.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function currentSlot() {
  const qatar = nowInQatar();
  return qatar.hour < 14 ? "morning" : "evening";
}

function safeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanCompany(value = "") {
  const raw = safeText(value);
  const replacements = {
    AccorHotel: "Accor",
    EtihadAirways5: "Etihad Airways",
    VAMSystems: "VAM Systems",
    JobsForHumanity: "Jobs for Humanity",
  };
  return replacements[raw] || raw || "Employer";
}

function jobCountry(job = {}) {
  const country = safeText(job.country).toLowerCase();
  if (COUNTRY_PROFILES[country]) return country;

  const location = safeText(job.location).toLowerCase();
  if (location.includes("qatar") || location.includes("doha")) return "qa";
  if (location.includes("uae") || location.includes("dubai") || location.includes("abu dhabi")) return "ae";
  if (location.includes("saudi") || location.includes("riyadh") || location.includes("jeddah")) return "sa";
  if (location.includes("morocco") || location.includes("casablanca") || location.includes("rabat")) return "ma";
  if (location.includes("algeria") || location.includes("algiers")) return "dz";
  if (location.includes("tunisia") || location.includes("tunis")) return "tn";
  return "qa";
}

function timestampMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value._seconds === "number") return value._seconds * 1000;
  if (value instanceof Date) return value.getTime();
  return 0;
}

async function fetchRecentJobs(db) {
  const snapshot = await db.collection("jobs")
    .where("isActive", "==", true)
    .limit(900)
    .get();

  const jobs = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((job) => job.isExpired !== true)
    .map((job) => ({
      id: job.id,
      title: safeText(job.title),
      company: cleanCompany(job.company),
      location: safeText(job.location),
      country: jobCountry(job),
      applyLink: safeText(job.applyLink),
      hasDirectApply: job.hasDirectApply === true || !!job.directApplyType,
      score: Number(job.qualityScore || 0),
      createdAtMs: timestampMs(job.createdAt),
      lastSeenAtMs: timestampMs(job.lastSeenAt),
    }))
    .filter((job) => job.title && job.company);

  jobs.sort((a, b) => {
    const bTime = Math.max(b.lastSeenAtMs, b.createdAtMs);
    const aTime = Math.max(a.lastSeenAtMs, a.createdAtMs);
    return (bTime - aTime) || (b.score - a.score);
  });

  return jobs;
}

async function fetchRecentPostLog(db) {
  const cutoff = Date.now() - CONFIG.minHoursBetweenSimilarPosts * 60 * 60 * 1000;
  const snapshot = await db.collection("growth_engine_posts")
    .where("createdAtMs", ">=", cutoff)
    .limit(20)
    .get();
  return snapshot.docs.map((doc) => doc.data());
}

function chooseCountry(jobs, recentPosts) {
  const counts = new Map();
  for (const job of jobs) {
    counts.set(job.country, (counts.get(job.country) || 0) + 1);
  }

  const recentlyPosted = new Set(recentPosts.map((post) => post.country));
  const ranked = [...counts.entries()]
    .filter(([country]) => COUNTRY_PROFILES[country])
    .sort((a, b) => b[1] - a[1]);

  return ranked.find(([country]) => !recentlyPosted.has(country))?.[0]
    || ranked[0]?.[0]
    || "qa";
}

function chooseLanguage(country, slot) {
  if (["ma", "dz", "tn"].includes(country) && slot === "evening") return "ar";
  return slot === "morning" ? "ar" : "en";
}

function pick(array, seed) {
  if (!array.length) return "";
  const hash = crypto.createHash("sha1").update(seed).digest();
  return array[hash[0] % array.length];
}

function uniqueHashtags(tags) {
  return [...new Set(tags)].slice(0, 8).join(" ");
}

function composePost({ jobs, country, language, slot }) {
  const profile = COUNTRY_PROFILES[country] || COUNTRY_PROFILES.qa;
  const seed = `${country}-${language}-${slot}-${new Date().toISOString().slice(0, 10)}`;
  const selectedJobs = jobs.filter((job) => job.country === country).slice(0, CONFIG.maxJobs);
  const total = selectedJobs.length;
  const direct = selectedJobs.filter((job) => job.hasDirectApply).length;

  if (language === "en") {
    const opener = pick(ENGLISH_OPENERS, seed);
    const jobsText = selectedJobs.map((job, index) =>
      `${index + 1}. ${job.title} - ${job.company}${job.location ? ` (${job.location})` : ""}`,
    ).join("\n");
    const hashtags = uniqueHashtags([
      ...profile.hashtags,
      "#CVWorld",
      "#ResumeBuilder",
      "#JobSearch",
      "#Hiring",
    ]);

    return {
      title: `${profile.flag} New jobs in ${profile.en}`,
      headline: `New jobs in ${profile.en}`,
      subheadline: "Fresh opportunities selected today",
      message: [
        `${profile.flag} New jobs in ${profile.en}`,
        "",
        opener,
        "",
        jobsText,
        "",
        direct ? `${direct} of today’s roles include direct apply options.` : "Open CV World to check the latest active opportunities.",
        "",
        ...BENEFIT_LINES_EN.slice(0, 3),
        "",
        `Start here: ${CONFIG.appLink}`,
        "",
        hashtags,
      ].filter(Boolean).join("\n"),
      cta: "Build your CV. Find jobs faster.",
      selectedJobs,
    };
  }

  const opener = pick(ARABIC_OPENERS, seed);
  const jobsText = selectedJobs.map((job, index) =>
    `${index + 1}. ${job.title} - ${job.company}${job.location ? ` (${job.location})` : ""}`,
  ).join("\n");
  const hashtags = uniqueHashtags([
    ...profile.hashtags,
    "#CVWorld",
    "#سيرة_ذاتية",
    "#وظائف",
    "#فرص_عمل",
  ]);

  return {
    title: `${profile.flag} وظائف جديدة في ${profile.ar}`,
    headline: `وظائف جديدة في ${profile.ar}`,
    subheadline: "أبرز فرص اليوم المختارة",
    message: [
      `${profile.flag} وظائف جديدة في ${profile.ar}`,
      "",
      opener,
      "",
      jobsText,
      "",
      direct ? `${direct} من فرص اليوم فيها تقديم مباشر أو رابط تقديم واضح.` : "افتح CV World وشاهد أحدث الوظائف المتاحة.",
      "",
      ...BENEFIT_LINES_AR.slice(0, 3),
      "",
      `ابدأ من هنا: ${CONFIG.appLink}`,
      "",
      hashtags,
    ].filter(Boolean).join("\n"),
    cta: "جهز CV احترافي وابدأ التقديم بثقة",
    selectedJobs,
  };
}

function escapeXml(value = "") {
  return safeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(text, maxChars) {
  const words = safeText(text).split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

async function logoDataUri() {
  try {
    const buffer = await fs.readFile(CONFIG.brandAssets.logo);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    const svg = `
      <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <rect width="256" height="256" rx="56" fill="#25D0FF"/>
        <text x="128" y="112" text-anchor="middle" font-size="58" font-weight="900" fill="#06111F" font-family="Arial, sans-serif">CV</text>
        <text x="128" y="166" text-anchor="middle" font-size="34" font-weight="800" fill="#06111F" font-family="Arial, sans-serif">World</text>
      </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }
}

async function renderImage({ post, country, language }) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const profile = COUNTRY_PROFILES[country] || COUNTRY_PROFILES.qa;
  const logo = await logoDataUri();
  const isArabic = language === "ar";
  const titleAnchor = isArabic ? "end" : "start";
  const xTitle = isArabic ? 1010 : 110;
  const jobs = post.selectedJobs.slice(0, 4);

  const jobBlocks = jobs.map((job, index) => {
    const y = 430 + index * 112;
    const titleLines = wrapText(job.title, 46);
    const companyLine = `${job.company}${job.location ? ` • ${job.location}` : ""}`;
    const lineSvg = titleLines.map((line, lineIndex) =>
      `<text x="${isArabic ? 980 : 140}" y="${y + 34 + lineIndex * 31}" text-anchor="${isArabic ? "end" : "start"}" font-size="28" font-weight="700" fill="#0B1220">${escapeXml(line)}</text>`,
    ).join("");
    return `
      <rect x="92" y="${y}" width="996" height="88" rx="18" fill="#FFFFFF" opacity="0.94"/>
      <circle cx="${isArabic ? 1034 : 146}" cy="${y + 44}" r="26" fill="#25D0FF"/>
      <text x="${isArabic ? 1034 : 146}" y="${y + 54}" text-anchor="middle" font-size="27" font-weight="900" fill="#06111F">${index + 1}</text>
      ${lineSvg}
      <text x="${isArabic ? 980 : 140}" y="${y + 76}" text-anchor="${isArabic ? "end" : "start"}" font-size="22" font-weight="500" fill="#3A4A60">${escapeXml(companyLine)}</text>
    `;
  }).join("");

  const svg = `
  <svg width="1200" height="1200" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#06111F"/>
        <stop offset="52%" stop-color="#0B2742"/>
        <stop offset="100%" stop-color="#0A6E89"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="1200" fill="url(#bg)"/>
    <rect x="0" y="0" width="1200" height="1200" fill="#FFFFFF" opacity="0.02"/>
    <image href="${logo}" x="${isArabic ? 950 : 90}" y="76" width="116" height="116"/>
    <text x="${isArabic ? 920 : 230}" y="124" text-anchor="${titleAnchor}" font-size="36" font-weight="900" fill="#FFFFFF">CV World</text>
    <text x="${isArabic ? 920 : 230}" y="164" text-anchor="${titleAnchor}" font-size="24" font-weight="600" fill="#9EEBFF">${escapeXml(post.cta)}</text>
    <text x="${xTitle}" y="290" text-anchor="${titleAnchor}" font-size="68" font-weight="900" fill="#FFFFFF">${escapeXml(post.headline)}</text>
    <text x="${xTitle}" y="348" text-anchor="${titleAnchor}" font-size="34" font-weight="700" fill="#BDEFFF">${escapeXml(post.subheadline)}</text>
    ${jobBlocks}
    <rect x="92" y="930" width="996" height="128" rx="24" fill="#25D0FF"/>
    <text x="600" y="985" text-anchor="middle" font-size="34" font-weight="900" fill="#06111F">${isArabic ? "حمّل التطبيق وشاهد الوظائف الجديدة يوميا" : "Download the app and check fresh jobs daily"}</text>
    <text x="600" y="1030" text-anchor="middle" font-size="28" font-weight="700" fill="#06111F">${escapeXml(CONFIG.appLink)}</text>
    <text x="600" y="1132" text-anchor="middle" font-size="25" font-weight="700" fill="#FFFFFF" opacity="0.88">#CVWorld • ${escapeXml(profile.en)} Jobs • Resume Builder</text>
  </svg>`;

  const hash = crypto.createHash("sha1").update(`${post.message}-${Date.now()}`).digest("hex").slice(0, 10);
  const output = path.join(OUTPUT_DIR, `cvworld-facebook-${hash}.png`);
  await sharp(Buffer.from(svg)).png().toFile(output);
  return output;
}

async function publishPhoto({ message, imagePath }) {
  if (!CONFIG.pageId || !CONFIG.pageToken) {
    throw new Error("Missing FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN.");
  }

  const form = new FormData();
  const image = await fs.readFile(imagePath);
  form.append("message", message);
  form.append("published", "true");
  form.append("access_token", CONFIG.pageToken);
  form.append("source", new Blob([image], { type: "image/png" }), path.basename(imagePath));

  const response = await fetch(`https://graph.facebook.com/v21.0/${CONFIG.pageId}/photos`, {
    method: "POST",
    body: form,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Facebook publish failed: ${JSON.stringify(data)}`);
  }
  return data;
}

async function logPost(db, payload) {
  await db.collection("growth_engine_posts").add({
    ...payload,
    createdAtMs: Date.now(),
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function main() {
  const db = initFirebase();
  const slot = process.env.POST_SLOT || currentSlot();
  const jobs = await fetchRecentJobs(db);
  const recentPosts = await fetchRecentPostLog(db);
  const country = process.env.TARGET_COUNTRY || chooseCountry(jobs, recentPosts);
  const language = process.env.POST_LANGUAGE || chooseLanguage(country, slot);
  const countryJobs = jobs.filter((job) => job.country === country);

  if (!countryJobs.length) {
    throw new Error(`No active jobs found for country ${country}.`);
  }

  const post = composePost({ jobs, country, language, slot });
  const imagePath = await renderImage({ post, country, language });
  const dryRunPayload = {
    slot,
    country,
    language,
    imagePath,
    message: post.message,
    jobs: post.selectedJobs.map((job) => ({ title: job.title, company: job.company, location: job.location })),
  };

  if (CONFIG.privacyMode) {
    console.log(JSON.stringify({ dryRun: true, ...dryRunPayload }, null, 2));
    return;
  }

  const facebook = await publishPhoto({ message: post.message, imagePath });
  await logPost(db, {
    slot,
    country,
    language,
    facebook,
    message: post.message,
    jobIds: post.selectedJobs.map((job) => job.id),
    imageFile: path.basename(imagePath),
  });

  console.log(JSON.stringify({ success: true, facebook, ...dryRunPayload }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
