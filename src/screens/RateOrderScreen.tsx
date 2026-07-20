import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ordersAPI } from '../services/ordersAPI';
import { useNavigation, useRoute } from '@react-navigation/native';
import AdaptiveText from '../components/AdaptiveText';

interface OrderItem {
  id: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  total: number;
  vendorName?: string;
}

const RateOrderScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { orderId } = route.params as { orderId: string };

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [review, setReview] = useState('');
  const [hoveredStar, setHoveredStar] = useState(0);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const orderData = await ordersAPI.getOrderDetails(orderId);
      setOrder(orderData);
    } catch (error) {
      console.error('Error loading order:', error);
      Alert.alert('Error', 'Failed to load order details.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const getRatingDescription = (rating: number) => {
    switch (rating) {
      case 1:
        return 'Poor';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
        return 'Very Good';
      case 5:
        return 'Excellent';
      default:
        return 'Tap to rate';
    }
  };

  const getRatingEmoji = (rating: number) => {
    switch (rating) {
      case 1:
        return '😞';
      case 2:
        return '😐';
      case 3:
        return '🙂';
      case 4:
        return '😊';
      case 5:
        return '🤩';
      default:
        return '';
    }
  };

  const handleSubmit = async () => {
    if (selectedRating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating');
      return;
    }

    try {
      setSubmitting(true);

      // Rate all items in the order with the same rating
      if (order?.items) {
        for (const item of order.items) {
          await ordersAPI.rateOrderItem(orderId, item.id, selectedRating, review || undefined);
        }
      }

      Alert.alert(
        'Thank You! 🎉',
        'Your feedback helps us improve our service.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' as never }],
              });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error submitting rating:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to submit rating. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </View>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate Your Order</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Order Info */}
        <View style={styles.orderInfoCard}>
          <Text style={styles.orderNumber}>Order #{order.orderNumber}</Text>
          {order.vendorName && (
            <AdaptiveText style={styles.vendorName} baseFontSize={14} minFontSize={10} maxChars={22} numberOfLines={1}>from {order.vendorName}</AdaptiveText>
          )}
          <View style={styles.itemsPreview}>
            <Text style={styles.itemsLabel}>
              {order.items.length} item{order.items.length > 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Main Question */}
        <View style={styles.questionSection}>
          <Text style={styles.question}>How was your experience?</Text>
          <Text style={styles.subQuestion}>
            Your feedback helps us serve you better
          </Text>
        </View>

        {/* Star Rating */}
        <View style={styles.ratingSection}>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setSelectedRating(star)}
                onPressIn={() => setHoveredStar(star)}
                onPressOut={() => setHoveredStar(0)}
                style={styles.starButton}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={star <= (hoveredStar || selectedRating) ? 'star' : 'star-outline'}
                  size={56}
                  color={star <= (hoveredStar || selectedRating) ? '#FFD700' : '#444'}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Rating Text & Emoji */}
          <View style={styles.ratingFeedback}>
            <Text style={styles.ratingEmoji}>
              {getRatingEmoji(hoveredStar || selectedRating)}
            </Text>
            <Text
              style={[
                styles.ratingText,
                selectedRating > 0 && styles.ratingTextActive,
              ]}
            >
              {getRatingDescription(hoveredStar || selectedRating)}
            </Text>
          </View>
        </View>

        {/* Review Section */}
        <View style={styles.reviewSection}>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewLabel}>Tell us more</Text>
            <Text style={styles.reviewOptional}>(optional)</Text>
          </View>

          <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Share your experience with this order..."
              placeholderTextColor="#666"
              value={review}
              onChangeText={setReview}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{review.length}/500</Text>
          </View>

          {/* Suggestion Pills */}
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsLabel}>Quick feedback:</Text>
            <View style={styles.suggestionPills}>
              {[
                'Fast delivery',
                'Great quality',
                'Well packaged',
                'As described',
                'Good communication',
              ].map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestionPill}
                  onPress={() => {
                    const currentReview = review.trim();
                    const newText = currentReview
                      ? `${currentReview}, ${suggestion.toLowerCase()}`
                      : suggestion;
                    setReview(newText);
                  }}
                >
                  <Text style={styles.suggestionPillText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (selectedRating === 0 || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={selectedRating === 0 || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#FFF" />
              <Text style={styles.submitButtonText}>Submit Rating</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Skip Link */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  placeholder: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  orderInfoCard: {
    backgroundColor: '#111',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  vendorName: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  itemsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  itemsLabel: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  questionSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  question: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subQuestion: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
  },
  ratingSection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 4,
  },
  starButton: {
    padding: 8,
  },
  ratingFeedback: {
    alignItems: 'center',
    minHeight: 80,
  },
  ratingEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 20,
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
  },
  ratingTextActive: {
    color: '#FFD700',
  },
  reviewSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  reviewLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  reviewOptional: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  textInputContainer: {
    position: 'relative',
  },
  textInput: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    paddingBottom: 40,
    color: '#FFF',
    fontSize: 16,
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#222',
  },
  charCount: {
    position: 'absolute',
    right: 16,
    bottom: 12,
    fontSize: 12,
    color: '#666',
  },
  suggestionsContainer: {
    marginTop: 16,
  },
  suggestionsLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  suggestionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionPill: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  suggestionPillText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    margin: 24,
    marginTop: 32,
    padding: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#333',
    shadowOpacity: 0,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 32,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default RateOrderScreen;

