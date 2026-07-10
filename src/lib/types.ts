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
  sex: 'F' | 'M' | null
  race: string | null            // Race / breed
  robe: string | null            // Couleur de robe
  born_at: string | null         // ISO date string
  died_at: string | null
  naisseur: string | null
  adresse_elevage: string | null
  photo_url: string | null       // URL Supabase Storage
  ifce_url: string | null        // Lien vers la fiche IFCE
  created_at: string
  updated_at: string
}

export interface Genealogy {
  id: string
  horse_id: string
  generation: number | null
  pere_name: string | null       // Nom du père (texte libre)
  mere_name: string | null       // Nom de la mère (texte libre)
  pdm_name: string | null        // Nom du père de mère (texte libre)
  pere_id: string | null         // FK vers horses (optionnel — si l'ancêtre est aussi dans notre cavalerie)
  mere_id: string | null         // FK vers horses (optionnel)
  pdm_id: string | null          // FK vers horses (optionnel)
  pere_url: string | null        // Lien IFCE du père, si pere_id résolu
  mere_url: string | null        // Lien IFCE de la mère, si mere_id résolu
  pdm_url: string | null         // Lien IFCE du père de mère, si pdm_id résolu
  created_at: string
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
  source: string | null          // qui a enregistré l'entrée : Famille / Groom / Veterinaire, etc.
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

export interface AmbiancePhoto {
  id: string
  visited_at: string
  photo_url: string
  storage_path: string | null
  thumbnail_url: string | null   // miniature compressée (grille galerie) ; null = pas encore générée
  created_at: string
}

export interface PhotoTag {
  id: string
  photo_id: string
  tag_type: 'horse' | 'human'
  label: string
  horse_id: string | null
  user_id: string | null
  created_at: string
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

export interface SoinReminder {
  id: string
  created_at: string
  visited_at: string             // horodatage du soin
  soin: string                   // texte libre décrivant le soin
  horse_ids: string[]            // chevaux concernés
  comment: string | null
  veterinarian: string | null
  reminder_date: string          // yyyy-mm-dd — date cible du rappel
  reminder_text: string          // texte du rappel
}

export interface Vaccination {
  id: string
  horse_id: string
  vaccine_type: 'grippe' | 'tetanos' | 'rhino' | 'rage'
  injection_date: string         // yyyy-mm-dd
  location: string | null
  veterinarian: string | null
  created_at: string
}

export interface Veterinaire {
  id: string
  rang: number
  nom: string
  photo_url: string | null
  created_at: string
}

export interface Marechal {
  id: string
  rang: number
  nom: string
  photo_url: string | null
  created_at: string
}

export interface Osteopathe {
  id: string
  rang: number
  nom: string
  photo_url: string | null
  created_at: string
}

export interface Dentiste {
  id: string
  rang: number
  nom: string
  photo_url: string | null
  created_at: string
}

// Schema créé en amont (Sprint 5), pas encore de code applicatif dessus.
// Colonnes confirmées via PostgREST ; nullabilité et valeurs d'enum réelles
// (status, ocr_status, intervenant_type) non vérifiées — à confirmer avant usage.
export interface Invoice {
  id: string
  invoice_date: string
  intervenant_type: string | null
  total_ttc: number
  photo_url: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceStaging {
  id: string
  invoice_id: string | null
  raw_json: unknown
  lines_json: unknown
  ocr_status: string | null
  created_at: string
}

export interface Expense {
  id: string
  horse_id: string | null
  expense_date: string
  intervenant_type: string | null
  amount_ttc: number
  invoice_id: string | null
  note: string | null
  created_at: string
}

export interface GroomVisit {
  id: string
  user_id: string
  visit_date: string              // date-only (YYYY-MM-DD)
  amount_ttc: number              // défaut base 7.00 €
  paid_month: string              // '' tant que non réglé, sinon "YYYY-MM" du mois soldé
  is_paid: boolean
  paid_at: string | null
  notes: string | null
  created_at: string
}

export type QuizAnswer = 'A' | 'B' | 'C' | 'D'
export type QuizNiveau = 'Facile' | 'Difficile'

export interface QuizQuestion {
  id: string
  external_id: number | null
  question: string
  reponse_a: string
  reponse_b: string
  reponse_c: string
  reponse_d: string
  bonne_reponse: QuizAnswer
  niveau: QuizNiveau | null      // null pour les lots "Galop" (culture générale équestre)
  galop: number | null          // 1 à 7 — niveau Galop FFE, alternative à `niveau` selon le lot
  points: number
  categorie: string             // 'Maladies' | 'Parasites' | 'Vaccins' | 'Généalogie' | 'Robes' | ... (ouvert)
  thematique: string | null
  lot: string | null             // libellé du lot d'origine (traçabilité import)
  // Polymorphe selon categorie : uuid pathologies.id (Maladies/Parasites),
  // nom de vaccin en texte libre (Vaccins), ou slug nom de cheval (Généalogie).
  // Absent (null) pour les lots sans ressource associée (ex. culture générale Galop).
  source_id: string | null
  is_active: boolean
  reported: boolean             // signalée comme mal posée — exclue de la rotation tant que non corrigée
  created_at: string
}

export interface QuizAttempt {
  id: string
  user_id: string
  question_id: string
  chosen_reponse: QuizAnswer
  is_correct: boolean
  points_earned: number
  answered_at: string
}

// Retour de la fonction RPC admin_list_users() — réservée au rôle admin
export interface AdminUser {
  id: string
  email: string
  name: string | null
  role: 'famille' | 'groom' | 'visiteur' | 'admin'
  created_at: string
  banned: boolean
  last_sign_in_at: string | null
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
