import { createHash } from 'node:crypto';

// Shared by article citations and the source directory; preserve published URLs.
export const websitePath = host => `/sources/websites/${createHash('sha256').update(host).digest('hex').slice(0,24)}/`;
