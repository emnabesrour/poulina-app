/**
 * Géolocalisation IP (ville, pays, fuseau)
 * - IP locale → IP publique réelle (pour la démo / poste de travail)
 * - API gratuite : ip-api.com
 */
async function fetchJson(url, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function isLocalIp(ip) {
  if (!ip) return true;
  const v = ip.replace('::ffff:', '');
  return (
    v === '::1' ||
    v === '127.0.0.1' ||
    v === 'localhost' ||
    v === 'unknown' ||
    v.startsWith('192.168.') ||
    v.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(v)
  );
}

async function resolvePublicIp(ip) {
  const clean = (ip || '').replace('::ffff:', '');
  if (!isLocalIp(clean)) return clean;
  try {
    const data = await fetchJson('https://api.ipify.org?format=json');
    return data.ip || clean;
  } catch {
    return clean;
  }
}

async function locateIp(ip) {
  const resolved = await resolvePublicIp(ip);
  const local = isLocalIp(ip);

  try {
    const data = await fetchJson(`http://ip-api.com/json/${resolved}?fields=status,message,country,regionName,city,zip,lat,lon,timezone,isp,query`);
    if (data.status !== 'success') {
      return {
        ip: resolved,
        display: local ? `Réseau local (${ip})` : resolved,
        city: null,
        region: null,
        country: null,
        timezone: null,
        isp: null,
        coords: null,
        raw: data
      };
    }
    const place = [data.city, data.regionName, data.country].filter(Boolean).join(', ');
    return {
      ip: data.query || resolved,
      display: local ? `${place} (via IP publique ${data.query})` : place,
      city: data.city || null,
      region: data.regionName || null,
      country: data.country || null,
      timezone: data.timezone || null,
      isp: data.isp || null,
      coords: data.lat != null ? `${data.lat}, ${data.lon}` : null,
      localOrigin: local ? ip : null
    };
  } catch {
    return {
      ip: resolved,
      display: local ? `Réseau local (${ip})` : resolved,
      city: null,
      region: null,
      country: null,
      timezone: null,
      isp: null,
      coords: null
    };
  }
}

module.exports = { locateIp, isLocalIp };
