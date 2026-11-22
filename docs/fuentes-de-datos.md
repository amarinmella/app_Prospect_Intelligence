# Fuentes de datos para Prospect Intelligence

Fecha de revisión: 2026-11-22. Precios y límites tomados de las páginas oficiales indicadas al final; los puntos marcados **(verificar)** no pudieron confirmarse en la fuente primaria. Los precios cambian: revisar antes de contratar.

## Recomendación para el MVP

Combinación de tres fuentes, todas operables por una sola persona:

1. **Descubrimiento y datos base: Google Places API (New)**. Es la única fuente que entrega, en una sola llamada, nombre, web, teléfono, dirección, categoría, valoración, número de reseñas y horarios con cobertura buena en Madrid y en ciudades chilenas.
2. **Análisis del sitio web: scraper propio** (fetch del HTML en un worker/Edge Function) más **PageSpeed Insights API**. Entrega email, WhatsApp, redes, formularios, sistemas de reserva, chat y CTAs, que Google no da.
3. **Respaldo sin clave: Overpass/OpenStreetMap**, para que la app funcione desde el primer día sin ninguna credencial, con datos más pobres.

Se deja **Hunter** como enriquecimiento opcional de la fase 2 y **Outscraper** como alternativa si el costo o los términos de Google se vuelven un problema.

### Costo estimado con Google Places
Un perfil completo (web, teléfono, rating, horarios) exige campos Enterprise. Con Text Search, el campo `websiteUri`, teléfono, `rating`/`userRatingCount` y horarios disparan el SKU **Text Search Enterprise: 1.000 solicitudes gratis al mes y luego US$35 por 1.000**. Cada solicitud devuelve hasta 20 negocios, así que 1.000 solicitudes cubren hasta ~20.000 fichas. Buscar 60 clínicas dentales en Madrid son 3 solicitudes. El costo real del MVP, con uso personal, tiende a cero dentro de la capa gratuita.

Reseñas de texto (`reviews`) suben el SKU a **Enterprise + Atmosphere** (1.000 gratis, US$40 por 1.000). Recomendación: no pedirlas en la búsqueda masiva; pedirlas con Place Details solo para empresas priorizadas, en el análisis profundo.

Regla de la API: si la máscara de campos mezcla SKUs, se cobra el más alto. Hay que pasar siempre una máscara de campos explícita (es obligatoria).

## Comparación de fuentes

| Fuente | Entrega | Costo y capa gratuita | Límites | Términos y legalidad | Facilidad |
|---|---|---|---|---|---|
| **Google Places API (New)** | Nombre, dirección, coordenadas, categoría, web, teléfono, rating, nº de reseñas, horarios, reseñas (textos), fotos. No entrega email ni redes sociales | Text Search Pro: 5.000 gratis, US$32/1.000. Enterprise: 1.000 gratis, US$35/1.000. Enterprise+Atmosphere: 1.000 gratis, US$40/1.000. Place Details Enterprise: 1.000 gratis, US$20/1.000 | Máx. 60 resultados por búsqueda (20 por página, paginación con `nextPageToken`). Requiere cuenta de facturación | API oficial, uso permitido. Restricciones de caché: ver "Riesgos" | Alta: una clave, REST, JSON |
| **Overpass / OpenStreetMap** | Nombre, dirección parcial, coordenadas, categoría (etiqueta `amenity=dentist`), a veces web, teléfono, horarios | Gratis | Instancia pública principal: máx. 10.000 consultas/día y 1 GB/día, pero para uso regular dividir por 100; sin paralelismo; User-Agent identificable; pausar 30 s ante 429. Indisponibilidad frecuente. No usar desde plataformas rápidas tipo lovable.app/netlify.app | Datos ODbL: atribución obligatoria y share-alike sobre la base derivada. Uso comercial intensivo debe ir a servidor propio o de pago | Media: lenguaje de consulta propio. Cobertura de contactos irregular, peor en Chile |
| **Nominatim (geocodificación)** | Convierte "Madrid" en coordenadas/bbox | Gratis | Máx. 1 solicitud/s, User-Agent propio, sin autocompletar, caché obligatoria, sin consultas sistemáticas | Atribución OSM | Alta; solo para geocodificar la ubicación del usuario. Alternativa: usar el propio Google Text Search con "dentistas en Madrid" |
| **SerpAPI / Outscraper (Google Maps)** | Lo mismo que Google Maps visible: web, teléfono, rating, reseñas, horarios, a veces email vía enriquecimiento | Outscraper: 500 negocios gratis cada 30 días, luego US$3/1.000 (US$1/1.000 sobre 100.000). Su scraper de emails/contactos por dominio: 500 dominios gratis, luego US$3/1.000. SerpAPI: **(verificar)** precios por búsqueda | Sin límite duro de 60 resultados | Scraping de terceros de Google Maps; los términos de Google lo prohíben, el riesgo recae en el proveedor y en ti como cliente | Muy alta, pero depende de un tercero |
| **Hunter** | Email por dominio (Domain Search), verificación | Gratis: 50 créditos/mes. Starter US$49/mes (US$34 anual) con 2.000 créditos; Growth US$149/mes con 10.000 **(verificar si el plan gratis incluye API)** | Créditos mensuales | Datos de contacto personales: aplica RGPD/LOPDGDD en España y Ley 19.628 en Chile | Alta, pero caro para el volumen. Los emails genéricos ya se obtienen del propio sitio |
| **Apollo** | Contactos B2B con cargo, LinkedIn | No se pudo verificar (el servidor MCP de Apollo no conectó en esta sesión) **(verificar)** | Créditos | Contactos personales: mismas reglas RGPD/Ley 19.628 | Orientado a empresas medianas/grandes; débil para negocios locales pequeños. No entra en el MVP |
| **Scraping del sitio web del negocio** | Email, teléfono, WhatsApp (`wa.me`), enlaces a redes, formularios, widgets de reserva y chat, CTAs, meta tags, tecnologías | Gratis (cómputo propio) | Respetar `robots.txt`, límite de ritmo, 1 sitio a la vez por dominio | Leer páginas públicas de un negocio es práctica habitual; respetar `robots.txt` y no recolectar datos de personas físicas más allá de contacto corporativo | Media: hay que manejar sitios JS, timeouts, SSRF |
| **PageSpeed Insights API** | Rendimiento móvil/escritorio, Core Web Vitals, accesibilidad, SEO básico, "mobile-friendly" | Gratis | Cuota por proyecto ~25.000 consultas/día; el límite por minuto/100 s varía según fuente **(verificar en Cloud Console)**. Una consulta tarda 10–40 s | API oficial de Google | Alta; con clave de API gratuita |

## Qué funciona sin ninguna clave

- Overpass/OSM: descubrimiento por categoría y área (sin garantía de teléfono/web).
- Nominatim: geocodificar la ubicación (con User-Agent propio y 1 solicitud/s).
- Scraping del sitio web propio de cada negocio.
- PageSpeed Insights: Google permite llamadas sin clave pero con cuota compartida muy baja **(verificar)**; con clave es estable y gratis.

Sin claves, el sistema encuentra negocios y analiza sus webs, pero sin rating, número de reseñas ni horarios fiables. La interfaz debe mostrar esos campos como "no disponible" y nunca rellenarlos.

## Variables de entorno

| Variable | Obligatoria | Para qué | Cómo obtenerla |
|---|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Sí, para datos completos | Places API (New) | Google Cloud Console: crear proyecto, activar facturación, habilitar "Places API (New)", crear clave en Credenciales y restringirla a esa API y a la IP del servidor. Poner un tope de presupuesto y alertas |
| `PAGESPEED_API_KEY` | Recomendada | PageSpeed Insights | Misma consola, habilitar "PageSpeed Insights API" y crear clave (puede ser la misma clave de Google, con ambas APIs permitidas) |
| `HUNTER_API_KEY` | No (fase 2) | Emails por dominio | hunter.io, panel de API |
| `OUTSCRAPER_API_KEY` | No (alternativa) | Google Maps vía tercero | outscraper.com, perfil, API tokens |
| `OSM_USER_AGENT` | Sí si se usa OSM | Identificar la app ante Overpass/Nominatim, ej. `ProspectIntelligence/1.0 (contacto@dominio.com)` | Definirla uno mismo con un correo de contacto real |
| `OVERPASS_URL` | No | Endpoint Overpass, por defecto `https://overpass-api.de/api/interpreter` | Opcional, apuntar a un servidor propio o de pago |

Estas claves van solo en el backend (Edge Function de Supabase o worker de n8n). Nunca en el navegador.

## Riesgos que el equipo debe conocer

1. **Persistencia frente a los términos de Google.** Los términos de la Plataforma de Google Maps restringen el almacenamiento prolongado del contenido de Places (en general solo `place_id` es almacenable sin límite; el resto, con límites de tiempo) **(verificar en las condiciones vigentes de Google Maps Platform)**. El proyecto exige persistir fichas y análisis. Mitigación propuesta: guardar siempre `place_id`, y guardar de forma duradera lo que es nuestro (análisis, puntuaciones, notas, CRM, mensajes) y lo obtenido del sitio web del propio negocio; tratar los campos de Google como caché con fecha de captura y refrescarlos. Si el usuario quiere conservar indefinidamente datos copiados de Google, la alternativa es otra fuente (por ejemplo, Outscraper) y esa decisión es de él.
2. **Contacto y privacidad.** Email y teléfono corporativos de empresas son datos B2B, pero en España el envío de correo comercial no solicitado está regulado (LSSI y RGPD/LOPDGDD) y en Chile aplica la Ley 19.628. La app prepara mensajes; el envío es manual y bajo responsabilidad del usuario. Recomendación: guardar la fuente de cada dato y permitir marcar "no contactar".
3. **Límite de 60 resultados por búsqueda** en Text Search. Para cubrir mercados grandes hay que dividir por barrios/zonas y consultas distintas, y deduplicar por `place_id`.
4. **Chile.** Google Places cubre bien Santiago y ciudades grandes; OSM tiene menos datos de contacto. No se identificó una fuente pública gratuita y confiable de teléfonos/webs de empresas en Chile; el SII entrega datos tributarios, no de contacto comercial **(verificar si se quiere usar)**.
5. **Directorios (Páginas Amarillas, Yelp, etc.)**: no se recomiendan; sus términos prohíben el scraping y no hay API gratuita útil.

## Orden de implementación sugerido

1. Conector Places Text Search con máscara de campos Enterprise, paginación y deduplicación por `place_id`; guardar fecha de captura.
2. Scraper del sitio web (email, WhatsApp, redes, formularios, reservas, chat) con protección SSRF, timeouts y respeto de `robots.txt`.
3. PageSpeed Insights en cola (una consulta tarda decenas de segundos).
4. Conector Overpass como modo sin clave.
5. Hunter/Outscraper solo si hace falta, detrás de una interfaz común de proveedores.

## Fuentes consultadas

- Google Maps Platform, precios: https://developers.google.com/maps/billing-and-pricing/pricing
- Places API (New), Text Search, Nearby Search y Place Details: https://developers.google.com/maps/documentation/places/web-service/text-search
- Hunter, precios: https://hunter.io/pricing
- Outscraper, precios: https://outscraper.com/pricing/
- Overpass API (wiki OSM): https://wiki.openstreetmap.org/wiki/Overpass_API
- Política de uso de Nominatim: https://operations.osmfoundation.org/policies/nominatim/
- Límites de PageSpeed Insights (fuente secundaria): https://unlighthouse.dev/learn-lighthouse/pagespeed-insights-api/rate-limits
