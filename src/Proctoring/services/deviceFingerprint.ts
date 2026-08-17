export async function getDeviceFingerprint() {
    const ua = navigator.userAgent;
    
    // Basic OS parsing
    let osName = 'Unknown OS';
    if (ua.indexOf('Win') !== -1) osName = 'Windows';
    else if (ua.indexOf('Mac') !== -1) osName = 'macOS';
    else if (ua.indexOf('Linux') !== -1) osName = 'Linux';
    else if (ua.indexOf('Android') !== -1) osName = 'Android';
    else if (ua.indexOf('like Mac') !== -1) osName = 'iOS';

    // Basic Browser parsing
    let browserName = 'Unknown Browser';
    if (ua.indexOf('Chrome') !== -1) browserName = 'Chrome';
    else if (ua.indexOf('Safari') !== -1) browserName = 'Safari';
    else if (ua.indexOf('Firefox') !== -1) browserName = 'Firefox';
    else if (ua.indexOf('Edge') !== -1) browserName = 'Edge';

    // Device type
    let deviceType = 'desktop';
    if (/Mobi|Android/i.test(ua)) {
        deviceType = 'mobile';
    } else if (/Tablet|iPad/i.test(ua)) {
        deviceType = 'tablet';
    }

    // Network type
    let networkType = 'unknown';
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
        networkType = conn.effectiveType || conn.type || 'unknown';
    }

    // IP Hash (Privacy safe)
    let ipHash = 'unknown';
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        // Simple SHA-256 hash using Web Crypto API
        const msgBuffer = new TextEncoder().encode(data.ip);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        ipHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    } catch (e) {
        console.warn("Could not fetch IP for fingerprinting");
    }

    return {
        osName,
        browserName,
        deviceType,
        networkType,
        ipHash,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        screenResolution: `${window.screen.width}x${window.screen.height}`
    };
}
