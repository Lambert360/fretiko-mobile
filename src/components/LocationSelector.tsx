import { Ionicons } from '@expo/vector-icons';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  TextInput,
  Dimensions,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import * as Location from 'expo-location';
import { Country, State } from 'country-state-city';

const { width } = Dimensions.get('window');

interface Location {
  country: string;
  state: string;
  code: string;
}

// Type definitions for country-state-city library
type CountryType = typeof Country;
type StateType = typeof State;

interface LocationSelectorProps {
  visible: boolean;
  selectedLocation: string;
  onLocationSelect: (location: string) => void;
  onClose: () => void;
  /** Optional: called with state and country as separate strings (useful for address forms) */
  onLocationSelectDetailed?: (state: string, country: string) => void;
}

// Function to get location name from coordinates
const getLocationName = async (latitude: number, longitude: number): Promise<string> => {
  try {
    // In a real app, you would use a geocoding service like Google Maps API
    // For now, we'll return a generic location based on coordinates
    // This is a simplified reverse geocoding
    
    // Nigeria approximate coordinates bounds
    if (latitude >= 4 && latitude <= 14 && longitude >= 2 && longitude <= 14) {
      // Approximate Nigerian states based on coordinates
      if (latitude >= 6.4 && latitude <= 6.7 && longitude >= 3.3 && longitude <= 3.6) {
        return 'Lagos, Nigeria';
      } else if (latitude >= 8.8 && latitude <= 9.2 && longitude >= 7.2 && longitude <= 7.6) {
        return 'Abuja, Nigeria';
      } else if (latitude >= 4.7 && latitude <= 5.2 && longitude >= 6.9 && longitude <= 7.2) {
        return 'Port Harcourt, Nigeria';
      } else if (latitude >= 11.8 && latitude <= 12.2 && longitude >= 8.3 && longitude <= 8.6) {
        return 'Kano, Nigeria';
      } else {
        return 'Lagos, Nigeria'; // Default to Lagos for other Nigerian coordinates
      }
    }
    
    // Default fallback
    return 'Lagos, Nigeria';
  } catch (error) {
    console.error('Error getting location name:', error);
    return 'Lagos, Nigeria';
  }
};

// Get all countries and states from library
const allCountries: any[] = [];
const allStates: any[] = [];

// Initialize data (this could be moved to a separate file for better performance)
try {
  // Use the imported Country and State objects from country-state-city
  // Country.getAllCountries() returns all countries
  // State.getStatesOfCountry(countryCode) returns states for a specific country

  // Get all countries
  const countries = Country.getAllCountries();
  if (countries && Array.isArray(countries)) {
    allCountries.push(...countries);

    // Get all states for all countries
    allCountries.forEach(country => {
      if (country && country.isoCode) {
        const countryStates = State.getStatesOfCountry(country.isoCode);
        if (countryStates && Array.isArray(countryStates)) {
          allStates.push(...countryStates);
        }
      }
    });
  }
} catch (error) {
  console.error('Error loading country/state data:', error);
  // Add fallback data for Nigeria
  allCountries.push({ isoCode: 'NG', name: 'Nigeria' });
  allStates.push(
    { isoCode: 'NG-LA', name: 'Lagos', countryCode: 'NG' },
    { isoCode: 'NG-AB', name: 'Abuja', countryCode: 'NG' },
    { isoCode: 'NG-RV', name: 'Rivers', countryCode: 'NG' },
    { isoCode: 'NG-KN', name: 'Kano', countryCode: 'NG' }
  );
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  visible,
  selectedLocation,
  onLocationSelect,
  onClose,
  onLocationSelectDetailed,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCountries, setFilteredCountries] = useState<any[]>(allCountries);
  const [filteredStates, setFilteredStates] = useState<any[]>([]);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<any>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Animation for dropdown visibility
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Filter countries based on search
  useEffect(() => {
    if (selectedCountry) {
      // Filter states when country is selected
      if (searchQuery.trim()) {
        const filtered = allStates.filter(state =>
          state.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredStates(filtered);
      } else {
        const countryStates = allStates.filter(state => 
        state && state.countryCode && selectedCountry && selectedCountry.isoCode && 
        state.countryCode === selectedCountry.isoCode
      );
        setFilteredStates(countryStates);
      }
    } else {
      // Filter countries when no country is selected
      if (searchQuery.trim()) {
        const filtered = allCountries.filter(country =>
          country.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredCountries(filtered);
      } else {
        setFilteredCountries(allCountries);
      }
    }
  }, [searchQuery, selectedCountry]);

  const handleLocationSelect = (state: any) => {
    if (!state || !state.name || !selectedCountry || !selectedCountry.name) {
      console.error('Invalid state or country data:', { state, selectedCountry });
      return;
    }
    const locationString = `${state.name}, ${selectedCountry.name}`;
    onLocationSelect(locationString);
    if (onLocationSelectDetailed) {
      onLocationSelectDetailed(state.name, selectedCountry.name);
    }
    onClose();
  };

  const handleCountrySelect = (country: any) => {
    setSelectedCountry(country);
    setSearchQuery(''); // Clear search when switching to states
  };

  const handleBackToCountries = () => {
    setSelectedCountry(null);
    setSearchQuery(''); // Clear search when switching back
  };

  const handleCurrentLocation = async () => {
    try {
      setIsGettingLocation(true);
      
      // Check if location services are enabled
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to use your current location. Please enable it in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Check if location services are enabled
      let locationServicesEnabled = await Location.hasServicesEnabledAsync();
      if (!locationServicesEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services on your device to use your current location.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Get current location
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      console.log('Current location:', { latitude, longitude });

      // Get location name from coordinates
      const locationName = await getLocationName(latitude, longitude);
      
      // Update the selected location
      onLocationSelect(locationName);
      onClose();
      
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        'Location Error',
        'Unable to get your current location. Please try again or select a location manually.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsGettingLocation(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View 
        style={[styles.backdrop, { opacity: opacityAnim }]}
      >
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          onPress={onClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Dropdown */}
      <Animated.View 
        style={[
          styles.dropdown,
          {
            opacity: opacityAnim,
            transform: [
              { 
                scale: scaleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                })
              }
            ],
          }
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="location" size={20} color="#3498DB" />
            <Text style={styles.headerTitle}>Select Location</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color="#666" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={selectedCountry ? "Search states..." : "Search countries..."}
            placeholderTextColor="#666"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Back Button (when viewing states) */}
        {selectedCountry && (
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackToCountries}
          >
            <Ionicons name="chevron-back" size={20} color="#3498DB" />
            <Text style={styles.backButtonText}>Back to Countries</Text>
          </TouchableOpacity>
        )}

        {/* Country List */}
        {!selectedCountry && (
          <ScrollView 
            style={styles.locationsList}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {filteredCountries.map((country) => (
              <TouchableOpacity
                key={country.isoCode}
                style={styles.countryItem}
                onPress={() => handleCountrySelect(country)}
                activeOpacity={0.7}
              >
                <View style={styles.countryItemContent}>
                  <Text style={styles.countryItemText}>{country.name}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* State List (when country is selected) */}
        {selectedCountry && (
          <ScrollView 
            style={styles.locationsList}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {filteredStates.map((state, index) => {
              if (!state || !state.name) {
                console.error('Invalid state data:', state);
                return null;
              }
              
              const locationString = `${state.name}, ${selectedCountry?.name || 'Unknown'}`;
              const isSelected = selectedLocation === locationString;
              
              return (
                <TouchableOpacity
                  key={state.isoCode || `state-${index}`}
                  style={[
                    styles.locationItem,
                    isSelected && styles.selectedLocationItem
                  ]}
                  onPress={() => handleLocationSelect(state)}
                >
                  <View style={styles.locationInfo}>
                    <Text style={[
                      styles.stateName,
                      isSelected && styles.selectedStateName
                    ]}>
                      {state.name}
                    </Text>
                  </View>
                  
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color="#3498DB" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Current Location Option */}
        <TouchableOpacity 
          style={styles.currentLocationButton}
          onPress={handleCurrentLocation}
          disabled={isGettingLocation}
        >
          {isGettingLocation ? (
            <>
              <Ionicons name="location" size={18} color="#888" />
              <Text style={[styles.currentLocationText, { color: '#888' }]}>Getting location...</Text>
              <View style={{ width: 16 }} />
            </>
          ) : (
            <>
              <Ionicons name="location" size={18} color="#27AE60" />
              <Text style={styles.currentLocationText}>Use Current Location</Text>
              <Ionicons name="chevron-forward" size={16} color="#888" />
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  },
  dropdown: {
    position: 'absolute',
    top: 100,
    left: 12,
    right: 12,
    maxHeight: 500,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  closeButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 15,
    marginLeft: 12,
    marginRight: 8,
  },
  locationsList: {
    maxHeight: 300,
    paddingHorizontal: 16,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  countryGroup: {
    marginBottom: 20,
  },
  countryTitle: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    marginLeft: 4,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  selectedLocationItem: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
  },
  locationInfo: {
    flex: 1,
  },
  stateName: {
    color: 'white',
    fontSize: 15,
    fontWeight: '500',
  },
  selectedStateName: {
    color: '#3498DB',
    fontWeight: '600',
  },
  countryName: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  selectedCountryName: {
    color: '#3498DB',
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginTop: 8,
  },
  currentLocationText: {
    color: '#27AE60',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginLeft: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  backButtonText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  countryItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  countryItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countryItemText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default LocationSelector;