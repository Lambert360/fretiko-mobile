import { useState, useEffect, useCallback, useMemo } from 'react';
import { searchAPI, SearchQuery, SearchResult, SearchType, DiscoverContent } from '../services/searchAPI';

// Search hook for performing searches
export const useSearch = () => {
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const search = useCallback(async (query: SearchQuery) => {
    // Validate input
    if (!query.query && query.type === SearchType.ALL) {
      setSearchError('Search query is required');
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      // Sanitize and validate query
      const sanitizedQuery = query.query?.trim();
      if (sanitizedQuery && sanitizedQuery.length > 500) {
        throw new Error('Search query is too long');
      }

      const searchParams = {
        ...query,
        query: sanitizedQuery,
      };

      const results = await searchAPI.search(searchParams);
      setSearchResults(results);
      
      // Add to search history if there's a query
      if (sanitizedQuery && !searchHistory.includes(sanitizedQuery)) {
        setSearchHistory(prev => [sanitizedQuery, ...prev.slice(0, 9)]); // Keep last 10 searches
      }
    } catch (error: any) {
      console.error('Search error:', error);
      const errorMessage = error.message || 'Search failed. Please try again.';
      setSearchError(errorMessage);
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  }, [searchHistory]);

  const clearSearch = useCallback(() => {
    setSearchResults(null);
    setSearchError(null);
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  return {
    searchResults,
    isSearching,
    searchError,
    searchHistory,
    search,
    clearSearch,
    clearHistory,
  };
};

// Hook for search suggestions with improved debouncing
export const useSearchSuggestions = (query: string, enabled: boolean = true) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Clear suggestions immediately if query is too short or disabled
    if (!enabled || !query || query.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Set loading state immediately
    setIsLoading(true);
    setError(null);

    const fetchSuggestions = async () => {
      try {
        // Only fetch if query is still the same (avoid race conditions)
        const results = await searchAPI.getSearchSuggestions(query.trim(), 5);
        setSuggestions(results || []);
      } catch (err: any) {
        console.error('Search suggestions error:', err);
        setError(err.message || 'Failed to fetch suggestions');
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce the API call - longer delay for better UX
    const timeoutId = setTimeout(fetchSuggestions, 500);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [query, enabled]);

  // Clear suggestions when query becomes empty
  useEffect(() => {
    if (!query) {
      setSuggestions([]);
      setError(null);
    }
  }, [query]);

  return { suggestions, isLoading, error };
};

// Hook for discover content (trending, featured, recommendations)
export const useDiscoverContent = (autoRefresh: boolean = false, refreshInterval: number = 300000) => {
  const [discoverContent, setDiscoverContent] = useState<DiscoverContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDiscoverContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const content = await searchAPI.getDiscoverContent();

      // Validate response
      if (!content) {
        throw new Error('No discover content received');
      }

      setDiscoverContent(content);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Discover content error:', err);
      const errorMessage = err.message || 'Failed to load discover content';
      setError(errorMessage);

      // Don't depend on discoverContent state to avoid infinite loops
      setDiscoverContent(null);
    } finally {
      setIsLoading(false);
    }
  }, []); // Remove discoverContent dependency

  useEffect(() => {
    // Initial load
    fetchDiscoverContent();

    // Auto refresh if enabled
    if (autoRefresh) {
      const intervalId = setInterval(fetchDiscoverContent, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [fetchDiscoverContent, autoRefresh, refreshInterval]);

  const refreshContent = useCallback(() => {
    fetchDiscoverContent();
  }, [fetchDiscoverContent]);

  return {
    discoverContent,
    isLoading,
    error,
    lastUpdated,
    refreshContent,
  };
};

// Hook for trending searches
export const useTrendingSearches = (location?: string, limit: number = 10) => {
  const [trending, setTrending] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrending = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const results = await searchAPI.getTrendingSearches(location, limit);
        setTrending(results);
      } catch (err: any) {
        setError(err.message);
        console.error('Trending searches error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrending();
  }, [location, limit]);

  return { trending, isLoading, error };
};

// Hook for featured content
export const useFeaturedContent = (type?: SearchType, location?: string, limit: number = 10) => {
  const [featured, setFeatured] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeatured = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const results = await searchAPI.getFeaturedContent(type, location, limit);
        setFeatured(results);
      } catch (err: any) {
        setError(err.message);
        console.error('Featured content error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeatured();
  }, [type, location, limit]);

  return { featured, isLoading, error };
};

// Hook for personalized recommendations
export const usePersonalizedRecommendations = (type?: SearchType, limit: number = 10) => {
  const [recommendations, setRecommendations] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const results = await searchAPI.getPersonalizedRecommendations(type, limit);
        setRecommendations(results);
      } catch (err: any) {
        setError(err.message);
        console.error('Recommendations error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, [type, limit]);

  return { recommendations, isLoading, error };
};

// Hook for search categories and filters
export const useSearchCategories = () => {
  const [categories, setCategories] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const results = await searchAPI.getSearchCategories();
        setCategories(results);
      } catch (err: any) {
        setError(err.message);
        console.error('Categories error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, isLoading, error };
};

// Advanced search hook with filters
export const useAdvancedSearch = () => {
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<SearchQuery>({});

  const performSearch = useCallback(async (query: SearchQuery) => {
    setIsLoading(true);
    setError(null);

    try {
      const searchResults = await searchAPI.search(query);
      setResults(searchResults);
      setActiveFilters(query);
    } catch (err: any) {
      setError(err.message);
      console.error('Advanced search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateFilters = useCallback((newFilters: Partial<SearchQuery>) => {
    const updatedQuery = { ...activeFilters, ...newFilters };
    setActiveFilters(updatedQuery);
    performSearch(updatedQuery);
  }, [activeFilters, performSearch]);

  const clearFilters = useCallback(() => {
    setActiveFilters({});
    setResults(null);
  }, []);

  return {
    results,
    isLoading,
    error,
    activeFilters,
    performSearch,
    updateFilters,
    clearFilters,
  };
};