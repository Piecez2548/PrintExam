const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const PRINT_COVER_SHEET_STYLES = `
  @page { size: A4 portrait; margin: 8mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-family: 'Prompt', 'Noto Sans Thai', sans-serif;
  }
  .print-sheet-root { width: 100%; margin: 0; padding: 0; }
  .print-cover-sheet {
    width: 194mm;
    max-width: 194mm;
    margin: 0 auto;
    box-sizing: border-box;
    border-radius: 0 !important;
    box-shadow: none !important;
    overflow: visible;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  /* Keep the same wide Cover Sheet composition as the approved Preview. */
  .print-cover-sheet .md\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .print-cover-sheet .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .print-cover-sheet .md\\:col-span-3 { grid-column: span 3 / span 3 !important; }
  .print-cover-sheet .md\\:col-span-4 { grid-column: span 4 / span 4 !important; }
  .print-cover-sheet .md\\:divide-y-0 { border-top-width: 0 !important; }
  .print-cover-sheet .md\\:divide-x > :not([hidden]) ~ :not([hidden]) {
    border-left-width: 1px !important;
    border-top-width: 0 !important;
  }
  @media print {
    html, body { width: 194mm; }
    .print-cover-sheet { width: 100%; max-width: none; }
  }
`;

export const collectCoverSheetStyles = (sourceDocument: Document): string => {
  const cssRules: string[] = [];
  const externalStylesheets = new Set<string>();

  Array.from(sourceDocument.styleSheets).forEach((stylesheet) => {
    try {
      cssRules.push(Array.from(stylesheet.cssRules).map((rule) => rule.cssText).join('\n'));
    } catch {
      if (stylesheet.href) externalStylesheets.add(stylesheet.href);
    }
  });

  // Keep external font stylesheets (notably Prompt) available to the isolated
  // document. Cross-origin stylesheets cannot expose cssRules to the source page.
  Array.from(sourceDocument.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    .map((link) => link.href)
    .filter(Boolean)
    .forEach((href) => externalStylesheets.add(href));

  const links = Array.from(externalStylesheets)
    .map((href) => `<link rel="stylesheet" href="${escapeAttribute(href)}" />`)
    .join('\n');
  const inlineStyles = `<style data-print-cover-styles>\n${cssRules.join('\n')}\n</style>`;

  return `${links}\n${inlineStyles}`;
};

export const buildCoverSheetPrintDocument = (
  coverMarkup: string,
  stylesheetMarkup: string,
): string => `<!doctype html>
  <html lang="th">
    <head>
      <meta charset="UTF-8" />
      <title>ใบปะหน้าซองข้อสอบ</title>
      ${stylesheetMarkup}
      <style>${PRINT_COVER_SHEET_STYLES}</style>
    </head>
    <body><main class="print-sheet-root">${coverMarkup}</main></body>
  </html>`;
