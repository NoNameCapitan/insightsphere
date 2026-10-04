/** Navigation and arithmetic tool metadata. Never selects a medical article point. */
import type { SpecialtyId } from './vlk-sample-data.ts';
export type SpecialtyTool = 'egfr' | 'liver' | 'spirometry' | 'pta' | 'refraction' | 'joints';
export const SPECIALTY_TOOLS: Partial<Record<SpecialtyId, readonly SpecialtyTool[]>> = {
  therapist: ['egfr', 'liver', 'spirometry'],
  surgeon: ['joints', 'egfr'],
  ent: ['pta'],
  ophthalmologist: ['refraction'],
};
export const SPECIALTY_TOOL_LABELS: Record<SpecialtyTool, { label: string; title: string; articles: readonly string[] }> = {
  egfr: { label: 'рШКФ', title: 'Розрахункова швидкість клубочкової фільтрації', articles: ['66'] },
  liver: { label: 'FIB-4 / APRI', title: 'Розрахункові індекси печінки', articles: ['4', '54'] },
  spirometry: { label: 'Спірометрія', title: 'Співвідношення та відсоток належного значення', articles: ['46', '47'] },
  pta: { label: 'PTA4', title: 'Середній поріг слуху окремо для кожного вуха', articles: ['36'] },
  refraction: { label: 'Рефракція', title: 'Оптична сила головних меридіанів', articles: ['30'] },
  joints: { label: 'Виміри кінцівок', title: 'Довжина кінцівок і довідник рухів суглобів', articles: ['61', '62'] },
};
