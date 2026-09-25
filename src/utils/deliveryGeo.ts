import * as Location from 'expo-location';
import { Country, State, City } from 'country-state-city';

export interface GeoCoords {
  latitude: number;
  longitude: number;
}

/**
 * Resolve a typed delivery address to coordinates — street-level when the
 * native geocoder (CLGeocoder / Android Geocoder, free, no API key) can
 * place it, city centroid via country-state-city as fallback.
 * Returns null when nothing resolves — callers degrade gracefully.
 */
export async function resolveAddressCoords(addr: {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}): Promise<GeoCoords | null> {
  const fullAddress = [addr.address, addr.city, addr.state, addr.country]
    .filter(Boolean)
    .join(', ');

  if (fullAddress.trim()) {
    try {
      const results = await Location.geocodeAsync(fullAddress);
      const hit = results?.[0];
      if (hit && Number.isFinite(hit.latitude) && Number.isFinite(hit.longitude)) {
        return { latitude: hit.latitude, longitude: hit.longitude };
      }
    } catch (e) {
      // Native geocoder unavailable/failed — fall through to city centroid
    }
  }

  return cityCentroid(addr.city, addr.state, addr.country);
}

/** City centroid from the bundled country-state-city dataset (offline). */
export function cityCentroid(
  cityName?: string,
  stateName?: string,
  countryName?: string,
): GeoCoords | null {
  if (!countryName) return null;
  const country = Country.getAllCountries().find(
    c => c.name.toLowerCase() === countryName.trim().toLowerCase(),
  );
  if (!country) return null;

  const states = State.getStatesOfCountry(country.isoCode) || [];
  const state = stateName
    ? states.find(s => s.name.toLowerCase() === stateName.trim().toLowerCase())
    : undefined;

  if (state) {
    const cities = City.getCitiesOfState(country.isoCode, state.isoCode) || [];
    const city = cityName
      ? cities.find(c => c.name.toLowerCase() === cityName.trim().toLowerCase())
      : undefined;
    const target = city ?? cities[0];
    if (target?.latitude && target?.longitude) {
      return { latitude: parseFloat(target.latitude), longitude: parseFloat(target.longitude) };
    }
    // State centroid as last resort
    if (state.latitude && state.longitude) {
      return { latitude: parseFloat(state.latitude), longitude: parseFloat(state.longitude) };
    }
  }
  return null;
}
