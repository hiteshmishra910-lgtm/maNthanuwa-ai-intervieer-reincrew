type FullscreenCapableElement = HTMLElement & {
  requestFullscreen?: () => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenCapableDocument = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
};

export const isFullscreenActive = (): boolean => {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenCapableDocument;
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
};

export const requestFullscreenIfSupported = async (
  element: HTMLElement = document.documentElement,
): Promise<boolean> => {
  if (typeof document === 'undefined') return false;

  const target = element as FullscreenCapableElement;
  const requestFullscreen =
    target.requestFullscreen ||
    target.webkitRequestFullscreen ||
    target.msRequestFullscreen;

  if (!requestFullscreen) {
    return false;
  }

  try {
    await Promise.resolve(requestFullscreen.call(target));
    return true;
  } catch (error) {
    console.warn('[Fullscreen] Request failed:', error);
    return false;
  }
};
