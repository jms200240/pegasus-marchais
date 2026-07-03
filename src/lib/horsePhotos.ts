import echalote from '../assets/chevaux/echalote.jpg'
import hakea from '../assets/chevaux/hakea.jpg'
import romarin from '../assets/chevaux/romarin.jpg'
import cerise from '../assets/chevaux/cerise.jpg'
import fraise from '../assets/chevaux/fraise.jpg'
import pistache from '../assets/chevaux/pistache.jpg'
import pamplemousse from '../assets/chevaux/pamplemousse.jpg'

// Photos statiques bundlées (cf. règle "Photos vétérinaires" étendue aux
// chevaux) — clé = nom canonique du cheval, pas de photo_url Supabase Storage.
export const HORSE_PHOTOS: Record<string, string> = {
  'Échalote': echalote,
  'Hakéa': hakea,
  'Romarin': romarin,
  'Cerise': cerise,
  'Fraise': fraise,
  'Pistache': pistache,
  'Pamplemousse': pamplemousse,
}
