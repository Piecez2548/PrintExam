export const APPROVED_PAPER_SIZES = ['A4'] as const;
export const APPROVED_PAPER_WEIGHTS = ['80gsm', '100gsm'] as const;

export type ApprovedPaperWeight = typeof APPROVED_PAPER_WEIGHTS[number];

export type PaperPrintSpecificationError = 'UNSUPPORTED_PAPER_SIZE' | 'UNSUPPORTED_PAPER_WEIGHT';

export type PaperPrintSpecificationResult =
  | { ok: true; paperType: string }
  | { ok: false; error: PaperPrintSpecificationError };

/** Builds the stable stored value from authoritative exam settings and an approved weight. */
export function createPaperPrintSpecification(
  paperSize: unknown,
  isDoubleSided: unknown,
  paperWeight: unknown,
): PaperPrintSpecificationResult {
  if (typeof paperSize !== 'string' || !APPROVED_PAPER_SIZES.includes(paperSize as typeof APPROVED_PAPER_SIZES[number])) {
    return { ok: false, error: 'UNSUPPORTED_PAPER_SIZE' };
  }

  if (typeof paperWeight !== 'string' || !APPROVED_PAPER_WEIGHTS.includes(paperWeight as ApprovedPaperWeight)) {
    return { ok: false, error: 'UNSUPPORTED_PAPER_WEIGHT' };
  }

  if (typeof isDoubleSided !== 'boolean') {
    return { ok: false, error: 'UNSUPPORTED_PAPER_SIZE' };
  }

  return {
    ok: true,
    paperType: `${paperSize} ${paperWeight} ${isDoubleSided ? 'หน้า-หลัง' : 'หน้าเดียว'}`,
  };
}
