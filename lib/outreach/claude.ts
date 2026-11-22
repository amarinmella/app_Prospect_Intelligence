import Anthropic from "@anthropic-ai/sdk";
import { NotConfiguredError } from "../errors";

/** Modelo por defecto; se puede sobrescribir con ANTHROPIC_MODEL. */
export const OUTREACH_MODEL = "claude-sonnet-5-5";

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export class ModelRefusalError extends Error {
  constructor() { super("El modelo declinó generar este contenido. Revisa los datos de la empresa o inténtalo de nuevo."); this.name = "ModelRefusalError"; }
}

/** Llama a Claude pidiendo JSON con esquema; devuelve el objeto parseado. Sin clave lanza NotConfiguredError. */
export async function claudeJson<T>(opts: {
  system: string; user: string; schema: Record<string, unknown>; maxTokens?: number;
}): Promise<{ data: T; model: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new NotConfiguredError("Anthropic (Claude)", ["ANTHROPIC_API_KEY"],
    "Falta ANTHROPIC_API_KEY: añádela en las variables de entorno para generar este contenido con Claude.");
  const client = new Anthropic({ apiKey, timeout: 90_000 });
  const model = process.env.ANTHROPIC_MODEL || OUTREACH_MODEL;
  const res = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: opts.schema } },
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  if (res.stop_reason === "refusal") throw new ModelRefusalError();
  if (res.stop_reason === "max_tokens") throw new Error("La respuesta del modelo se cortó (max_tokens).");
  const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  try { return { data: JSON.parse(text) as T, model: res.model ?? model }; }
  catch { throw new Error("La respuesta del modelo no es JSON válido."); }
}
