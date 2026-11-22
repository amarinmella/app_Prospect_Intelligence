import type { Socials } from "../types";

/**
 * CONTRATO · Descubrimiento de empresas.
 * Cada proveedor (Google Places, Outscraper, Foursquare, OSM, Apollo...) implementa DiscoveryProvider
 * y se registra en lib/discovery/providers.ts. Solo devuelve datos REALES de la fuente; nunca inventa.
 */
export interface DiscoveryQuery {
  niche: string;       // "clínicas dentales"
  location: string;    // "Santiago, Chile"
  limit: number;       // máximo de empresas a devolver
}

export interface DiscoveredCompany {
  /** id en la fuente (place_id, etc.) para deduplicar y trazar */
  externalId: string;
  name: string;
  category?: string;
  website?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  email?: string;
  rating?: number;
  reviewCount?: number;
  openingHours?: unknown;
  socials?: Socials;
  description?: string;
  sizeHint?: string;
  /** respuesta cruda de la fuente, se guarda en company_sources.raw */
  raw?: unknown;
  sourceUrl?: string;
}

export interface DiscoveryProvider {
  id: string;                 // 'google_places'
  label: string;
  /** variables de entorno requeridas, para mostrarlas en Configuración */
  requiredEnv: string[];
  isConfigured(): boolean;
  discover(query: DiscoveryQuery): Promise<DiscoveredCompany[]>;
}
