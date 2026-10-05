export const APPROVED_PAPER_WEIGHTS = ['80gsm', '100gsm'] as const;

export type ApprovedPaperWeight = typeof APPROVED_PAPER_WEIGHTS[number];

export const DEFAULT_PAPER_WEIGHT: ApprovedPaperWeight = '80gsm';

export const PAPER_WEIGHT_LABEL_KEYS: Record<ApprovedPaperWeight, string> = {
  '80gsm': '80gsm — กระดาษมาตรฐาน',
  '100gsm': '100gsm — กระดาษหนา',
};

export function formatPaperPrintPreview(paperSize: string, paperWeight: ApprovedPaperWeight, sidednessLabel: string): string {
  return `${paperSize} • ${paperWeight} • ${sidednessLabel}`;
}
