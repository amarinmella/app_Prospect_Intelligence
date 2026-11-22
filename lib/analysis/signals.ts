/** Extracción de señales de una página HTML. Solo observa: la interpretación vive en detector.ts / llm.ts. */

export interface FormInfo { fields: number; hasEmail: boolean; hasPhone: boolean; hasMessage: boolean; action: string | null }

export interface WebsiteSignals {
  reachable: boolean;
  error: string | null;
  url: string | null;
  status: number | null;
  loadMs: number | null;
  https: boolean;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  lang: string | null;
  hasViewport: boolean;
  wordCount: number;
  ctas: string[];
  forms: FormInfo[];
  booking: { detected: boolean; provider: string | null };
  whatsapp: { detected: boolean; link: string | null };
  chat: { detected: boolean; provider: string | null };
  trackers: string[];          // analítica / píxeles detectados
  marketingStack: string[];    // CRM / email marketing detectados
  socials: Record<string, string>;
  emails: string[];
  phones: string[];
  schemaTypes: string[];
  pagesFetched: string[];
  /** El HTML puede cargar widgets por JS: la ausencia de una señal no es prueba absoluta. */
  jsHeavy: boolean;
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const clean = (s: string) => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  const v = m ? (m[1] ?? m[2] ?? m[3]) : null;
  return v == null ? null : decode(v);
}

const CTA_RE = /\b(reserv\w*|agend\w*|pide\w*|pedir|solicit\w*|cotiz\w*|presupuesto|contact\w*|llam\w*|escrib\w*|cita|comprar|empieza|comienza|prueba|descarg\w*|book|schedule|get started|request|quote|call us|contact us|appointment)\b/i;

const BOOKING: Array<[string, RegExp]> = [
  ["Calendly", /calendly\.com/i], ["Doctoralia", /doctoralia\./i], ["Treatwell", /treatwell\./i], ["SimplyBook", /simplybook\./i],
  ["Acuity", /acuityscheduling\.com|as\.me\//i], ["Reservio", /reservio\./i], ["Booksy", /booksy\./i], ["AgendaPro", /agendapro\./i],
  ["Cal.com", /cal\.com\//i], ["TheFork", /thefork\.|eltenedor\./i], ["OpenTable", /opentable\./i], ["Resy", /resy\.com/i],
  ["Setmore", /setmore\./i], ["Fresha", /fresha\.com/i], ["Google Reservas", /reserve\.google\.com|google\.com\/maps\/reserve/i],
  ["Bookeo", /bookeo\./i], ["Cliniccloud", /clinic-?cloud/i], ["Medicloud", /medicloud/i],
];
const BOOKING_TEXT = /\b(reserva(?:r)? (?:online|ahora|tu|una)|pide(?:r)? (?:tu )?cita|cita online|agenda(?:r)? (?:tu )?(?:hora|cita|visita)|book (?:online|now|an appointment)|schedule an appointment)\b/i;

const CHAT: Array<[string, RegExp]> = [
  ["Tawk.to", /tawk\.to/i], ["Intercom", /intercom(?:cdn)?\.(?:io|com)/i], ["Drift", /js\.driftt\.com|drift\.com/i], ["Crisp", /client\.crisp\.chat/i],
  ["Tidio", /code\.tidio\.co|tidiochat/i], ["LiveChat", /livechatinc\.com/i], ["Zendesk", /zopim|static\.zdassets\.com/i],
  ["HubSpot Conversations", /js\.usemessages\.com/i], ["ManyChat", /manychat/i], ["Botpress", /botpress/i], ["Landbot", /landbot\.io/i],
  ["WhatsApp widget", /(?:wa-?widget|whatsapp-?chat|joinchat|elfsight[^"']*whatsapp|getbutton\.io|wati\.io)/i], ["JivoChat", /jivosite|jivochat/i],
];

const TRACKERS: Array<[string, RegExp]> = [
  ["Google Analytics", /googletagmanager\.com\/gtag\/js|google-analytics\.com|gtag\(\s*['"]config['"]/i], ["Google Tag Manager", /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/],
  ["Meta Pixel", /connect\.facebook\.net\/[^"']*fbevents|fbq\(\s*['"]init/i], ["Hotjar", /static\.hotjar\.com/i], ["TikTok Pixel", /analytics\.tiktok\.com/i],
  ["LinkedIn Insight", /snap\.licdn\.com/i], ["Google Ads", /googleadservices\.com|AW-\d{6,}/i], ["Microsoft Clarity", /clarity\.ms/i],
];
const MARKETING: Array<[string, RegExp]> = [
  ["HubSpot", /js\.hs-scripts\.com|js\.hsforms\.net|hubspot\.com/i], ["ActiveCampaign", /activehosted\.com|activecampaign/i], ["Mailchimp", /mailchimp\.com|chimpstatic\.com|list-manage\.com/i],
  ["Klaviyo", /klaviyo\.com/i], ["Brevo", /sendinblue|brevo\.com|sibforms/i], ["Zoho", /zoho\.(?:com|eu)|zohopublic/i], ["Salesforce", /salesforce\.com|pardot/i],
  ["ConvertKit", /convertkit\.com/i], ["GoHighLevel", /gohighlevel|leadconnectorhq/i],
];
const SOCIAL: Array<[string, RegExp]> = [
  ["instagram", /https?:\/\/(?:www\.)?instagram\.com\/(?!p\/|explore|accounts)[\w.\-]+/i], ["facebook", /https?:\/\/(?:www\.)?facebook\.com\/(?!sharer|plugins|tr\b|dialog)[\w.\-\/]+/i],
  ["linkedin", /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in)\/[\w.\-%]+/i], ["tiktok", /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.\-]+/i],
  ["youtube", /https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|user\/|@)[\w.\-]+/i], ["x", /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/(?!intent|share)[\w]{2,}/i],
];

export interface PageInput { url: string; status: number; html: string; loadMs: number }

function uniq<T>(a: T[]): T[] { return [...new Set(a)]; }

export function extractSignals(pages: PageInput[]): WebsiteSignals {
  const main = pages[0];
  const sig: WebsiteSignals = {
    reachable: !!main && main.status < 400 && main.html.length > 0, error: null, url: main?.url ?? null, status: main?.status ?? null, loadMs: main?.loadMs ?? null,
    https: !!main && main.url.startsWith("https://"), title: null, metaDescription: null, h1: [], lang: null, hasViewport: false, wordCount: 0, ctas: [],
    forms: [], booking: { detected: false, provider: null }, whatsapp: { detected: false, link: null }, chat: { detected: false, provider: null },
    trackers: [], marketingStack: [], socials: {}, emails: [], phones: [], schemaTypes: [], pagesFetched: pages.map((p) => p.url), jsHeavy: false,
  };
  if (!main || !sig.reachable) return sig;

  const html0 = main.html;
  sig.title = (html0.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] && clean(html0.match(/<title[^>]*>([\s\S]*?)<\/title>/i)![1]!)) || null;
  for (const m of html0.matchAll(/<meta\b[^>]*>/gi)) {
    const t = m[0];
    if (attr(t, "name")?.toLowerCase() === "description") sig.metaDescription = attr(t, "content");
    if (attr(t, "name")?.toLowerCase() === "viewport") sig.hasViewport = /width\s*=\s*device-width/i.test(attr(t, "content") ?? "");
  }
  sig.lang = html0.match(/<html[^>]*\blang\s*=\s*["']?([\w-]+)/i)?.[1] ?? null;
  sig.h1 = [...html0.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => clean(m[1]!)).filter(Boolean).slice(0, 5);

  const emails: string[] = [], phones: string[] = [], ctas: string[] = [], schema: string[] = [];
  let words = 0, scripts = 0;
  for (const p of pages) {
    const html = p.html;
    const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
    if (p === main) words = clean(body).split(" ").filter(Boolean).length;
    scripts += (html.match(/<script\b/gi) ?? []).length;

    for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) emails.push(decode(m[1]!).toLowerCase());
    for (const m of clean(body).matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)) if (!/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(m[0])) emails.push(m[0].toLowerCase());
    for (const m of html.matchAll(/tel:([+\d][\d\s().-]{5,})/gi)) phones.push(decode(m[1]!).trim());

    for (const m of body.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
      const text = clean(m[3]!);
      if (text && text.length <= 60 && CTA_RE.test(text)) ctas.push(text);
    }
    for (const m of body.matchAll(/<input\b[^>]*type\s*=\s*["']?(?:submit|button)["']?[^>]*>/gi)) {
      const v = attr(m[0], "value"); if (v && CTA_RE.test(v)) ctas.push(v);
    }
    for (const m of body.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
      const inner = m[2]!;
      const inputs = [...inner.matchAll(/<(input|textarea|select)\b[^>]*>/gi)].filter((i) => !/type\s*=\s*["']?(hidden|submit|button|checkbox|radio|image)["']?/i.test(i[0]));
      const names = inputs.map((i) => `${attr(i[0], "name") ?? ""} ${attr(i[0], "type") ?? ""} ${attr(i[0], "placeholder") ?? ""}`.toLowerCase());
      // Se ignoran formularios de búsqueda y de newsletter de un solo campo de búsqueda
      if (/role\s*=\s*["']search|type\s*=\s*["']search/i.test(m[1]! + inner) && inputs.length <= 1) continue;
      sig.forms.push({
        fields: inputs.length,
        hasEmail: names.some((n) => /mail/.test(n)),
        hasPhone: names.some((n) => /tel|phone|fono|celular|m[oó]vil/.test(n)),
        hasMessage: inputs.some((i) => /^<textarea/i.test(i[0])),
        action: attr(m[1]!, "action"),
      });
    }
    for (const m of html.matchAll(/"@type"\s*:\s*"([A-Za-z]+)"/g)) schema.push(m[1]!);

    for (const [name, re] of BOOKING) if (re.test(html) && !sig.booking.detected) sig.booking = { detected: true, provider: name };
    if (!sig.booking.detected && BOOKING_TEXT.test(clean(body))) sig.booking = { detected: true, provider: null };
    const wa = html.match(/https?:\/\/(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|chat\.whatsapp\.com)\/[^"'\s<>]*|whatsapp:\/\/send[^"'\s<>]*/i);
    if (wa && !sig.whatsapp.detected) sig.whatsapp = { detected: true, link: decode(wa[0]) };
    for (const [name, re] of CHAT) if (re.test(html) && !sig.chat.detected) sig.chat = { detected: true, provider: name };
    for (const [name, re] of TRACKERS) if (re.test(html)) sig.trackers.push(name);
    for (const [name, re] of MARKETING) if (re.test(html)) sig.marketingStack.push(name);
    for (const [name, re] of SOCIAL) { const s = html.match(re); if (s && !sig.socials[name]) sig.socials[name] = s[0]; }
  }
  sig.emails = uniq(emails).slice(0, 10);
  sig.phones = uniq(phones).slice(0, 10);
  sig.ctas = uniq(ctas).slice(0, 12);
  sig.trackers = uniq(sig.trackers);
  sig.marketingStack = uniq(sig.marketingStack);
  sig.schemaTypes = uniq(schema).slice(0, 15);
  sig.wordCount = words;
  sig.jsHeavy = words < 80 && scripts >= 5;
  return sig;
}

/** Enlaces internos candidatos a página de contacto/reserva (máx. 2). */
export function findContactLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const out: string[] = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(m[1]!, "href"); if (!href || /^(mailto|tel|javascript|#)/i.test(href)) continue;
    const text = clean(m[2]!);
    if (!/contact|contacto|reserv|cita|agenda|appointment|book/i.test(`${href} ${text}`)) continue;
    try {
      const u = new URL(href, base);
      if (u.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
      u.hash = "";
      if (u.href !== base.href && !out.includes(u.href) && /\.(pdf|jpg|png|zip)$/i.test(u.pathname) === false) out.push(u.href);
    } catch { /* href inválido */ }
    if (out.length >= 2) break;
  }
  return out;
}
