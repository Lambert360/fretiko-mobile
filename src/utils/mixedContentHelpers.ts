import { Product } from '../services/productsAPI';
import { useMemo } from 'react';

/**
 * Helper functions for generating mixed content sections
 * These are memoized to avoid expensive recalculations
 */

export interface SectionProducts {
  title: string;
  subtitle: string;
  products: Product[];
}

/**
 * Get trending products (high engagement in last 48 hours)
 */
export const getTrendingProducts = (products: Product[], limit: number = 8): Product[] => {
  const now = Date.now();
  const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;

  return products
    .filter(p => {
      const createdAt = new Date(p.created_at).getTime();
      const hoursSinceCreated = (now - createdAt) / (1000 * 60 * 60);
      return hoursSinceCreated <= 48 && (p.view_count > 5 || p.like_count > 2);
    })
    .sort((a, b) => (b.view_count + b.like_count * 3) - (a.view_count + a.like_count * 3))
    .slice(0, limit);
};

/**
 * Get hot picks (featured products)
 */
export const getHotPicks = (products: Product[], limit: number = 8): Product[] => {
  return products
    .filter(p => p.is_featured)
    .slice(0, limit);
};

/**
 * Get seasonal rave products (tagged with seasonal keywords)
 */
export const getSeasonalRave = (products: Product[], limit: number = 8): Product[] => {
  const seasonalTags = ['seasonal', 'summer', 'winter', 'spring', 'fall', 'holiday', 'christmas', 'valentine'];
  
  return products
    .filter(p => 
      p.tags?.some(tag => 
        seasonalTags.includes(tag.toLowerCase())
      )
    )
    .slice(0, limit);
};

/**
 * Get combo deals (tagged with combo keywords)
 */
export const getCombodeals = (products: Product[], limit: number = 8): Product[] => {
  const comboTags = ['combo', 'bundle', 'set', 'package'];
  
  return products
    .filter(p => 
      p.tags?.some(tag => 
        comboTags.includes(tag.toLowerCase())
      )
    )
    .slice(0, limit);
};

/**
 * Get flash sales (tagged with sale keywords)
 */
export const getFlashSales = (products: Product[], limit: number = 8): Product[] => {
  const saleTags = ['sale', 'flash', 'deal', 'discount'];
  
  return products
    .filter(p => 
      p.tags?.some(tag => 
        saleTags.includes(tag.toLowerCase())
      )
    )
    .slice(0, limit);
};

/**
 * Get "For You" products (randomized, TODO: personalize based on user history)
 */
export const getForYou = (products: Product[], limit: number = 20): Product[] => {
  // Shuffle array for random selection
  const shuffled = [...products].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, limit);
};

/**
 * Memoized section generator
 * Only recalculates when products array reference changes
 */
export const useMemoizedSections = (products: Product[]) => {
  return useMemo(() => {
    const trending = getTrendingProducts(products);
    const hotPicks = getHotPicks(products);
    const seasonalRave = getSeasonalRave(products);
    const combodeals = getCombodeals(products);
    const flashSales = getFlashSales(products);
    const forYou = getForYou(products);

    return {
      trending,
      hotPicks,
      seasonalRave,
      combodeals,
      flashSales,
      forYou,
    };
  }, [products]);
};

/**
 * Check if products array has changed significantly
 * Used for dependency tracking
 */
export const productsChanged = (
  oldProducts: Product[],
  newProducts: Product[]
): boolean => {
  // If lengths differ, definitely changed
  if (oldProducts.length !== newProducts.length) {
    return true;
  }

  // Check if any product IDs changed (simple check)
  const oldIds = new Set(oldProducts.map(p => p.id));
  const newIds = new Set(newProducts.map(p => p.id));
  
  if (oldIds.size !== newIds.size) {
    return true;
  }

  // Check if any IDs are different
  for (const id of oldIds) {
    if (!newIds.has(id)) {
      return true;
    }
  }

  // Check if any key properties changed (view_count, like_count, is_featured)
  for (let i = 0; i < oldProducts.length; i++) {
    const old = oldProducts[i];
    const new_ = newProducts[i];
    
    if (
      old.view_count !== new_.view_count ||
      old.like_count !== new_.like_count ||
      old.is_featured !== new_.is_featured
    ) {
      return true;
    }
  }

  return false;
};

