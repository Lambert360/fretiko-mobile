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
} from 'react-native';

const { width } = Dimensions.get('window');

interface Location {
  country: string;
  state: string;
  code: string;
}

interface LocationSelectorProps {
  visible: boolean;
  selectedLocation: string;
  onLocationSelect: (location: string) => void;
  onClose: () => void;
}

// Sample locations data - in production, this would come from backend
const LOCATIONS: Location[] = [
  // Nigeria
  { country: 'Nigeria', state: 'Lagos', code: 'NG-LA' },
  { country: 'Nigeria', state: 'Abuja', code: 'NG-FC' },
  { country: 'Nigeria', state: 'Rivers', code: 'NG-RI' },
  { country: 'Nigeria', state: 'Kano', code: 'NG-KN' },
  { country: 'Nigeria', state: 'Oyo', code: 'NG-OY' },
  { country: 'Nigeria', state: 'Delta', code: 'NG-DE' },
  { country: 'Nigeria', state: 'Kaduna', code: 'NG-KD' },
  { country: 'Nigeria', state: 'Ogun', code: 'NG-OG' },
  { country: 'Nigeria', state: 'Imo', code: 'NG-IM' },
  { country: 'Nigeria', state: 'Plateau', code: 'NG-PL' },
  
  // Ghana
  { country: 'Ghana', state: 'Greater Accra', code: 'GH-AA' },
  { country: 'Ghana', state: 'Ashanti', code: 'GH-AH' },
  { country: 'Ghana', state: 'Western', code: 'GH-WP' },
  { country: 'Ghana', state: 'Central', code: 'GH-CP' },
  { country: 'Ghana', state: 'Eastern', code: 'GH-EP' },
  
  // Kenya
  { country: 'Kenya', state: 'Nairobi', code: 'KE-30' },
  { country: 'Kenya', state: 'Mombasa', code: 'KE-40' },
  { country: 'Kenya', state: 'Kisumu', code: 'KE-42' },
  { country: 'Kenya', state: 'Nakuru', code: 'KE-32' },
  
  // South Africa
  { country: 'South Africa', state: 'Western Cape', code: 'ZA-WC' },
  { country: 'South Africa', state: 'Gauteng', code: 'ZA-GT' },
  { country: 'South Africa', state: 'KwaZulu-Natal', code: 'ZA-NL' },
  { country: 'South Africa', state: 'Eastern Cape', code: 'ZA-EC' },
  
  // USA (Popular states)
  { country: 'United States', state: 'California', code: 'US-CA' },
  { country: 'United States', state: 'New York', code: 'US-NY' },
  { country: 'United States', state: 'Texas', code: 'US-TX' },
  { country: 'United States', state: 'Florida', code: 'US-FL' },
  { country: 'United States', state: 'Illinois', code: 'US-IL' },
  
  // UK
  { country: 'United Kingdom', state: 'England', code: 'GB-ENG' },
  { country: 'United Kingdom', state: 'Scotland', code: 'GB-SCT' },
  { country: 'United Kingdom', state: 'Wales', code: 'GB-WLS' },
  
  // Canada
  { country: 'Canada', state: 'Ontario', code: 'CA-ON' },
  { country: 'Canada', state: 'British Columbia', code: 'CA-BC' },
  { country: 'Canada', state: 'Quebec', code: 'CA-QC' },
  { country: 'Canada', state: 'Alberta', code: 'CA-AB' },
];

const LocationSelector: React.FC<LocationSelectorProps> = ({
  visible,
  selectedLocation,
  onLocationSelect,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredLocations, setFilteredLocations] = useState<Location[]>(LOCATIONS);
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

  // Filter locations based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = LOCATIONS.filter(location =>
        location.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
        location.state.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredLocations(filtered);
    } else {
      setFilteredLocations(LOCATIONS);
    }
  }, [searchQuery]);

  // Group locations by country
  const groupedLocations = filteredLocations.reduce((groups, location) => {
    const country = location.country;
    if (!groups[country]) {
      groups[country] = [];
    }
    groups[country].push(location);
    return groups;
  }, {} as Record<string, Location[]>);

  const handleLocationSelect = (location: Location) => {
    const locationString = `${location.state}, ${location.country}`;
    onLocationSelect(locationString);
    onClose();
  };

  if (!visible) return null;

  return (
    <>
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
            placeholder="Search countries or states..."
            placeholderTextColor="#666"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Locations List */}
        <ScrollView 
          style={styles.locationsList}
          showsVerticalScrollIndicator={false}
        >
          {Object.entries(groupedLocations).map(([country, locations]) => (
            <View key={country} style={styles.countryGroup}>
              <Text style={styles.countryTitle}>{country}</Text>
              
              {locations.map((location) => {
                const locationString = `${location.state}, ${location.country}`;
                const isSelected = selectedLocation === locationString;
                
                return (
                  <TouchableOpacity
                    key={location.code}
                    style={[
                      styles.locationItem,
                      isSelected && styles.selectedLocationItem
                    ]}
                    onPress={() => handleLocationSelect(location)}
                  >
                    <View style={styles.locationInfo}>
                      <Text style={[
                        styles.stateName,
                        isSelected && styles.selectedStateName
                      ]}>
                        {location.state}
                      </Text>
                      <Text style={[
                        styles.countryName,
                        isSelected && styles.selectedCountryName
                      ]}>
                        {location.country}
                      </Text>
                    </View>
                    
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#3498DB" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* Current Location Option */}
        <TouchableOpacity style={styles.currentLocationButton}>
          <Ionicons name="location" size={18} color="#27AE60" />
          <Text style={styles.currentLocationText}>Use Current Location</Text>
          <Ionicons name="chevron-forward" size={16} color="#888" />
        </TouchableOpacity>
      </Animated.View>
    </>
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
});

export default LocationSelector;