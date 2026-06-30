// ============================================================
// Types TypeScript — Pegasus
// Reflète le schéma Supabase (tables: horses, genealogy,
// health_events). Adapter les noms si besoin.
// ============================================================

export interface Horse {
  id: string
  name: string
  color_hex: string | null
  is_active: boolean
  sire_name: string | null       // Nom du père SIRE (texte)
  sire_number: string | null     // Numéro SIRE officiel
  ueln: string | null            // Universal Equine Life Number
  race: string | null            // Race / breed
  robe: string | null            // Couleur de robe
  born_at: string | null         // ISO date string
  photo_url: string | null       // URL Supabase Storage
  ifce_url: string | null        // Lien vers la fiche IFCE
  created_at: string
}

export interface Genealogy {
  id: string
  horse_id: string
  pere_name: string | null       // Nom du père (texte libre)
  mere_name: string | null       // Nom de la mère (texte libre)
  pere_id: string | null         // FK vers horses (optionnel)
  mere_id: string | null         // FK vers horses (optionnel)
  pdm_name: string | null
}

export interface HealthEvent {
  id: string
  horse_id: string
  pathology_id: string | null
  opened_at: string              // ISO timestamp — horodatage terrain éditable
  occurred_at: string | null
  closed_at: string | null
  type: 'veterinaire' | 'marechal' | 'dentiste' | 'osteo' | 'groom' | 'autre' | null
  location: string | null
  laterality: string | null
  severity: number               // 1 à 5 étoiles
  severity_max: number | null
  status: 'open' | 'active' | 'closed'
  note: string | null
  photo_url: string | null
  attachment_urls: string[] | null
  photo_urls: string[] | null    // URLs signées Supabase Storage (bucket bobo-photos)
  created_at: string
  updated_at: string
}

export interface HealthEventVisit {
  id: string
  health_event_id: string
  visited_at: string
  status: 'open' | 'active' | 'closed'
  severity: number
  note: string | null
  photo_urls: string[] | null    // URLs signées Supabase Storage (bucket bobo-photos)
  created_at: string
}

export interface FarmAlert {
  key: string
  active: boolean
  updated_at: string
}

export interface Pathology {
  id: string
  category: string
  cat_letter: string | null
  name: string
  variants: string[] | null
  location: string | null
  has_laterality: boolean
  default_severity: number | null
  is_urgent: boolean
  definition: string | null
  signs: string | null
  conduct: string | null
  prevention: string | null
  source_name: string | null
  source_url: string | null
  freq_score: number | null
  created_at: string
}

// Ordre canonique des chevaux actifs (codé en dur, côté frontend)
export const CANONICAL_ORDER = [
  'Échalote',
  'Hakéa',
  'Romarin',
  'Cerise',
  'Fraise',
  'Pistache',
  'Pamplemousse',
] as const

// Couleurs officielles de la charte par cheval
export const HORSE_COLORS: Record<string, string> = {
  'Échalote':     '#C0392B',
  'Hakéa':        '#27AE60',
  'Romarin':      '#1A1A1A',
  'Cerise':       '#8B1A2A',
  'Fraise':       '#1A3A6B',
  'Pistache':     '#82C341',
  'Pamplemousse': '#E88080',
}

// Utilitaire : un bobo est actif si status != 'closed'
export function isBobosActif(events: HealthEvent[]): boolean {
  return events.some(e => e.status !== 'closed')
}

// Utilitaire : formater une date ISO en format lisible FR
export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// Utilitaire : formater un timestamp en date + heure FR
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
