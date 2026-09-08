/**
 * FilterContext
 *
 * Global filter state management across all surfaces:
 * - Posts/Stories camera
 * - Live streams & auctions
 * - Video calls
 *
 * Persists user's filter + beauty preferences so they don't have to
 * re-select every time they open the camera. Uses AsyncStorage.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveFilterState } from '../filters/types';
import {
  BeautyParams,
  DEFAULT_BEAUTY_PARAMS,
  BeautyPreset,
} from '../filters/faceAR/BeautyFilter';

const STORAGE_KEY = '@fretiko/filter_state';

interface FilterContextValue {
  // Color filter
  filterId: string;
  filterIntensity: number;
  setFilter: (filterId: string, intensity?: number) => void;

  // Beauty
  beautyParams: BeautyParams;
  beautyPresetId: string;
  setBeautyParams: (params: BeautyParams) => void;
  setBeautyPreset: (preset: BeautyPreset) => void;
  updateBeautyParam: (key: keyof BeautyParams, value: number) => void;
  resetBeauty: () => void;

  // Face AR
  arAssetId: string | null;
  setARAsset: (assetId: string | null) => void;

  // Full state (for passing to FilterCameraView)
  getActiveFilterState: () => ActiveFilterState;
}

const FilterContext = createContext<FilterContextValue>({} as FilterContextValue);

export const useFilterContext = () => useContext(FilterContext);

export const FilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [filterId, setFilterId] = useState('none');
  const [filterIntensity, setFilterIntensity] = useState(100);
  const [beautyParams, setBeautyParamsState] = useState<BeautyParams>({
    ...DEFAULT_BEAUTY_PARAMS,
  });
  const [beautyPresetId, setBeautyPresetId] = useState('none');
  const [arAssetId, setARAssetId] = useState<string | null>(null);
  const isLoadedRef = useRef(false);

  // Load persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const state = JSON.parse(saved);
          if (state.filterId) setFilterId(state.filterId);
          if (state.filterIntensity) setFilterIntensity(state.filterIntensity);
          if (state.beautyParams) setBeautyParamsState(state.beautyParams);
          if (state.beautyPresetId) setBeautyPresetId(state.beautyPresetId);
          if (state.arAssetId !== undefined) setARAssetId(state.arAssetId);
        }
      } catch (e) {
        console.warn('⚠️ Failed to load filter state:', e);
      } finally {
        isLoadedRef.current = true;
      }
    })();
  }, []);

  // Persist state on change (after initial load)
  useEffect(() => {
    if (!isLoadedRef.current) return;
    const state = { filterId, filterIntensity, beautyParams, beautyPresetId, arAssetId };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [filterId, filterIntensity, beautyParams, beautyPresetId, arAssetId]);

  const setFilter = useCallback((id: string, intensity?: number) => {
    setFilterId(id);
    if (intensity !== undefined) setFilterIntensity(intensity);
  }, []);

  const setBeautyParams = useCallback((params: BeautyParams) => {
    setBeautyParamsState(params);
    // When manually adjusting params, deselect preset
    setBeautyPresetId('custom');
  }, []);

  const setBeautyPreset = useCallback((preset: BeautyPreset) => {
    setBeautyParamsState(preset.params);
    setBeautyPresetId(preset.id);
  }, []);

  const updateBeautyParam = useCallback((key: keyof BeautyParams, value: number) => {
    setBeautyParamsState((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(1, value)),
    }));
    setBeautyPresetId('custom');
  }, []);

  const resetBeauty = useCallback(() => {
    setBeautyParamsState({ ...DEFAULT_BEAUTY_PARAMS });
    setBeautyPresetId('none');
  }, []);

  const setARAsset = useCallback((assetId: string | null) => {
    setARAssetId(assetId);
  }, []);

  const getActiveFilterState = useCallback(
    (): ActiveFilterState => ({
      filterId,
      intensity: filterIntensity,
      beautyParams,
      beautyPresetId,
    }),
    [filterId, filterIntensity, beautyParams, beautyPresetId]
  );

  return (
    <FilterContext.Provider
      value={{
        filterId,
        filterIntensity,
        setFilter,
        beautyParams,
        beautyPresetId,
        setBeautyParams,
        setBeautyPreset,
        updateBeautyParam,
        resetBeauty,
        arAssetId,
        setARAsset,
        getActiveFilterState,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};
