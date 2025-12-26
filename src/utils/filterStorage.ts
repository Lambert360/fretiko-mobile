import AsyncStorage from '@react-native-async-storage/async-storage';
import { FilterOptions } from '../components/FilterDropdown';

const STORAGE_KEYS = {
  PRODUCT_FILTERS: '@fretiko:product_filters',
  SERVICE_FILTERS: '@fretiko:service_filters',
  FILTER_VERSION: '@fretiko:filter_version',
};

const CURRENT_FILTER_VERSION = '1.0.0';

export interface StoredFilters {
  filters: FilterOptions;
  timestamp: number;
  version: string;
}

/**
 * Default filter options
 */
export const getDefaultFilters = (): FilterOptions => ({
  priceRange: { min: 0, max: 999999999 },
  condition: [],
  location: [],
  rating: 0,
  category: [],
  sortBy: 'newest',
  availability: [],
});

/**
 * Save filters to AsyncStorage
 */
export const saveFilters = async (
  filters: FilterOptions,
  type: 'products' | 'services'
): Promise<void> => {
  try {
    const key = type === 'products' ? STORAGE_KEYS.PRODUCT_FILTERS : STORAGE_KEYS.SERVICE_FILTERS;
    const storedData: StoredFilters = {
      filters,
      timestamp: Date.now(),
      version: CURRENT_FILTER_VERSION,
    };
    await AsyncStorage.setItem(key, JSON.stringify(storedData));
    console.log(`✅ Filters saved for ${type}`);
  } catch (error) {
    console.error(`❌ Error saving ${type} filters:`, error);
    throw error;
  }
};

/**
 * Load filters from AsyncStorage
 */
export const loadFilters = async (
  type: 'products' | 'services'
): Promise<FilterOptions | null> => {
  try {
    const key = type === 'products' ? STORAGE_KEYS.PRODUCT_FILTERS : STORAGE_KEYS.SERVICE_FILTERS;
    const stored = await AsyncStorage.getItem(key);
    
    if (!stored) {
      return null;
    }

    const storedData: StoredFilters = JSON.parse(stored);
    
    // Check version compatibility
    if (storedData.version !== CURRENT_FILTER_VERSION) {
      console.warn(`⚠️ Filter version mismatch. Expected ${CURRENT_FILTER_VERSION}, got ${storedData.version}`);
      // Migrate if needed (for future versions)
      return migrateFilters(storedData.filters, storedData.version);
    }

    // Check if filters are too old (older than 7 days, reset to defaults)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (storedData.timestamp < sevenDaysAgo) {
      console.log('🔄 Filters are older than 7 days, resetting to defaults');
      await clearFilters(type);
      return null;
    }

    return storedData.filters;
  } catch (error) {
    console.error(`❌ Error loading ${type} filters:`, error);
    return null;
  }
};

/**
 * Clear filters from AsyncStorage
 */
export const clearFilters = async (type: 'products' | 'services'): Promise<void> => {
  try {
    const key = type === 'products' ? STORAGE_KEYS.PRODUCT_FILTERS : STORAGE_KEYS.SERVICE_FILTERS;
    await AsyncStorage.removeItem(key);
    console.log(`✅ Filters cleared for ${type}`);
  } catch (error) {
    console.error(`❌ Error clearing ${type} filters:`, error);
  }
};

/**
 * Migrate filters from old version to new version
 */
const migrateFilters = (oldFilters: any, oldVersion: string): FilterOptions => {
  // For now, just return defaults if version mismatch
  // In the future, add migration logic here
  console.log(`🔄 Migrating filters from version ${oldVersion} to ${CURRENT_FILTER_VERSION}`);
  return getDefaultFilters();
};

/**
 * Debounce helper for saving filters
 */
let saveTimeout: NodeJS.Timeout | null = null;

export const debouncedSaveFilters = (
  filters: FilterOptions,
  type: 'products' | 'services',
  delay: number = 500
): void => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    saveFilters(filters, type).catch(error => {
      console.error('Error in debounced save:', error);
    });
  }, delay);
};

