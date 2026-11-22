/** La integración existe pero falta una credencial / variable de entorno. Se comunica como bloqueo, no como fallo. */
export class NotConfiguredError extends Error {
  constructor(public readonly integration: string, public readonly missingEnv: string[], message?: string) {
    super(message ?? `${integration} no está configurado. Falta: ${missingEnv.join(", ")}`);
    this.name = "NotConfiguredError";
  }
}

/** El módulo todavía no tiene implementación (contrato definido, trabajo pendiente). */
export class NotImplementedYetError extends Error {
  constructor(public readonly module: string) {
    super(`El módulo "${module}" aún no está implementado.`);
    this.name = "NotImplementedYetError";
  }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
