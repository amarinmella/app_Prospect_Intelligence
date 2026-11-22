import { NotConfiguredError } from "../errors";
import { discoveryProviders } from "./providers";
import type { DiscoveredCompany, DiscoveryProvider, DiscoveryQuery } from "./types";

export type { DiscoveredCompany, DiscoveryProvider, DiscoveryQuery } from "./types";

export function listDiscoveryProviders(): DiscoveryProvider[] {
  return discoveryProviders;
}

export function activeDiscoveryProvider(): DiscoveryProvider | null {
  return discoveryProviders.find((p) => p.isConfigured()) ?? null;
}

export async function discover(q: DiscoveryQuery): Promise<{ provider: DiscoveryProvider; companies: DiscoveredCompany[] }> {
  const provider = activeDiscoveryProvider();
  if (!provider) {
    const env = discoveryProviders.flatMap((p) => p.requiredEnv);
    throw new NotConfiguredError(
      "Descubrimiento de empresas",
      env,
      discoveryProviders.length
        ? `Ningún proveedor de descubrimiento está configurado. Falta alguna de: ${env.join(", ")}`
        : "Todavía no hay ningún proveedor de descubrimiento registrado (lib/discovery/providers.ts).",
    );
  }
  // Si el proveedor principal falla (cuota, red, clave inválida), se intenta el siguiente configurado.
  const candidates = discoveryProviders.filter((p) => p.isConfigured());
  let lastError: unknown;
  for (const p of candidates) {
    try {
      return { provider: p, companies: await p.discover(q) };
    } catch (e) {
      lastError = e;
      console.warn(`[discovery] ${p.id} falló, probando siguiente proveedor:`, e instanceof Error ? e.message : e);
    }
  }
  throw lastError ?? new Error("Sin proveedores disponibles");
}
