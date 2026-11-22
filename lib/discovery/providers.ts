import type { DiscoveryProvider } from "./types";

/**
 * REGISTRO de proveedores de descubrimiento. El hilo de descubrimiento añade aquí sus
 * implementaciones (un archivo por proveedor en lib/discovery/<id>.ts). El primero configurado se usa.
 */
export const discoveryProviders: DiscoveryProvider[] = [];
