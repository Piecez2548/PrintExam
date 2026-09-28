export type DocumentWindow = Window | null;

/**
 * Open a document fetched through the authenticated API client.
 * The bearer token stays in the Authorization header and never enters a URL.
 */
export async function openAuthenticatedDocument(
  loadDocument: () => Promise<Blob>,
  target: DocumentWindow = window.open('', '_blank')
): Promise<void> {
  try {
    const blob = await loadDocument();
    const objectUrl = URL.createObjectURL(blob);

    if (target && !target.closed) {
      target.location.href = objectUrl;
    } else {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    if (target && !target.closed) target.close();
    throw error;
  }
}
