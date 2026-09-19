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
  contentType: process.env.POST_TYPE || "auto",
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

const CAREER_TIPS_AR = [
  {
    headline: "كيف تجاوب على سؤال: حدثني عن نفسك؟",
    hook: "في مقابلات الخليج، لا تبدأ بقصة طويلة. أعطِ جوابا مركزا يربط خبرتك بالوظيفة.",
    tips: [
      "ابدأ بخبرتك الحالية أو آخر منصب لك.",
      "اذكر إنجازا واحدا بالأرقام إن أمكن.",
      "اختم بسبب اهتمامك بهذه الوظيفة بالتحديد.",
    ],
    cta: "جهز CV قوي ثم تدرب على إجابتك قبل المقابلة.",
  },
  {
    headline: "قبل أن تقدم على وظيفة في الخليج",
    hook: "لا ترسل نفس السيرة لكل إعلان. التعديل الصغير قد يرفع فرصة ظهورك للـHR.",
    tips: [
      "ضع كلمات الإعلان داخل CV بشكل طبيعي.",
      "رتب الخبرات الأهم في أول الصفحة.",
      "اكتب إنجازات واضحة بدل المهام العامة.",
    ],
    cta: "استخدم CV World لتجهيز سيرة مناسبة بسرعة.",
  },
  {
    headline: "كيف تزيد فرصة قبولك في المقابلة؟",
    hook: "الـHR لا يبحث فقط عن الخبرة، بل عن شخص واضح وجاهز ويعرف قيمة نفسه.",
    tips: [
      "اقرأ عن الشركة قبل المقابلة.",
      "جهز مثالين عن حل مشكلة أو تحمل مسؤولية.",
      "اسأل سؤالا ذكيا في نهاية المقابلة.",
    ],
    cta: "تابع الوظائف وتدرب يوميا مع CV World.",
  },
  {
    headline: "خطأ شائع في البحث عن عمل",
    hook: "كثير من المتقدمين يرسلون عشرات الطلبات بدون متابعة أو تحسين للـCV.",
    tips: [
      "راجع سيرتك كل أسبوع.",
      "تقدم بسرعة على الوظائف الجديدة.",
      "اكتب رسالة قصيرة مناسبة لكل وظيفة مهمة.",
    ],
    cta: "ابدأ من CV World وخلي بحثك منظم.",
  },
];

const CAREER_TIPS_EN = [
  {
    headline: "How to answer: Tell me about yourself",
    hook: "Keep it short, relevant, and connected to the role. Recruiters remember clarity.",
    tips: [
      "Start with your current or most recent role.",
      "Mention one measurable achievement.",
      "End with why this job is a strong fit.",
    ],
    cta: "Build your CV, then practice your interview answer.",
  },
  {
    headline: "Before applying for Gulf jobs",
    hook: "A generic CV gets ignored. A targeted CV helps HR quickly understand your fit.",
    tips: [
      "Mirror important keywords from the job post.",
      "Move your strongest experience to the top.",
      "Use achievements, not only responsibilities.",
    ],
    cta: "Use CV World to prepare a sharper CV faster.",
  },
  {
    headline: "Win the interview with better examples",
    hook: "Good answers are specific. Prepare stories before the call, not during it.",
    tips: [
      "Prepare examples for teamwork and pressure.",
      "Explain the action you took, not only the problem.",
      "Show the result clearly.",
    ],
    cta: "Find jobs and prepare with CV World.",
  },
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
  if (qatar.hour < 12) return "morning";
  if (qatar.hour < 18) return "afternoon";
  return "evening";
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

function deterministicIndex(seed, length) {
  if (!length) return 0;
  const hash = crypto.createHash("sha1").update(seed).digest();
  return hash[0] % length;
}

function choosePostKind({ slot, country, language }) {
  if (["jobs_list", "job_spotlight", "career_tip"].includes(CONFIG.contentType)) {
    return CONFIG.contentType;
  }

  if (slot !== "afternoon") return "jobs_list";

  const qatar = nowInQatar();
  const seed = `${qatar.date}-${country}-${language}-afternoon-growth`;
  return deterministicIndex(seed, 5) < 3 ? "career_tip" : "job_spotlight";
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
      kind: "jobs_list",
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
    kind: "jobs_list",
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

function composeJobSpotlight({ job, country, language }) {
  const profile = COUNTRY_PROFILES[country] || COUNTRY_PROFILES.qa;
  const location = job.location ? ` - ${job.location}` : "";

  if (language === "en") {
    const hashtags = uniqueHashtags([
      ...profile.hashtags,
      "#CVWorld",
      "#NowHiring",
      "#CareerOpportunity",
      "#ResumeBuilder",
    ]);

    return {
      kind: "job_spotlight",
      title: `${profile.flag} Featured job from CV World`,
      headline: job.title,
      subheadline: `${job.company}${location}`,
      message: [
        `${profile.flag} Featured job on CV World`,
        "",
        `Today’s highlighted opportunity: ${job.title}`,
        `Company: ${job.company}${location}`,
        "",
        "Want a stronger application?",
        "✅ Prepare a professional CV",
        "✅ Apply faster when direct links are available",
        "✅ Keep checking fresh jobs daily",
        "",
        `Open CV World: ${CONFIG.appLink}`,
        "",
        hashtags,
      ].join("\n"),
      cta: "Featured by CV World",
      selectedJobs: [job],
    };
  }

  const hashtags = uniqueHashtags([
    ...profile.hashtags,
    "#CVWorld",
    "#وظائف",
    "#فرص_عمل",
    "#سيرة_ذاتية",
  ]);

  return {
    kind: "job_spotlight",
    title: `${profile.flag} وظيفة مميزة من CV World`,
    headline: job.title,
    subheadline: `${job.company}${location}`,
    message: [
      `${profile.flag} وظيفة مميزة اليوم على CV World`,
      "",
      `الوظيفة: ${job.title}`,
      `الشركة: ${job.company}${location}`,
      "",
      "قبل التقديم، جهز نفسك جيدا:",
      "✅ CV مرتب وواضح",
      "✅ كلمات مناسبة لنفس مجال الوظيفة",
      "✅ متابعة يومية للوظائف الجديدة",
      "",
      `ابدأ من هنا: ${CONFIG.appLink}`,
      "",
      hashtags,
    ].join("\n"),
    cta: "وظيفة مختارة من CV World",
    selectedJobs: [job],
  };
}

function composeCareerTip({ country, language, slot }) {
  const profile = COUNTRY_PROFILES[country] || COUNTRY_PROFILES.qa;
  const seed = `${country}-${language}-${slot}-${new Date().toISOString().slice(0, 10)}-tip`;
  const tip = pick(language === "en" ? CAREER_TIPS_EN : CAREER_TIPS_AR, seed);

  if (language === "en") {
    const hashtags = uniqueHashtags([
      ...profile.hashtags,
      "#CVWorld",
      "#InterviewTips",
      "#GulfJobs",
      "#CareerAdvice",
    ]);

    return {
      kind: "career_tip",
      title: `Career tip by CV World`,
      headline: tip.headline,
      subheadline: "Daily career advice for better applications",
      message: [
        "💡 CV World career tip",
        "",
        tip.hook,
        "",
        ...tip.tips.map((line) => `✅ ${line}`),
        "",
        tip.cta,
        "",
        `Start here: ${CONFIG.appLink}`,
        "",
        hashtags,
      ].join("\n"),
      cta: "Daily career advice",
      tip,
      selectedJobs: [],
    };
  }

  const hashtags = uniqueHashtags([
    ...profile.hashtags,
    "#CVWorld",
    "#نصائح_مهنية",
    "#مقابلة_عمل",
    "#سيرة_ذاتية",
  ]);

  return {
    kind: "career_tip",
    title: "نصيحة مهنية من CV World",
    headline: tip.headline,
    subheadline: "نصيحة يومية للبحث عن عمل بثقة",
    message: [
      "💡 نصيحة CV World اليوم",
      "",
      tip.hook,
      "",
      ...tip.tips.map((line) => `✅ ${line}`),
      "",
      tip.cta,
      "",
      `ابدأ من هنا: ${CONFIG.appLink}`,
      "",
      hashtags,
    ].join("\n"),
    cta: "نصائح مهنية يومية",
    tip,
    selectedJobs: [],
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

async function renderTipImage({ post, country, language }) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const profile = COUNTRY_PROFILES[country] || COUNTRY_PROFILES.qa;
  const logo = await logoDataUri();
  const isArabic = language === "ar";
  const anchor = isArabic ? "end" : "start";
  const x = isArabic ? 1020 : 120;
  const tipLines = post.tip.tips.slice(0, 3);

  const bulletBlocks = tipLines.map((line, index) => {
    const y = 560 + index * 118;
    const lines = wrapText(line, isArabic ? 39 : 44);
    return `
      <rect x="112" y="${y - 52}" width="976" height="92" rx="22" fill="#FFFFFF" opacity="0.94"/>
      <circle cx="${isArabic ? 1038 : 162}" cy="${y - 6}" r="26" fill="#25D0FF"/>
      <text x="${isArabic ? 1038 : 162}" y="${y + 4}" text-anchor="middle" font-size="24" font-weight="900" fill="#06111F">${index + 1}</text>
      ${lines.map((text, lineIndex) =>
        `<text x="${isArabic ? 980 : 214}" y="${y - 12 + lineIndex * 30}" text-anchor="${anchor}" font-size="27" font-weight="750" fill="#0B1220">${escapeXml(text)}</text>`,
      ).join("")}
    `;
  }).join("");

  const headlineLines = wrapText(post.headline, isArabic ? 24 : 28);
  const headlineSvg = headlineLines.map((line, index) =>
    `<text x="${x}" y="${286 + index * 72}" text-anchor="${anchor}" font-size="64" font-weight="950" fill="#FFFFFF">${escapeXml(line)}</text>`,
  ).join("");

  const svg = `
  <svg width="1200" height="1200" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tipBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#07111F"/>
        <stop offset="48%" stop-color="#123A5A"/>
        <stop offset="100%" stop-color="#0FA3B1"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="1200" fill="url(#tipBg)"/>
    <rect x="72" y="72" width="1056" height="1056" rx="48" fill="#FFFFFF" opacity="0.07"/>
    <image href="${logo}" x="${isArabic ? 950 : 100}" y="92" width="112" height="112"/>
    <text x="${isArabic ? 920 : 232}" y="140" text-anchor="${anchor}" font-size="35" font-weight="900" fill="#FFFFFF">CV World</text>
    <text x="${isArabic ? 920 : 232}" y="180" text-anchor="${anchor}" font-size="24" font-weight="700" fill="#9EEBFF">${escapeXml(post.cta)}</text>
    ${headlineSvg}
    <text x="${x}" y="458" text-anchor="${anchor}" font-size="30" font-weight="750" fill="#BDEFFF">${escapeXml(post.subheadline)}</text>
    ${bulletBlocks}
    <rect x="112" y="930" width="976" height="128" rx="26" fill="#25D0FF"/>
    <text x="600" y="985" text-anchor="middle" font-size="34" font-weight="950" fill="#06111F">${isArabic ? "جهز سيرتك وتابع فرص العمل يوميا" : "Build your CV and follow fresh jobs daily"}</text>
    <text x="600" y="1032" text-anchor="middle" font-size="27" font-weight="800" fill="#06111F">${escapeXml(CONFIG.appLink)}</text>
    <text x="600" y="1132" text-anchor="middle" font-size="24" font-weight="800" fill="#FFFFFF" opacity="0.88">#CVWorld • ${escapeXml(profile.en)} • Career Tips</text>
  </svg>`;

  const hash = crypto.createHash("sha1").update(`${post.message}-${Date.now()}`).digest("hex").slice(0, 10);
  const output = path.join(OUTPUT_DIR, `cvworld-career-tip-${hash}.png`);
  await sharp(Buffer.from(svg)).png().toFile(output);
  return output;
}

async function renderImage({ post, country, language }) {
  if (post.kind === "career_tip") {
    return renderTipImage({ post, country, language });
  }

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
  const postKind = choosePostKind({ slot, country, language });

  if (postKind !== "career_tip" && !countryJobs.length) {
    throw new Error(`No active jobs found for country ${country}.`);
  }

  let post;
  if (postKind === "career_tip") {
    post = composeCareerTip({ country, language, slot });
  } else if (postKind === "job_spotlight") {
    const seed = `${country}-${language}-${slot}-${new Date().toISOString().slice(0, 10)}-spotlight`;
    const spotlightJob = countryJobs.slice(0, 12)[deterministicIndex(seed, Math.min(countryJobs.length, 12))];
    post = composeJobSpotlight({ job: spotlightJob, country, language });
  } else {
    post = composePost({ jobs, country, language, slot });
  }

  const imagePath = await renderImage({ post, country, language });
  const dryRunPayload = {
    kind: post.kind,
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
    kind: post.kind,
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
