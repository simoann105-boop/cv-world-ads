import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import sharp from "sharp";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const OUTPUT_DIR = path.resolve(ROOT, "marketing", "growth-engine", "out");
const EMBEDDED_LOGO_DATA_URI = "data:image/png;base64,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";

const CONFIG = {
  appName: "CV World",
  timezone: process.env.TIMEZONE || "Asia/Qatar",
  appLink: process.env.APP_DOWNLOAD_LINK || "https://cvworld.app",
  privacyMode: process.env.DRY_RUN === "true",
  pageId: process.env.FACEBOOK_PAGE_ID || "",
  pageToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "",
  maxJobs: Number(process.env.MAX_JOBS_PER_POST || 5),
  contentType: process.env.POST_TYPE || "auto",
  brandAssets: {
    logo: process.env.CVWORLD_LOGO_PATH || path.resolve(ROOT, "marketing", "growth-engine", "assets", "app_icon.png"),
    cvVisual: process.env.CVWORLD_CV_VISUAL_PATH || path.resolve(ROOT, "marketing", "growth-engine", "assets", "cv_icon.png"),
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
  "فرص جديدة وصلت اليوم. جهز سيرتك باحتراف وكن من أوائل المتقدمين.",
  "لا تضيع وقتك بين الروابط المتفرقة. CV World يجمع لك فرص العمل ويساعدك تجهز CV أقوى.",
  "وظائف جديدة الآن، ومع CV World تقدر تبني سيرة ذاتية احترافية مجانا وتبدأ التقديم بثقة.",
  "اليوم فيه فرص ممتازة للباحثين عن عمل. راجع التفاصيل، جهز CV واضح، وتقدم بسرعة.",
  "الفرص لا تنتظر كثيرا. تابع الوظائف الجديدة يوميا وطور سيرتك مع CV World.",
  "خطوتك القادمة تبدأ من سيرة قوية وفرصة مناسبة. هذه فرص مختارة لك اليوم.",
];

const ENGLISH_OPENERS = [
  "Fresh jobs are live today. Build a sharper CV and apply faster with CV World.",
  "Looking for your next role? These fresh opportunities are worth checking today.",
  "New openings move fast. Prepare a clear CV and apply with confidence.",
  "A better job search starts with a better CV. CV World helps you do both for free.",
  "Your next opportunity may already be live. Check today’s fresh jobs on CV World.",
  "Strong applications start before you click apply. Find the job, improve your CV, and move faster.",
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

const CTA_LINES_AR = [
  "احفظ المنشور وشاركه مع شخص يبحث عن عمل.",
  "تابع صفحة CV World لتصلك فرص ونصائح مهنية بشكل يومي.",
  "ابدأ اليوم: وظيفة مناسبة + CV احترافي = فرصة أقوى.",
  "افتح التطبيق، اختر الوظيفة، وجهز سيرتك قبل التقديم.",
];

const CTA_LINES_EN = [
  "Save this post and share it with someone looking for work.",
  "Follow CV World for fresh jobs and practical career tips.",
  "Start today: the right role plus a stronger CV gives you a better chance.",
  "Open the app, choose the role, and prepare your CV before applying.",
];

const GROWTH_HASHTAGS_AR = [
  "#وظائف_الخليج",
  "#وظائف_اليوم",
  "#ابحث_عن_عمل",
  "#توظيف",
  "#بناء_السيرة_الذاتية",
];

const GROWTH_HASHTAGS_EN = [
  "#GulfJobs",
  "#MENAJobs",
  "#CareerGrowth",
  "#FreeCVBuilder",
  "#JobSeekers",
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

function chooseCountry(jobs, slot) {
  const counts = new Map();
  for (const job of jobs) {
    counts.set(job.country, (counts.get(job.country) || 0) + 1);
  }

  const ranked = [...counts.entries()]
    .filter(([country]) => COUNTRY_PROFILES[country])
    .sort((a, b) => b[1] - a[1]);

  if (!ranked.length) return "qa";

  const today = nowInQatar().date;
  const index = deterministicIndex(`${today}-${slot}-country-rotation`, ranked.length);
  return ranked[index]?.[0] || ranked[0][0];
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

function conversionLine(language, seed) {
  return pick(language === "en" ? CTA_LINES_EN : CTA_LINES_AR, `${seed}-cta`);
}

function growthHashtags({ profile, language, extra = [] }) {
  return uniqueHashtags([
    ...profile.hashtags,
    ...extra,
    ...(language === "en" ? GROWTH_HASHTAGS_EN : GROWTH_HASHTAGS_AR),
    "#CVWorld",
  ]);
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
    const hashtags = growthHashtags({
      profile,
      language,
      extra: ["#ResumeBuilder", "#JobSearch", "#Hiring"],
    });

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
        conversionLine(language, seed),
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
  const hashtags = growthHashtags({
    profile,
    language,
    extra: ["#سيرة_ذاتية", "#وظائف", "#فرص_عمل"],
  });

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
      conversionLine(language, seed),
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
    const seed = `${country}-${language}-${job.id || job.title}-spotlight`;
    const hashtags = growthHashtags({
      profile,
      language,
      extra: ["#NowHiring", "#CareerOpportunity", "#ResumeBuilder"],
    });

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
        conversionLine(language, seed),
        "",
        `Open CV World: ${CONFIG.appLink}`,
        "",
        hashtags,
      ].join("\n"),
      cta: "Featured by CV World",
      selectedJobs: [job],
    };
  }

  const seed = `${country}-${language}-${job.id || job.title}-spotlight`;
  const hashtags = growthHashtags({
    profile,
    language,
    extra: ["#وظائف", "#فرص_عمل", "#سيرة_ذاتية"],
  });

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
      conversionLine(language, seed),
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
    const hashtags = growthHashtags({
      profile,
      language,
      extra: ["#InterviewTips", "#CareerAdvice", "#JobInterview"],
    });

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
        conversionLine(language, seed),
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

  const hashtags = growthHashtags({
    profile,
    language,
    extra: ["#نصائح_مهنية", "#مقابلة_عمل", "#سيرة_ذاتية"],
  });

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
    conversionLine(language, seed),
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

function wrapText(text, maxChars, maxLines = 2) {
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
  return lines.slice(0, maxLines);
}

async function imageDataUri(imagePath, fallbackSvg) {
  try {
    const buffer = await fs.readFile(imagePath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return `data:image/svg+xml;base64,${Buffer.from(fallbackSvg).toString("base64")}`;
  }
}

function fallbackLogoSvg() {
  return `
      <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <rect width="256" height="256" rx="56" fill="#07111F"/>
        <rect x="14" y="14" width="228" height="228" rx="46" fill="none" stroke="#D8B764" stroke-width="12"/>
        <text x="128" y="115" text-anchor="middle" font-size="58" font-weight="900" fill="#F8D977" font-family="Arial, sans-serif">CV</text>
        <text x="128" y="166" text-anchor="middle" font-size="34" font-weight="800" fill="#FFFFFF" font-family="Arial, sans-serif">World</text>
      </svg>`;
}

function fallbackCvVisualSvg() {
  return `
      <svg width="900" height="520" viewBox="0 0 900 520" xmlns="http://www.w3.org/2000/svg">
        <rect width="900" height="520" fill="none"/>
        <rect x="190" y="34" width="330" height="430" rx="42" fill="#F8FAFC" stroke="#8AA2BA" stroke-width="10"/>
        <rect x="250" y="100" width="90" height="90" rx="45" fill="#DDE7F0"/>
        <rect x="380" y="112" width="104" height="20" rx="10" fill="#0B2D55"/>
        <rect x="380" y="150" width="74" height="16" rx="8" fill="#677789"/>
        <rect x="250" y="230" width="215" height="18" rx="9" fill="#0B2D55"/>
        <rect x="250" y="270" width="230" height="14" rx="7" fill="#6D7D8C"/>
        <rect x="250" y="306" width="200" height="14" rx="7" fill="#6D7D8C"/>
        <rect x="250" y="344" width="230" height="14" rx="7" fill="#6D7D8C"/>
      </svg>`;
}

async function logoDataUri() {
  try {
    const buffer = await fs.readFile(CONFIG.brandAssets.logo);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return EMBEDDED_LOGO_DATA_URI;
  }
}

async function cvVisualDataUri() {
  return imageDataUri(CONFIG.brandAssets.cvVisual, fallbackCvVisualSvg());
}

async function saveSocialImage(svg, output) {
  await sharp(Buffer.from(svg), { density: 216 })
    .resize(1200, 1500, { fit: "cover" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);
}

function brandHeader({ logo, isArabic, label }) {
  const logoX = isArabic ? 992 : 92;
  const textX = isArabic ? 960 : 244;
  const anchor = isArabic ? "end" : "start";
  return `
    <rect x="64" y="58" width="1072" height="138" rx="32" fill="#FFFFFF" opacity="0.96"/>
    <image href="${logo}" x="${logoX}" y="82" width="88" height="88"/>
    <text x="${textX}" y="119" text-anchor="${anchor}" font-size="34" font-weight="950" fill="#06111F">CV World</text>
    <text x="${textX}" y="158" text-anchor="${anchor}" font-size="23" font-weight="800" fill="#35506D">${escapeXml(label)}</text>
  `;
}

async function renderTipImage({ post, country, language }) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const profile = COUNTRY_PROFILES[country] || COUNTRY_PROFILES.qa;
  const logo = await logoDataUri();
  const cvVisual = await cvVisualDataUri();
  const isArabic = language === "ar";
  const anchor = isArabic ? "end" : "start";
  const x = isArabic ? 1040 : 160;
  const visualX = isArabic ? 70 : 650;
  const tipLines = post.tip.tips.slice(0, 3);

  const bulletBlocks = tipLines.map((line, index) => {
    const y = 730 + index * 124;
    const lines = wrapText(line, isArabic ? 38 : 43, 2);
    return `
      <rect x="96" y="${y - 54}" width="1008" height="98" rx="22" fill="#FFFFFF" opacity="0.96"/>
      <circle cx="${isArabic ? 1050 : 150}" cy="${y - 6}" r="28" fill="#D8B764"/>
      <text x="${isArabic ? 1050 : 150}" y="${y + 5}" text-anchor="middle" font-size="25" font-weight="950" fill="#06111F">${index + 1}</text>
      ${lines.map((text, lineIndex) =>
        `<text x="${isArabic ? 994 : 202}" y="${y - 14 + lineIndex * 31}" text-anchor="${anchor}" font-size="28" font-weight="800" fill="#0B1220">${escapeXml(text)}</text>`,
      ).join("")}
    `;
  }).join("");

  const headlineLines = wrapText(post.headline, isArabic ? 21 : 27, 3);
  const headlineSvg = headlineLines.map((line, index) =>
    `<text x="${x}" y="${306 + index * 73}" text-anchor="${anchor}" font-size="67" font-weight="950" fill="#FFFFFF">${escapeXml(line)}</text>`,
  ).join("");

  const svg = `
  <svg width="1200" height="1500" viewBox="0 0 1200 1500" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tipBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#06111F"/>
        <stop offset="46%" stop-color="#0B2D55"/>
        <stop offset="100%" stop-color="#178A99"/>
      </linearGradient>
      <radialGradient id="goldGlow" cx="72%" cy="22%" r="48%">
        <stop offset="0%" stop-color="#F6D37A" stop-opacity="0.44"/>
        <stop offset="100%" stop-color="#F6D37A" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="1500" fill="url(#tipBg)"/>
    <rect width="1200" height="1500" fill="url(#goldGlow)"/>
    <circle cx="1040" cy="420" r="260" fill="#FFFFFF" opacity="0.05"/>
    <circle cx="150" cy="1160" r="330" fill="#D8B764" opacity="0.12"/>
    ${brandHeader({ logo, isArabic, label: post.cta })}
    ${headlineSvg}
    <text x="${x}" y="545" text-anchor="${anchor}" font-size="30" font-weight="850" fill="#BDEFFF">${escapeXml(post.subheadline)}</text>
    <image href="${cvVisual}" x="${visualX}" y="382" width="480" height="262" opacity="0.92"/>
    <rect x="92" y="620" width="1016" height="64" rx="32" fill="#C8234A"/>
    <text x="600" y="662" text-anchor="middle" font-size="27" font-weight="950" fill="#FFFFFF">${isArabic ? "نصيحة عملية للباحثين عن عمل" : "Practical advice for job seekers"}</text>
    ${bulletBlocks}
    <rect x="96" y="1212" width="1008" height="152" rx="34" fill="#F8D977"/>
    <text x="600" y="1276" text-anchor="middle" font-size="35" font-weight="950" fill="#06111F">${isArabic ? "جهز CV أقوى وافتح فرصتك القادمة" : "Build a stronger CV and find your next role"}</text>
    <text x="600" y="1332" text-anchor="middle" font-size="29" font-weight="900" fill="#06111F">${escapeXml(CONFIG.appLink)}</text>
    <text x="600" y="1438" text-anchor="middle" font-size="26" font-weight="900" fill="#FFFFFF" opacity="0.92">#CVWorld • ${escapeXml(profile.en)} • Career Tips</text>
  </svg>`;

  const hash = crypto.createHash("sha1").update(`${post.message}-${Date.now()}`).digest("hex").slice(0, 10);
  const output = path.join(OUTPUT_DIR, `cvworld-career-tip-${hash}.png`);
  await saveSocialImage(svg, output);
  return output;
}

async function renderImage({ post, country, language }) {
  if (post.kind === "career_tip") {
    return renderTipImage({ post, country, language });
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const profile = COUNTRY_PROFILES[country] || COUNTRY_PROFILES.qa;
  const logo = await logoDataUri();
  const cvVisual = await cvVisualDataUri();
  const isArabic = language === "ar";
  const titleAnchor = isArabic ? "end" : "start";
  const xTitle = isArabic ? 1040 : 160;
  const visualX = isArabic ? 70 : 650;
  const jobs = post.selectedJobs.slice(0, 4);

  const jobBlocks = jobs.map((job, index) => {
    const y = 664 + index * 120;
    const titleLines = wrapText(job.title, 38, 2);
    const companyLine = `${job.company}${job.location ? ` • ${job.location}` : ""}`;
    const lineSvg = titleLines.map((line, lineIndex) =>
      `<text x="${isArabic ? 982 : 214}" y="${y + 36 + lineIndex * 31}" text-anchor="${isArabic ? "end" : "start"}" font-size="28" font-weight="850" fill="#0B1220">${escapeXml(line)}</text>`,
    ).join("");
    return `
      <rect x="96" y="${y}" width="1008" height="100" rx="22" fill="#FFFFFF" opacity="0.96"/>
      <circle cx="${isArabic ? 1048 : 150}" cy="${y + 50}" r="29" fill="#D8B764"/>
      <text x="${isArabic ? 1048 : 150}" y="${y + 60}" text-anchor="middle" font-size="27" font-weight="950" fill="#06111F">${index + 1}</text>
      ${lineSvg}
      <text x="${isArabic ? 982 : 214}" y="${y + 82}" text-anchor="${isArabic ? "end" : "start"}" font-size="22" font-weight="700" fill="#3A4A60">${escapeXml(companyLine)}</text>
    `;
  }).join("");

  const headlineLines = wrapText(post.headline, isArabic ? 21 : 28, 2);
  const headlineSvg = headlineLines.map((line, index) =>
    `<text x="${xTitle}" y="${300 + index * 72}" text-anchor="${titleAnchor}" font-size="66" font-weight="950" fill="#FFFFFF">${escapeXml(line)}</text>`,
  ).join("");

  const svg = `
  <svg width="1200" height="1500" viewBox="0 0 1200 1500" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#06111F"/>
        <stop offset="48%" stop-color="#0B2D55"/>
        <stop offset="100%" stop-color="#096D7B"/>
      </linearGradient>
      <radialGradient id="spotlight" cx="73%" cy="30%" r="48%">
        <stop offset="0%" stop-color="#F8D977" stop-opacity="0.36"/>
        <stop offset="100%" stop-color="#F8D977" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="1500" fill="url(#bg)"/>
    <rect width="1200" height="1500" fill="url(#spotlight)"/>
    <path d="M0 1040 C250 930 440 1100 690 1002 C906 918 1000 760 1200 815 L1200 1500 L0 1500 Z" fill="#FFFFFF" opacity="0.07"/>
    ${brandHeader({ logo, isArabic, label: post.cta })}
    ${headlineSvg}
    <text x="${xTitle}" y="458" text-anchor="${titleAnchor}" font-size="32" font-weight="850" fill="#BDEFFF">${escapeXml(post.subheadline)}</text>
    <image href="${cvVisual}" x="${visualX}" y="360" width="480" height="262" opacity="0.95"/>
    <rect x="96" y="560" width="1008" height="66" rx="33" fill="#C8234A"/>
    <text x="600" y="604" text-anchor="middle" font-size="29" font-weight="950" fill="#FFFFFF">${isArabic ? "وظائف حية + CV احترافي في مكان واحد" : "Live jobs + a stronger CV in one place"}</text>
    ${jobBlocks}
    <rect x="96" y="1212" width="1008" height="152" rx="34" fill="#F8D977"/>
    <text x="600" y="1276" text-anchor="middle" font-size="35" font-weight="950" fill="#06111F">${isArabic ? "حمّل التطبيق وشاهد الوظائف الجديدة يوميا" : "Download the app and check fresh jobs daily"}</text>
    <text x="600" y="1332" text-anchor="middle" font-size="29" font-weight="900" fill="#06111F">${escapeXml(CONFIG.appLink)}</text>
    <text x="600" y="1438" text-anchor="middle" font-size="26" font-weight="900" fill="#FFFFFF" opacity="0.92">#CVWorld • ${escapeXml(profile.en)} Jobs • Resume Builder</text>
  </svg>`;

  const hash = crypto.createHash("sha1").update(`${post.message}-${Date.now()}`).digest("hex").slice(0, 10);
  const output = path.join(OUTPUT_DIR, `cvworld-facebook-${hash}.png`);
  await saveSocialImage(svg, output);
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

async function publishFeed({ message }) {
  if (!CONFIG.pageId || !CONFIG.pageToken) {
    throw new Error("Missing FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN.");
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${CONFIG.pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      access_token: CONFIG.pageToken,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Facebook feed publish failed: ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const db = initFirebase();
  const slot = process.env.POST_SLOT || currentSlot();
  const jobs = await fetchRecentJobs(db);
  const country = process.env.TARGET_COUNTRY || chooseCountry(jobs, slot);
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

  try {
    const facebook = await publishPhoto({ message: post.message, imagePath });
    console.log(JSON.stringify({ success: true, facebook, publishMode: "photo", ...dryRunPayload }, null, 2));
  } catch (photoError) {
    console.warn(`Facebook photo publish failed, trying text feed fallback: ${photoError.message}`);
    const facebook = await publishFeed({ message: post.message });
    console.log(JSON.stringify({
      success: true,
      facebook,
      publishMode: "feed_fallback",
      photoPublishError: photoError.message,
      ...dryRunPayload,
    }, null, 2));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
