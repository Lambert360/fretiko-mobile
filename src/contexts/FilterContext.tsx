import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { FilterOptions } from '../components/FilterDropdown';
import { loadFilters, saveFilters, debouncedSaveFilters, getDefaultFilters } from '../utils/filterStorage';

interface FilterContextType {
  productFilters: FilterOptions;
  serviceFilters: FilterOptions;
  setProductFilters: (filters: FilterOptions) => void;
  setServiceFilters: (filters: FilterOptions) => void;
  resetProductFilters: () => void;
  resetServiceFilters: () => void;
  isLoading: boolean;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

interface FilterProviderProps {
  children: ReactNode;
}

export const FilterProvider: React.FC<FilterProviderProps> = ({ children }) => {
  const [productFilters, setProductFiltersState] = useState<FilterOptions>(getDefaultFilters());
  const [serviceFilters, setServiceFiltersState] = useState<FilterOptions>(getDefaultFilters());
  const [isLoading, setIsLoading] = useState(true);

  // Load filters on mount
  useEffect(() => {
    const loadStoredFilters = async () => {
      try {
        setIsLoading(true);
        const [loadedProductFilters, loadedServiceFilters] = await Promise.all([
          loadFilters('products'),
          loadFilters('services'),
        ]);

        if (loadedProductFilters) {
          setProductFiltersState(loadedProductFilters);
        }

        if (loadedServiceFilters) {
          setServiceFiltersState(loadedServiceFilters);
        }
      } catch (error) {
        console.error('Error loading filters:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredFilters();
  }, []);

  // Set product filters with persistence
  const setProductFilters = useCallback((filters: FilterOptions) => {
    setProductFiltersState(filters);
    debouncedSaveFilters(filters, 'products');
  }, []);

  // Set service filters with persistence
  const setServiceFilters = useCallback((filters: FilterOptions) => {
    setServiceFiltersState(filters);
    debouncedSaveFilters(filters, 'services');
  }, []);

  // Reset product filters
  const resetProductFilters = useCallback(() => {
    const defaultFilters = getDefaultFilters();
    setProductFiltersState(defaultFilters);
    saveFilters(defaultFilters, 'products').catch(error => {
      console.error('Error resetting product filters:', error);
    });
  }, []);

  // Reset service filters
  const resetServiceFilters = useCallback(() => {
    const defaultFilters = getDefaultFilters();
    setServiceFiltersState(defaultFilters);
    saveFilters(defaultFilters, 'services').catch(error => {
      console.error('Error resetting service filters:', error);
    });
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<FilterContextType>(() => ({
    productFilters,
    serviceFilters,
    setProductFilters,
    setServiceFilters,
    resetProductFilters,
    resetServiceFilters,
    isLoading,
  }), [productFilters, serviceFilters, setProductFilters, setServiceFilters, resetProductFilters, resetServiceFilters, isLoading]);

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
};

export const useFilters = (): FilterContextType => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};

