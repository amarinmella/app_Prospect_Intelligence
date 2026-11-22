import { googlePlaces } from "./google-places";
import { osm } from "./osm";
import type { DiscoveryProvider } from "./types";

/**
 * REGISTRO de proveedores de descubrimiento (un archivo por proveedor en lib/discovery/<id>.ts).
 * El primero configurado se usa: Google Places (datos completos) y, sin clave, OpenStreetMap.
 */
export const discoveryProviders: DiscoveryProvider[] = [googlePlaces, osm];
