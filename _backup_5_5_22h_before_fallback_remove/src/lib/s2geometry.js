/**
 * S2 Geometry wrapper - lat/lng to S2 cell tokens
 * Uses the s2-geometry npm package for correct Hilbert curve computation.
 *
 * OpenUB API requires S2 cell tokens (hex strings, trailing zeros stripped)
 * typically at level 15.
 */

import { S2 } from 's2-geometry';

/**
 * Convert a single (lat, lng) to an S2 cell token at the given level.
 * Token format: hex string of cell ID with trailing zeros removed.
 *
 * @param {number} lat - Latitude in degrees
 * @param {number} lng - Longitude in degrees
 * @param {number} level - S2 cell level (e.g. 15)
 * @returns {string} S2 cell token
 */
function latLngToToken(lat, lng, level) {
  const key = S2.latLngToKey(lat, lng, level);
  const id = S2.keyToId(key);
  // Convert numeric cell ID to hex token
  const hex = BigInt(id).toString(16).padStart(16, '0');
  // Strip trailing zeros
  let end = hex.length;
  while (end > 1 && hex[end - 1] === '0') {
    end--;
  }
  return hex.substring(0, end);
}

/**
 * Get all S2 cell tokens that cover a circle of given radius around a point.
 *
 * Strategy: start from the center cell, then walk a grid of offset points
 * to discover all cells that intersect the circle.
 *
 * @param {number} lat - Latitude in degrees
 * @param {number} lng - Longitude in degrees
 * @param {number} radiusMeters - Radius in meters
 * @param {number} level - S2 cell level (typically 15)
 * @returns {string[]} Array of unique S2 cell tokens
 */
export function latLngToS2Tokens(lat, lng, radiusMeters, level) {
  // Approximate S2 cell edge size at this level in meters
  // Earth circumference ~40,075km; at level L, cell edge ~ 40075017 / 2^L meters (roughly)
  // More precise: at level 15, cell edge ~1,068m; level 16 ~534m; level 14 ~2,136m
  const cellSide = 40075017 / Math.pow(2, level);

  // How many cells in each direction to cover the radius
  const gridHalf = Math.ceil(radiusMeters / cellSide) + 1;

  // Meters per degree at this latitude
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(lat * Math.PI / 180);

  const tokens = new Set();

  // Generate a grid of sample points and collect unique tokens
  for (let di = -gridHalf; di <= gridHalf; di++) {
    for (let dj = -gridHalf; dj <= gridHalf; dj++) {
      // Check approximate distance from center
      const dx = di * cellSide;
      const dy = dj * cellSide;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Include cells within radius plus margin
      if (dist <= radiusMeters + cellSide * 1.5) {
        const ptLat = lat + (di * cellSide) / mPerDegLat;
        const ptLng = lng + (dj * cellSide) / mPerDegLng;
        tokens.add(latLngToToken(ptLat, ptLng, level));
      }
    }
  }

  // Also add the center cell's immediate neighbors (from s2-geometry)
  const centerKey = S2.latLngToKey(lat, lng, level);
  try {
    const neighbors = S2.latLngToNeighborKeys(lat, lng, level);
    for (const nKey of neighbors) {
      const nId = S2.keyToId(nKey);
      const hex = BigInt(nId).toString(16).padStart(16, '0');
      let end = hex.length;
      while (end > 1 && hex[end - 1] === '0') end--;
      tokens.add(hex.substring(0, end));
    }
  } catch (e) {
    // Neighbor computation may fail near poles; ignore
  }

  return Array.from(tokens);
}

/**
 * Get a single S2 cell token for a point at the given level.
 *
 * @param {number} lat - Latitude in degrees
 * @param {number} lng - Longitude in degrees
 * @param {number} level - S2 cell level
 * @returns {string} S2 cell token
 */
export function latLngToSingleS2Token(lat, lng, level) {
  return latLngToToken(lat, lng, level);
}
