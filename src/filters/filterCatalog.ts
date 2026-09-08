/**
 * Filter Catalog
 * Defines all available filters with their color parameters.
 * Each filter is a combination of color adjustments applied via Skia shaders.
 */

import { FilterDefinition } from './types';

export const FILTER_CATALOG: FilterDefinition[] = [
  {
    id: 'none',
    name: 'Original',
    category: 'none',
    thumbnailColor: '#FFFFFF',
    intensityDefault: 100,
  },
  // === Color Filters ===
  {
    id: 'vivid',
    name: 'Vivid',
    category: 'color',
    thumbnailColor: '#FF6B6B',
    params: {
      saturation: 0.35,
      contrast: 0.15,
      brightness: 0.05,
    },
    intensityDefault: 100,
  },
  {
    id: 'warm',
    name: 'Warm',
    category: 'color',
    thumbnailColor: '#FFA500',
    params: {
      warmth: 0.4,
      saturation: 0.1,
      brightness: 0.05,
    },
    intensityDefault: 100,
  },
  {
    id: 'cool',
    name: 'Cool',
    category: 'color',
    thumbnailColor: '#4ECDC4',
    params: {
      warmth: -0.4,
      saturation: 0.1,
      contrast: 0.05,
    },
    intensityDefault: 100,
  },
  {
    id: 'vintage',
    name: 'Vintage',
    category: 'color',
    thumbnailColor: '#D4A574',
    params: {
      warmth: 0.25,
      saturation: -0.2,
      contrast: -0.1,
      fade: 0.3,
      vignette: 0.3,
      grain: 0.15,
    },
    intensityDefault: 100,
  },
  {
    id: 'bw',
    name: 'B&W',
    category: 'color',
    thumbnailColor: '#888888',
    params: {
      saturation: -1.0,
      contrast: 0.2,
    },
    intensityDefault: 100,
  },
  {
    id: 'sepia',
    name: 'Sepia',
    category: 'color',
    thumbnailColor: '#C4A35A',
    params: {
      warmth: 0.5,
      saturation: -0.6,
      contrast: 0.1,
      fade: 0.15,
    },
    intensityDefault: 100,
  },
  {
    id: 'fade',
    name: 'Fade',
    category: 'color',
    thumbnailColor: '#E0E0E0',
    params: {
      fade: 0.4,
      saturation: -0.15,
      contrast: -0.15,
      brightness: 0.05,
    },
    intensityDefault: 100,
  },
  {
    id: 'drama',
    name: 'Drama',
    category: 'color',
    thumbnailColor: '#2C3E50',
    params: {
      contrast: 0.4,
      saturation: 0.2,
      vignette: 0.4,
      brightness: -0.05,
    },
    intensityDefault: 100,
  },
  {
    id: 'mono',
    name: 'Mono',
    category: 'color',
    thumbnailColor: '#333333',
    params: {
      saturation: -1.0,
      contrast: 0.35,
      brightness: -0.05,
    },
    intensityDefault: 100,
  },
  {
    id: 'noir',
    name: 'Noir',
    category: 'color',
    thumbnailColor: '#1A1A1A',
    params: {
      saturation: -1.0,
      contrast: 0.5,
      vignette: 0.5,
      brightness: -0.1,
    },
    intensityDefault: 100,
  },
  {
    id: 'chrome',
    name: 'Chrome',
    category: 'color',
    thumbnailColor: '#A0A0A0',
    params: {
      saturation: 0.15,
      contrast: 0.25,
      brightness: 0.1,
    },
    intensityDefault: 100,
  },
  {
    id: 'process',
    name: 'Process',
    category: 'color',
    thumbnailColor: '#5B7C99',
    params: {
      warmth: -0.2,
      tint: -0.15,
      saturation: 0.2,
      contrast: 0.15,
      fade: 0.1,
    },
    intensityDefault: 100,
  },
  {
    id: 'transfer',
    name: 'Transfer',
    category: 'color',
    thumbnailColor: '#E8A87C',
    params: {
      warmth: 0.3,
      saturation: -0.25,
      contrast: 0.1,
      fade: 0.2,
      vignette: 0.15,
    },
    intensityDefault: 100,
  },
  {
    id: 'instant',
    name: 'Instant',
    category: 'color',
    thumbnailColor: '#F4E8D0',
    params: {
      warmth: 0.2,
      saturation: 0.3,
      contrast: 0.2,
      brightness: 0.1,
      fade: 0.1,
    },
    intensityDefault: 100,
  },
  {
    id: 'golden',
    name: 'Golden',
    category: 'color',
    thumbnailColor: '#FFD700',
    params: {
      warmth: 0.5,
      saturation: 0.25,
      brightness: 0.1,
      contrast: 0.1,
      vignette: 0.15,
    },
    intensityDefault: 100,
  },
  {
    id: 'ocean',
    name: 'Ocean',
    category: 'color',
    thumbnailColor: '#0077BE',
    params: {
      warmth: -0.3,
      tint: 0.2,
      saturation: 0.2,
      contrast: 0.15,
      brightness: 0.05,
    },
    intensityDefault: 100,
  },
  {
    id: 'sunset',
    name: 'Sunset',
    category: 'color',
    thumbnailColor: '#FF6E7F',
    params: {
      warmth: 0.45,
      saturation: 0.3,
      contrast: 0.1,
      vignette: 0.2,
      fade: 0.05,
    },
    intensityDefault: 100,
  },
];

/**
 * Get a filter by ID
 */
export function getFilterById(id: string): FilterDefinition | undefined {
  return FILTER_CATALOG.find((f) => f.id === id);
}

/**
 * Get filters by category
 */
export function getFiltersByCategory(category: string): FilterDefinition[] {
  return FILTER_CATALOG.filter((f) => f.category === category);
}
