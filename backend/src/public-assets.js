import path from 'node:path';

// The project root also contains backend code and runtime customer data.
// Only these website assets may reach express.static.
export function isPublicAssetPath(requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return false;
  }
  if (!decoded.startsWith('/') || /[\\\0]/.test(decoded)) return false;
  const parts = decoded.split('/').filter(Boolean);
  if (parts.some(part => part.startsWith('.'))) return false;
  if (parts.length === 0) return true;

  const extension = path.posix.extname(decoded).toLowerCase();
  if (parts.length === 1) {
    if (['robots.txt', 'sitemap.xml', 'site.webmanifest'].includes(parts[0])) return true;
    // Keep extensionless public-page URLs supported by express.static.
    return extension === '' || ['.html', '.css', '.png', '.ico'].includes(extension);
  }
  if (parts[0] === 'js') return extension === '.js';
  if (['images', 'icons', 'service-gallery-images'].includes(parts[0])) {
    return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.avif'].includes(extension);
  }
  return false;
}

export function publicAssetsOnly(staticMiddleware) {
  return (req, res, next) => {
    if (!isPublicAssetPath(req.path)) return next();
    return staticMiddleware(req, res, next);
  };
}
