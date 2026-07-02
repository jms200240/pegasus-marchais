import { useState } from 'react'
import { X, ChevronDown, ChevronUp, Syringe } from 'lucide-react'

interface FicheTableRow {
  label: string
  value: string
}

interface VaccinFicheData {
  key: string
  nom: string
  sousTitre: string
  badge: string
  maladie: string
  signes: string
  obligationTable: FicheTableRow[]
  primoVaccination: string[]
  rappels: string[]
  regleRappelTable: FicheTableRow[]
  sources: string[]
}

// ─── Contenu source : Pegasus_Fiches_Vaccins.docx (version du 01/07/2026) ────
// Protocoles IFCE Équipédia + sources vétérinaires citées en fin de fiche.
// Les tables "Règle de rappel Pegasus" correspondent aux valeurs cadence/
// alertWindow/tolerance déjà codées dans VACCINES (VaccineReminders.tsx).
const FICHES: VaccinFicheData[] = [
  {
    key: 'grippe',
    nom: 'Grippe équine (Influenza)',
    sousTitre: 'Virus Influenza A, sous-type H3N8 — maladie respiratoire très contagieuse',
    badge: 'Obligatoire en compétition · Recommandé sinon',
    maladie:
      "Maladie virale très contagieuse transmise par voie respiratoire (toux). Non mortelle chez l'adulte sain mais immobilise le cheval 2 à 4 semaines et peut être fatale chez le poulain.",
    signes: 'Signes : fièvre brutale, toux sèche, jetage nasal, abattement. Incubation 2 à 5 jours.',
    obligationTable: [
      { label: 'Usage courant (hors compétition)', value: "Non obligatoire, fortement recommandée (risque épidémique élevé en collectivité)." },
      { label: 'Compétition FFE', value: 'Obligatoire (Club/Amateur/Pro — extension "Amateur" au 01/01/2026).' },
      { label: 'Compétition FEI / export', value: 'Obligatoire, schéma spécifique FEI.' },
      { label: 'Reproducteurs', value: 'Obligatoire selon règlement du stud-book concerné.' },
    ],
    primoVaccination: [
      "V1 : dès l'âge de 6 mois (4 mois si la mère n'est pas vaccinée).",
      'V2 : 21 à 92 jours après V1 (4 à 6 semaines en usage courant).',
      "V3 (rappel de primo) : 5 à 6 mois après V2 — non obligatoire si la primo-vaccination a été réalisée avant 2013 sans rupture vaccinale ultérieure.",
    ],
    rappels: [
      'Rappel au maximum tous les 12 mois (annuel), idéalement tous les 6 mois pour les jeunes chevaux ou chevaux très exposés (déplacements, concours).',
      'Dernière injection au moins 7 jours avant une compétition FFE (21 jours + 6 mois avant une compétition FEI).',
      'Jument gestante : rappel 4 à 6 semaines avant le poulinage.',
    ],
    regleRappelTable: [
      { label: 'Cadence de rappel', value: 'Tous les 365 jours depuis la dernière injection' },
      { label: 'Alerte « à prévoir »', value: 'J-60 avant échéance' },
      { label: 'Statut « en retard »', value: 'Échéance dépassée (J+0 à J+180)' },
      { label: 'Statut « primo à refaire »', value: 'Retard > 180 jours après échéance (protocole considéré rompu)' },
    ],
    sources: [
      'IFCE Équipédia — La réglementation vaccinale en France — consulté le 01/07/2026',
      'Clinique vétérinaire des Arcis — La grippe équine — consulté le 01/07/2026',
      'Vetostore — Vaccins du cheval : quand et pourquoi vacciner — consulté le 01/07/2026',
    ],
  },
  {
    key: 'tetanos',
    nom: 'Tétanos',
    sousTitre: 'Toxine de Clostridium tetani — maladie non contagieuse, mortelle',
    badge: 'Non obligatoire · Vivement recommandé',
    maladie:
      "Maladie due aux neurotoxines d'une bactérie tellurique très résistante (spores survivant plusieurs dizaines d'années). Contamination par plaie profonde, y compris le cordon ombilical du nouveau-né. Non contagieuse d'un cheval à l'autre, mais mortelle en l'absence de traitement.",
    signes: "Signes : raideur de la marche, difficultés à s'alimenter, spasmes musculaires violents.",
    obligationTable: [
      { label: 'Réglementation', value: 'Non obligatoire — maladie non contagieuse, donc pas de risque collectif imposant une obligation.' },
      { label: 'Recommandation IFCE', value: 'Vivement conseillée du fait de la gravité (quasi systématique en écurie).' },
      { label: 'Assurance', value: "Peut être exigée dans certains contrats d'assurance mortalité/frais vétérinaires." },
    ],
    primoVaccination: [
      "2 injections à 1 mois d'intervalle, généralement couplées au vaccin grippe (vaccin combiné type Prequenza-TE / Proteqflu-Te).",
      "Primo-vaccination possible dès l'âge de 6 mois (2 mois si la mère n'est pas vaccinée, avec reprise du protocole complet après 6 mois).",
    ],
    rappels: [
      'Si couplé au vaccin grippe (cas le plus fréquent aux Marchais) : rappel annuel, aligné sur le rythme de la grippe.',
      'Si vacciné seul (tétanos non couplé) : rappel à 1 an puis tous les 2 à 3 ans selon le vaccin utilisé (immunité individuelle plus durable, pas d\'enjeu épidémique).',
    ],
    regleRappelTable: [
      { label: 'Cadence de rappel', value: '365 jours (alignée sur la grippe, vaccins toujours co-administrés dans l\'historique Les Marchais)' },
      { label: 'Alerte « à prévoir »', value: 'J-60 avant échéance' },
      { label: 'Statut « en retard »', value: 'Échéance dépassée (J+0 à J+180)' },
      { label: 'Statut « primo à refaire »', value: 'Retard > 180 jours (à réévaluer avec le vétérinaire, immunité tétanos plus rémanente que la grippe)' },
    ],
    sources: [
      'IFCE Équipédia — Vaccination : principes et bonnes pratiques — consulté le 01/07/2026',
      'Vetostore — Vaccins du cheval : quand et pourquoi vacciner — consulté le 01/07/2026',
      'Classequine — Vaccins obligatoires et facultatifs — consulté le 01/07/2026',
    ],
  },
  {
    key: 'rhino',
    nom: 'Rhinopneumonie (Herpèsvirose équine HVE-1 / HVE-4)',
    sousTitre: 'Herpèsvirus équin de type 1 et 4 — formes respiratoire, abortive, nerveuse',
    badge: 'Obligatoire en compétition · Recommandé sinon',
    maladie:
      '60 à 70 % des chevaux sont porteurs latents. Trois formes cliniques : respiratoire (jeunes chevaux), abortive (avortement tardif chez la jument gestante, 6e-11e mois), nerveuse (paralysie du train postérieur).',
    signes: 'Le virus résiste plusieurs jours dans le milieu extérieur mais est sensible aux désinfectants usuels.',
    obligationTable: [
      { label: 'Usage courant', value: 'Non obligatoire, recommandée (forte contagiosité, formes graves possibles).' },
      { label: 'Compétition FFE / FEI', value: 'Obligatoire depuis le 01/01/2022, schéma renforcé.' },
      { label: 'Poulinières', value: 'Obligatoire : protocole abortif spécifique.' },
    ],
    primoVaccination: [
      "2 injections à 1 mois d'intervalle.",
      'Primo-vaccination réalisée avant le 01/01/2022 : 2 injections suffisantes.',
      'Primo-vaccination depuis le 01/01/2022 (chevaux de compétition) : schéma renforcé à 3 injections, proche du protocole grippe.',
      "Poulinières : 2 injections à 1 mois d'intervalle avant la saillie, puis injections aux 5e, 7e et 9e mois de gestation (protocole abortif).",
    ],
    rappels: [
      'Rappel tous les 6 mois (recommandé), sans dépasser 12 mois.',
      'Particulièrement important pour les jeunes chevaux jusqu\'à 5 ans et les chevaux très exposés (déplacements, mélange d\'effectifs).',
    ],
    regleRappelTable: [
      { label: 'Cadence de rappel', value: '180 jours depuis la dernière injection' },
      { label: 'Alerte « à prévoir »', value: 'J-30 avant échéance' },
      { label: 'Statut « en retard »', value: 'Échéance dépassée (J+0 à J+180)' },
      { label: 'Statut « primo à refaire »', value: 'Retard > 180 jours après échéance (soit plus de 360 j depuis la dernière injection)' },
    ],
    sources: [
      'IFCE Équipédia — La réglementation vaccinale en France — consulté le 01/07/2026',
      'Groupe Santépourtous — Vaccins du cheval : principes et protocole — consulté le 01/07/2026',
      'HorseLab — Vaccins obligatoires pour mon cheval — consulté le 01/07/2026',
    ],
  },
  {
    key: 'rage',
    nom: 'Rage',
    sousTitre: 'Rhabdovirus — maladie mortelle, transmission par morsure/griffure',
    badge: 'Non obligatoire en France · Obligatoire export / concours internationaux',
    maladie:
      "La France métropolitaine est indemne de rage sur la faune sauvage ; la vaccination n'est plus obligatoire depuis 2003. Elle reste toutefois nécessaire pour l'export hors Union Européenne et certains concours internationaux (règlement FEI, pays tiers).",
    signes:
      'Symptômes : inquiétude, hypersensibilité, tremblements, accès de fureur, puis paralysie et mort (phase terminale 3 à 6 jours après les premiers signes). Aucun traitement curatif.',
    obligationTable: [
      { label: 'France métropolitaine', value: 'Non obligatoire (faune sauvage indemne depuis 2003).' },
      { label: 'Export hors UE', value: 'Obligatoire selon pays de destination.' },
      { label: 'Concours internationaux (FEI, certains pays)', value: "Peut être exigée selon le règlement de l'épreuve." },
    ],
    primoVaccination: [
      "1 injection à partir de l'âge de 6 mois.",
      "2 injections à 1 mois d'intervalle si le cheval est vacciné plus jeune que 6 mois.",
    ],
    rappels: [
      'Rappel annuel dans la majorité des protocoles vétérinaires.',
      "Certains vaccins (selon leur AMM) autorisent un espacement triennal après le premier rappel — à valider avec le vétérinaire traitant selon le produit utilisé.",
    ],
    regleRappelTable: [
      { label: 'Cadence de rappel', value: 'Tous les 365 jours depuis la dernière injection (si le cheval a un historique Rage)' },
      { label: 'Alerte « à prévoir »', value: 'J-60 avant échéance' },
      { label: 'Statut « en retard »', value: 'Échéance dépassée (J+0 à J+180)' },
      { label: 'Statut par défaut', value: '« Non suivi » si le cheval n\'a jamais été vacciné Rage — pas d\'alerte tant qu\'aucun projet d\'export / concours international n\'est prévu' },
    ],
    sources: [
      'Equirider — Vaccin cheval : calendrier, rappels FFE et FEI 2026 — consulté le 01/07/2026',
      'Classequine — Vaccins obligatoires et facultatifs — consulté le 01/07/2026',
      'Vetostore — Vaccins du cheval : quand et pourquoi vacciner — consulté le 01/07/2026',
    ],
  },
]

interface FicheTableProps {
  rows: FicheTableRow[]
  accent?: boolean
}

function FicheTable({ rows, accent = false }: FicheTableProps) {
  return (
    <div className={`rounded-lg overflow-hidden border ${accent ? 'border-green-200' : 'border-gray-200'}`}>
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={`flex flex-col gap-0.5 px-3 py-2 ${i > 0 ? 'border-t' : ''} ${accent ? 'border-green-200' : 'border-gray-100'}`}
          style={{ backgroundColor: accent ? '#f0fbf4' : i % 2 === 0 ? '#fafafa' : 'white' }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: accent ? '#2f6b3f' : '#6b7280' }}>
            {row.label}
          </span>
          <span className="text-xs text-gray-700">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-xs text-gray-700">
          <span className="text-gray-300 flex-shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

interface VaccinFicheCardProps {
  fiche: VaccinFicheData
  isOpen: boolean
  onToggle: () => void
}

function VaccinFicheCard({ fiche, isOpen, onToggle }: VaccinFicheCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left cursor-pointer hover:bg-gray-50/70 transition-colors"
      >
        <Syringe className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{fiche.nom}</p>
          <p className="text-[11px] text-gray-400 truncate">{fiche.sousTitre}</p>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-4">
          <span
            className="inline-block text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: '#f0fbf4', color: '#2f6b3f' }}
          >
            {fiche.badge}
          </span>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Maladie</p>
            <p className="text-xs text-gray-700 leading-relaxed">{fiche.maladie}</p>
            {fiche.signes && <p className="text-xs text-gray-700 leading-relaxed mt-1.5">{fiche.signes}</p>}
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Caractère obligatoire / recommandé</p>
            <FicheTable rows={fiche.obligationTable} />
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Primo-vaccination</p>
            <BulletList items={fiche.primoVaccination} />
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Rappels</p>
            <BulletList items={fiche.rappels} />
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Règle de rappel Pegasus</p>
            <FicheTable rows={fiche.regleRappelTable} accent />
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Sources</p>
            <ul className="space-y-1">
              {fiche.sources.map((s, i) => (
                <li key={i} className="text-[10px] text-gray-400">[{i + 1}] {s}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

interface VaccinFichesProps {
  onClose: () => void
}

export default function VaccinFiches({ onClose }: VaccinFichesProps) {
  const [openKey, setOpenKey] = useState<string | null>(FICHES[0].key)

  return (
    <div className="fixed inset-0 z-[70] flex justify-center bg-black/40">
      <div className="w-full max-w-[390px] bg-[#F6F2EC] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-gray-200/60 bg-white/70 backdrop-blur-sm">
          <div>
            <h2 className="text-base font-black text-gray-900">Fiches Vaccins</h2>
            <p className="text-[10px] text-gray-400">Grippe · Tétanos · Rhinopneumonie · Rage</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto no-scrollbar px-4 pt-4 space-y-2.5"
          style={{ paddingBottom: 'calc(1rem + 64px + env(safe-area-inset-bottom))' }}
        >
          {FICHES.map(fiche => (
            <VaccinFicheCard
              key={fiche.key}
              fiche={fiche}
              isOpen={openKey === fiche.key}
              onToggle={() => setOpenKey(openKey === fiche.key ? null : fiche.key)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
