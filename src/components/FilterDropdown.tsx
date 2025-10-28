import { Ionicons } from '@expo/vector-icons';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  Dimensions,
  TextInput,
} from 'react-native';

const { width } = Dimensions.get('window');

export interface FilterOptions {
  priceRange: {
    min: number;
    max: number;
  };
  condition: string[];
  location: string[];
  rating: number;
  category: string[];
  sortBy: string;
  availability: string[];
}

// Location data structure (matching LocationSelector)
interface Location {
  country: string;
  state: string;
  code: string;
}

// Comprehensive location list (79 locations across 9 countries)
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
  // USA
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

interface FilterDropdownProps {
  visible: boolean;
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
  categories?: Array<{ id: string; name: string }>;
  activeTab?: 'products' | 'services';
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  visible,
  filters,
  onFiltersChange,
  onClose,
  onApply,
  onReset,
  categories = [],
  activeTab = 'products',
}) => {
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [locationSearch, setLocationSearch] = useState('');

  // Animation for dropdown visibility
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -300,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const priceRanges = [
    { label: 'Under ₣10,000', min: 0, max: 10000 },
    { label: '₣10,000 - ₣50,000', min: 10000, max: 50000 },
    { label: '₣50,000 - ₣100,000', min: 50000, max: 100000 },
    { label: '₣100,000 - ₣500,000', min: 100000, max: 500000 },
    { label: 'Over ₣500,000', min: 500000, max: 999999999 },
  ];

  const conditions = ['new', 'like-new', 'good', 'fair'];
  
  // Dynamic location list with search
  const filteredLocationList = LOCATIONS.filter(loc => {
    const locationString = `${loc.state}, ${loc.country}`.toLowerCase();
    return locationString.includes(locationSearch.toLowerCase());
  });
  
  // Group locations by country for better UX
  const groupedLocations = filteredLocationList.reduce((acc, loc) => {
    if (!acc[loc.country]) acc[loc.country] = [];
    acc[loc.country].push(loc);
    return acc;
  }, {} as Record<string, Location[]>);
  
  const sortOptions = [
    { label: 'Newest First', value: 'newest' },
    { label: 'Price: Low to High', value: 'price_asc' },
    { label: 'Price: High to Low', value: 'price_desc' },
    { label: 'Most Popular', value: 'popular' },
    { label: 'Highest Rated', value: 'rating' },
  ];
  
  // Dynamic availability based on tab
  const availabilityOptions = activeTab === 'products'
    ? ['In Stock', 'Free Shipping', 'Same Day Delivery']
    : ['Weekdays', 'Weekends', 'Evenings', 'Emergency'];

  const updateFilters = (key: keyof FilterOptions, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key: 'condition' | 'location' | 'category' | 'availability', value: string) => {
    const currentArray = filters[key];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    updateFilters(key, newArray);
  };

  const setPriceRange = (min: number, max: number) => {
    updateFilters('priceRange', { min, max });
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

      {/* Filter Dropdown */}
      <Animated.View 
        style={[
          styles.dropdown,
          {
            opacity: opacityAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Advanced Filters</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Price Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Price Range</Text>
            {priceRanges.map((range, index) => {
              const isSelected = filters.priceRange.min === range.min && filters.priceRange.max === range.max;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.option, isSelected && styles.selectedOption]}
                  onPress={() => setPriceRange(range.min, range.max)}
                >
                  <Text style={[styles.optionText, isSelected && styles.selectedText]}>
                    {range.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={16} color="#3498DB" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Condition - Only for Products */}
          {activeTab === 'products' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Condition</Text>
              <View style={styles.chipContainer}>
                {conditions.map((condition) => {
                  const isSelected = filters.condition.includes(condition);
                  return (
                    <TouchableOpacity
                      key={condition}
                      style={[styles.chip, isSelected && styles.selectedChip]}
                      onPress={() => toggleArrayFilter('condition', condition)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
                        {condition.charAt(0).toUpperCase() + condition.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Category */}
          {categories.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Category</Text>
              <View style={styles.chipContainer}>
                {categories.map((cat) => {
                  const isSelected = filters.category.includes(cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.chip, isSelected && styles.selectedChip]}
                      onPress={() => toggleArrayFilter('category', cat.id)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location ({filteredLocationList.length})</Text>
            <TextInput
              style={styles.searchInput}
              value={locationSearch}
              onChangeText={setLocationSearch}
              placeholder="Search locations..."
              placeholderTextColor="#666"
            />
            <ScrollView 
              style={styles.locationScrollView} 
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {Object.entries(groupedLocations).map(([country, locations]) => (
                <View key={country}>
                  <Text style={styles.countryHeader}>{country}</Text>
                  <View style={styles.chipContainer}>
                    {locations.map((loc) => {
                      const locationString = `${loc.state}, ${loc.country}`;
                      const isSelected = filters.location.includes(locationString);
                      return (
                        <TouchableOpacity
                          key={loc.code}
                          style={[styles.chip, isSelected && styles.selectedChip]}
                          onPress={() => toggleArrayFilter('location', locationString)}
                        >
                          <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
                            {loc.state}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Rating */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Minimum Rating</Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <TouchableOpacity
                  key={rating}
                  style={styles.ratingOption}
                  onPress={() => updateFilters('rating', rating)}
                >
                  <View style={styles.stars}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Ionicons
                        key={i}
                        name={i < rating ? 'star' : 'star-outline'}
                        size={16}
                        color={i < rating ? '#FFD700' : '#666'}
                      />
                    ))}
                  </View>
                  <Text style={styles.ratingText}>& up</Text>
                  {filters.rating === rating && (
                    <Ionicons name="checkmark-circle" size={16} color="#3498DB" style={{ marginLeft: 8 }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Sort By */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sort By</Text>
            {sortOptions.map((sort) => {
              const isSelected = filters.sortBy === sort.value;
              return (
                <TouchableOpacity
                  key={sort.value}
                  style={[styles.option, isSelected && styles.selectedOption]}
                  onPress={() => updateFilters('sortBy', sort.value)}
                >
                  <Text style={[styles.optionText, isSelected && styles.selectedText]}>
                    {sort.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={16} color="#3498DB" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Availability */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Availability</Text>
            <View style={styles.chipContainer}>
              {availabilityOptions.map((option) => {
                const isSelected = filters.availability.includes(option);
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, isSelected && styles.selectedChip]}
                    onPress={() => toggleArrayFilter('availability', option)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Footer Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.resetButton} onPress={onReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.applyButton} onPress={onApply}>
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
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
    zIndex: 998,
  },
  dropdown: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    maxHeight: 500,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    zIndex: 999,
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
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    maxHeight: 300,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  selectedOption: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
  },
  optionText: {
    color: 'white',
    fontSize: 14,
  },
  selectedText: {
    color: '#3498DB',
    fontWeight: '600',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },
  selectedChip: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  chipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  selectedChipText: {
    color: 'white',
    fontWeight: 'bold',
  },
  ratingContainer: {
    gap: 8,
  },
  ratingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  stars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    color: 'white',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 12,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#666',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#3498DB',
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchInput: {
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: 'white',
    fontSize: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#555',
  },
  locationScrollView: {
    maxHeight: 200,
  },
  countryHeader: {
    color: '#3498DB',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
});

export default FilterDropdown;