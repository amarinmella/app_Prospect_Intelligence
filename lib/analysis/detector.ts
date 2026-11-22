import type { Company, Confidence, EvidenceItem } from "../types";
import type { OpportunityDetector, OpportunityDraft, WebsiteAnalysis } from "./types";
import type { AnalysisSignals } from "./analyzer";

type Rule = (c: Company, s: AnalysisSignals) => OpportunityDraft | null;
const web = (url: string | null) => (url ? { url } : {});
const ev = (text: string, source: string, url?: string | null): EvidenceItem => ({ text, source, ...web(url ?? null) });

/** Una oportunidad por hallazgo. Cada una solo se emite si hay evidencia observable que la respalde. */
const rules: Rule[] = [
  (c, s) => c.website ? null : {
    problemKey: "no_website", title: "Sin sitio web propio", problem: "La empresa no tiene sitio web registrado en las fuentes consultadas.",
    evidence: [ev("No hay URL de sitio web en la ficha del negocio.", "discovery")], consequence: "Depende de directorios y redes para captar demanda y no puede medir ni automatizar la captación.",
    solution: "Landing de servicio con formulario, WhatsApp y reserva, conectada a un CRM sencillo.", service: "Presencia digital y captación de leads",
    impact: "Canal propio de captación donde hoy no hay ninguno.", impactLevel: "high", severity: 5, confidence: "medium",
  },
  (c, s) => c.website && !s.website.reachable ? {
    problemKey: "website_unreachable", title: "La web no responde correctamente", problem: "No se pudo cargar el sitio web durante el análisis.",
    evidence: [ev(`Error al cargar ${c.website}: ${s.website.error ?? "sin respuesta"}.`, "website", c.website)], consequence: "Si el fallo es persistente, se pierden visitas y confianza; si fue puntual, no hay problema.",
    solution: "Revisar hosting/DNS y monitorización de disponibilidad.", service: "Optimización y mantenimiento web",
    impact: "Evita pérdida de consultas por caída del sitio.", impactLevel: "medium", severity: 4, confidence: "low",
  } : null,
  (c, s) => {
    const w = s.website; if (!w.reachable || w.hasViewport) return null;
    return { problemKey: "no_mobile_viewport", title: "Web sin adaptación móvil visible", problem: "La página no declara viewport responsive.",
      evidence: [ev("Falta la etiqueta meta viewport con width=device-width.", "website", w.url)], consequence: "La mayoría del tráfico local llega desde móvil; una web no adaptada convierte menos.",
      solution: "Rediseño responsive o plantilla moderna.", service: "Optimización y mantenimiento web", impact: "Mejor conversión de visitas móviles.", impactLevel: "medium", severity: 4, confidence: "high" };
  },
  (c, s) => {
    const p = s.pagespeed; const w = s.website;
    const slowPs = p?.performance != null && p.performance < 50;
    const slowLoad = !p && w.loadMs != null && w.loadMs > 4000;
    if (!slowPs && !slowLoad) return null;
    const evidence = slowPs
      ? [ev(`PageSpeed móvil: ${p!.performance}/100${p!.lcpMs ? `, LCP ${(p!.lcpMs / 1000).toFixed(1)} s` : ""}.`, "pagespeed", w.url)]
      : [ev(`La página tardó ${(w.loadMs! / 1000).toFixed(1)} s en descargarse (medición simple, sin PageSpeed).`, "website", w.url)];
    return { problemKey: "slow_site", title: "Web lenta en móvil", problem: "El rendimiento de carga es bajo.", evidence, consequence: "Cada segundo extra aumenta el abandono antes de llegar al formulario o al teléfono.",
      solution: "Optimizar imágenes, scripts y hosting.", service: "Optimización y mantenimiento web", impact: "Menos abandono y mejor posicionamiento local.", impactLevel: "medium", severity: slowPs && p!.performance! < 30 ? 4 : 3, confidence: slowPs ? "high" : "low" };
  },
  (c, s) => {
    const w = s.website; if (!w.reachable || w.whatsapp.detected) return null;
    const conf: Confidence = w.chat.detected ? "low" : w.jsHeavy ? "low" : "medium";
    return { problemKey: "no_whatsapp", title: "Sin WhatsApp visible en la web", problem: "No se detectó ningún enlace o botón de WhatsApp.",
      evidence: [ev("No hay enlaces wa.me / api.whatsapp.com en las páginas analizadas.", "website", w.url)], consequence: "Los clientes que prefieren escribir en lugar de llamar o rellenar un formulario se pierden o tardan más en contactar.",
      solution: "Botón de WhatsApp Business con respuestas automáticas y derivación a humano fuera de horario.", service: "Automatización de atención por WhatsApp", impact: "Más consultas entrantes y respuesta inmediata.", impactLevel: "high", severity: 3, confidence: conf };
  },
  (c, s) => {
    const w = s.website; if (!w.reachable || w.booking.detected) return null;
    const bookable = /dent|cl[ií]nica|salud|m[eé]dic|peluquer|barber|est[eé]tica|spa|fisio|psic|veterin|restaurant|taller|gimnas|yoga|abogad|notar/i.test(`${c.niche ?? ""} ${c.category ?? ""}`);
    if (!bookable) return null;
    return { problemKey: "no_booking", title: "Sin sistema de reserva online", problem: "Para un negocio que vive de citas no se detectó agenda ni reserva online.",
      evidence: [ev("No se detectaron proveedores de reserva (Calendly, Doctoralia, AgendaPro, etc.) ni textos de 'reservar/pedir cita'.", "website", w.url), ev(`Nicho: ${c.niche ?? c.category}.`, "discovery")],
      consequence: "Las citas dependen de llamadas en horario de atención; se pierden solicitudes fuera de horario.", solution: "Agenda online con recordatorios automáticos y confirmación por WhatsApp.", service: "Sistema de reservas y recordatorios",
      impact: "Más citas captadas y menos ausencias.", impactLevel: "high", severity: 4, confidence: w.jsHeavy ? "low" : "medium" };
  },
  (c, s) => {
    const w = s.website; if (!w.reachable || w.chat.detected || w.whatsapp.detected) return null;
    return { problemKey: "no_instant_response", title: "Sin canal de respuesta inmediata", problem: "No hay chat ni WhatsApp: las consultas solo entran por formulario, email o teléfono.",
      evidence: [ev("No se detectó widget de chat ni WhatsApp en la web.", "website", w.url)], consequence: "Un lead que escribe fuera de horario espera horas, y quien contesta primero suele ganar al cliente.",
      solution: "Asistente de chat con IA que responde, cualifica y agenda, con traspaso a una persona.", service: "Chatbot de atención y cualificación con IA", impact: "Respuesta 24/7 y mejor cualificación de leads.", impactLevel: "high", severity: 4, confidence: w.jsHeavy ? "low" : "medium" };
  },
  (c, s) => {
    const w = s.website; if (!w.reachable) return null;
    if (w.forms.length === 0 && !w.booking.detected && !w.whatsapp.detected) return {
      problemKey: "no_lead_capture", title: "Sin captación de leads en la web", problem: "No hay formulario, reserva ni WhatsApp: el visitante solo puede llamar o escribir un email.",
      evidence: [ev("No se detectaron formularios de contacto en la web.", "website", w.url), ev(`Contacto visible: ${[w.phones.length && "teléfono", w.emails.length && "email"].filter(Boolean).join(" y ") || "ninguno claro"}.`, "website", w.url)],
      consequence: "Se pierden visitantes que no quieren llamar; no queda registro de quién consultó.", solution: "Formulario corto con respuesta automática y alta en CRM.", service: "Captación y cualificación de leads", impact: "Registro de cada consulta y seguimiento posible.", impactLevel: "high", severity: 4, confidence: w.jsHeavy ? "low" : "medium" };
    const heavy = w.forms.find((f) => f.fields > 7);
    return heavy ? {
      problemKey: "heavy_form", title: "Formulario demasiado largo", problem: `Un formulario pide ${heavy.fields} campos.`,
      evidence: [ev(`Formulario con ${heavy.fields} campos visibles.`, "website", w.url)], consequence: "Los formularios largos reducen el porcentaje de visitantes que lo completan.", solution: "Reducir a 3-4 campos y cualificar después con automatización.", service: "Captación y cualificación de leads",
      impact: "Más envíos por visita.", impactLevel: "medium", severity: 2, confidence: "medium" } : null;
  },
  (c, s) => {
    const w = s.website; if (!w.reachable || w.ctas.length > 0) return null;
    return { problemKey: "weak_cta", title: "Sin llamadas a la acción claras", problem: "No se detectaron botones o enlaces de acción (reservar, pedir presupuesto, llamar).",
      evidence: [ev("Ningún enlace/botón con verbos de acción comerciales en las páginas analizadas.", "website", w.url), ev(`H1: ${w.h1[0] ?? "no encontrado"}.`, "website", w.url)],
      consequence: "El visitante no sabe cuál es el siguiente paso y abandona.", solution: "Rediseñar la portada con una acción principal visible y un camino a la conversión.", service: "Optimización web y conversión",
      impact: "Más contactos por visita.", impactLevel: "medium", severity: 3, confidence: w.jsHeavy ? "low" : "medium" };
  },
  (c, s) => {
    const w = s.website; if (!w.reachable || w.trackers.length > 0) return null;
    return { problemKey: "no_tracking", title: "Sin analítica ni píxeles de seguimiento", problem: "No se detectó Google Analytics, Tag Manager ni píxeles de anuncios.",
      evidence: [ev("No hay scripts de analítica ni de píxeles en el HTML analizado.", "website", w.url)], consequence: "No se puede saber de dónde vienen los contactos ni invertir en anuncios con retargeting.",
      solution: "Instalar GA4/GTM y eventos de conversión (formulario, WhatsApp, llamada).", service: "Analítica y seguimiento de conversiones", impact: "Decisiones de marketing basadas en datos.", impactLevel: "medium", severity: 2, confidence: "medium" };
  },
  (c, s) => {
    const w = s.website; if (!w.reachable || w.forms.length === 0 || w.marketingStack.length > 0) return null;
    return { problemKey: "no_crm_followup", title: "Sin CRM ni seguimiento automatizado visible", problem: "Hay formularios, pero no se detecta CRM ni herramienta de email marketing conectados.",
      evidence: [ev(`${w.forms.length} formulario(s) detectado(s) y ningún script de CRM/email marketing (HubSpot, Mailchimp, Brevo, etc.).`, "website", w.url)],
      consequence: "Posible falta de seguimiento a leads y de recuperación de contactos antiguos. No verificable desde fuera: el CRM puede ser interno.", solution: "CRM ligero con secuencias de seguimiento y reactivación de contactos.", service: "CRM y automatización de seguimiento",
      impact: "Más conversiones desde leads ya captados.", impactLevel: "medium", severity: 3, confidence: "low" };
  },
  (c, s) => {
    const r = s.reputation; if (r.level !== "weak" || r.rating == null) return null;
    const lowRating = r.rating < 4.0;
    return { problemKey: lowRating ? "weak_reputation" : "few_reviews", title: lowRating ? "Valoración baja en reseñas" : "Pocas reseñas online", problem: lowRating ? "La valoración media está por debajo de 4,0." : "El volumen de reseñas es bajo para generar confianza.",
      evidence: [ev(r.note, "discovery")], consequence: "La reputación en buscadores y mapas es el principal criterio de decisión en negocios locales.",
      solution: "Flujo automatizado de solicitud de reseñas tras cada servicio y gestión de respuestas.", service: "Gestión de reputación y reseñas", impact: "Más reseñas y mejor posicionamiento local.", impactLevel: "medium", severity: lowRating ? 4 : 3, confidence: "high" };
  },
  (c, s) => {
    const w = s.website; if (!w.reachable) return null;
    const has = Object.keys(w.socials).length;
    if (has > 0 || Object.keys(c.socials ?? {}).length > 0) return null;
    return { problemKey: "no_socials", title: "Sin redes sociales enlazadas", problem: "La web no enlaza ninguna red social y la ficha no registra perfiles.",
      evidence: [ev("No hay enlaces a Instagram, Facebook, LinkedIn, TikTok o YouTube.", "website", w.url)], consequence: "Menos prueba social y ningún canal de contenido para reactivar clientes.", solution: "Crear/enlazar perfiles y automatizar publicaciones y respuestas.", service: "Presencia digital",
      impact: "Más alcance y prueba social.", impactLevel: "low", severity: 1, confidence: "medium" };
  },
];

export function detectRules(c: Company, s: AnalysisSignals): OpportunityDraft[] {
  return rules.map((r) => r(c, s)).filter((d): d is OpportunityDraft => d !== null);
}

/** Verifica que la señal citada por el LLM existe de verdad en lo observado. */
function signalValue(s: AnalysisSignals, key: string): unknown {
  const top = key.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), { website: s.website, pagespeed: s.pagespeed, reputation: s.reputation });
  return top;
}

export const opportunityDetector: OpportunityDetector = {
  async detect(company: Company, analysis: WebsiteAnalysis): Promise<OpportunityDraft[]> {
    const s = analysis.signals as unknown as AnalysisSignals;
    if (!s?.website) return [];
    const drafts = detectRules(company, s);
    for (const x of s.llm?.extraOpportunities ?? []) {
      const verified = x.evidenceKeys.map((k) => [k, signalValue(s, k)] as const).filter(([, v]) => v !== undefined && v !== null);
      if (verified.length === 0) continue; // sin evidencia real, no se acepta
      drafts.push({
        problemKey: `llm_${x.title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").slice(0, 40)}`,
        title: x.title, problem: x.problem, consequence: x.consequence, solution: x.solution, service: x.service || "Automatización",
        impact: x.impact, impactLevel: "medium", severity: 2, confidence: "low",
        evidence: verified.map(([k, v]) => ev(`${k} = ${JSON.stringify(v).slice(0, 160)}`, "website")),
      });
    }
    const seen = new Set<string>();
    return drafts.filter((d) => !seen.has(d.problemKey) && seen.add(d.problemKey));
  },
};
