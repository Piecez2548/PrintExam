export const PSU_HATYAI_ORGANIZATIONS = [
  { key: 'HATYAI_AGRO_INDUSTRY', th: 'คณะอุตสาหกรรมเกษตร', en: 'Faculty of Agro-Industry' },
  { key: 'HATYAI_DENTISTRY', th: 'คณะทันตแพทยศาสตร์', en: 'Faculty of Dentistry' },
  { key: 'HATYAI_ECONOMICS', th: 'คณะเศรษฐศาสตร์', en: 'Faculty of Economics' },
  { key: 'HATYAI_ENGINEERING', th: 'คณะวิศวกรรมศาสตร์', en: 'Faculty of Engineering' },
  { key: 'HATYAI_ENVIRONMENTAL_MANAGEMENT', th: 'คณะการจัดการสิ่งแวดล้อม', en: 'Faculty of Environmental Management' },
  { key: 'HATYAI_LAW', th: 'คณะนิติศาสตร์', en: 'Faculty of Law' },
  { key: 'HATYAI_LIBERAL_ARTS', th: 'คณะศิลปศาสตร์', en: 'Faculty of Liberal Arts' },
  { key: 'HATYAI_MANAGEMENT_SCIENCES', th: 'คณะวิทยาการจัดการ', en: 'Faculty of Management Sciences' },
  { key: 'HATYAI_MEDICAL_TECHNOLOGY', th: 'คณะเทคนิคการแพทย์', en: 'Faculty of Medical Technology' },
  { key: 'HATYAI_MEDICINE', th: 'คณะแพทยศาสตร์', en: 'Faculty of Medicine' },
  { key: 'HATYAI_NATURAL_RESOURCES', th: 'คณะทรัพยากรธรรมชาติ', en: 'Faculty of Natural Resources' },
  { key: 'HATYAI_NURSING', th: 'คณะพยาบาลศาสตร์', en: 'Faculty of Nursing' },
  { key: 'HATYAI_PHARMACEUTICAL_SCIENCES', th: 'คณะเภสัชศาสตร์', en: 'Faculty of Pharmaceutical Sciences' },
  { key: 'HATYAI_SCIENCE', th: 'คณะวิทยาศาสตร์', en: 'Faculty of Science' },
  { key: 'HATYAI_TRADITIONAL_THAI_MEDICINE', th: 'คณะการแพทย์แผนไทย', en: 'Faculty of Traditional Thai Medicine' },
  { key: 'HATYAI_VETERINARY_SCIENCE', th: 'คณะสัตวแพทยศาสตร์', en: 'Faculty of Veterinary Science' },
  { key: 'HATYAI_GRADUATE_SCHOOL', th: 'บัณฑิตวิทยาลัย', en: 'Graduate School' },
  { key: 'HATYAI_INTERNATIONAL_COLLEGE', th: 'วิทยาลัยนานาชาติ', en: 'International College' },
] as const;

export type PsuHatYaiOrganization = (typeof PSU_HATYAI_ORGANIZATIONS)[number];

export function isCanonicalPsuHatYaiOrganization(value: unknown): value is PsuHatYaiOrganization['th'] {
  return typeof value === 'string'
    && PSU_HATYAI_ORGANIZATIONS.some((organization) => organization.th === value);
}
