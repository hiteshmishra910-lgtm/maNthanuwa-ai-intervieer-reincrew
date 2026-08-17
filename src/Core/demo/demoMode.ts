/**
 * Environment-Controlled Demo Mode Configuration & State Manager
 */

const STORAGE_KEY = 'reincrew_demo_mode';

export function isDemoModeEnabled(): boolean {
  const envEnabled = import.meta.env.VITE_DEMO_MODE_ENABLED;
  if (envEnabled === 'false' || envEnabled === false) {
    return false;
  }
  return true;
}

export function getDemoModeDefault(): boolean {
  const envDefault = import.meta.env.VITE_DEMO_MODE_DEFAULT;
  if (envDefault === 'true' || envDefault === true) {
    return true;
  }
  // Production default is Demo Mode OFF (false)
  return false;
}

export function isDemoModeActive(): boolean {
  if (!isDemoModeEnabled()) return false;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'true') return true;
  if (stored === 'false') return false;

  return getDemoModeDefault();
}

const listeners = new Set<() => void>();

export function subscribeDemoMode(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error('[demoMode] Listener error:', e);
    }
  });
}

// Cross-tab storage listener
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      notifyListeners();
    }
  });
}

export function setDemoMode(active: boolean): void {
  if (!isDemoModeEnabled()) return;
  localStorage.setItem(STORAGE_KEY, active ? 'true' : 'false');
  notifyListeners();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('storage'));
  }
}

export function resetDemoMode(): void {
  localStorage.removeItem(STORAGE_KEY);
  notifyListeners();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('storage'));
  }
}
