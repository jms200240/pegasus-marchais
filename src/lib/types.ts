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
  title: string
  note: string | null
  severity: number               // 1 à 5 étoiles
  status: 'open' | 'active' | 'closed'
  opened_at: string
