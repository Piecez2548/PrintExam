import {
  isCanonicalPsuHatYaiOrganization,
  PSU_HATYAI_ORGANIZATIONS,
  type PsuHatYaiOrganization,
} from '../../../backend/src/data/psuHatYaiOrganizations.ts';

export { isCanonicalPsuHatYaiOrganization, PSU_HATYAI_ORGANIZATIONS };
export type { PsuHatYaiOrganization };

export function getPsuOrganizationLabel(organization: PsuHatYaiOrganization, language: string | undefined): string {
  return language === 'en' ? organization.en : organization.th;
}

export function getPsuOrganizationOptionLabel(value: string, language: string | undefined, legacySuffix: string): string {
  const organization = PSU_HATYAI_ORGANIZATIONS.find((option) => option.th === value);
  return organization ? getPsuOrganizationLabel(organization, language) : `${value} (${legacySuffix})`;
}
