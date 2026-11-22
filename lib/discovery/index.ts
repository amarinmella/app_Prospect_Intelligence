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
  return { provider, companies: await provider.discover(q) };
}
