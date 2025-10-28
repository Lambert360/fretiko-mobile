import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * GridCardActionModal Component
 *
 * Purpose: Display action options when user long-presses a grid card
 *
 * What it does:
 * - Shows a modal with action buttons (View, Delete)
 * - Handles view and delete actions
 * - Dismisses when user taps outside or on cancel
 *
 * What's needed to use it:
 * - visible: Boolean to control modal visibility
 * - onClose: Function to close the modal
 * - onView: Function to navigate to details screen
 * - onDelete: Function to delete the item
 * - itemType: String ("product" or "service") for better messaging
 */

interface GridCardActionModalProps {
  visible: boolean;
  onClose: () => void;
  onView: () => void;
  onDelete: () => void;
  itemType: 'product' | 'service';
}

export const GridCardActionModal: React.FC<GridCardActionModalProps> = ({
  visible,
  onClose,
  onView,
  onDelete,
  itemType,
}) => {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {itemType === 'product' ? 'Product Options' : 'Service Options'}
              </Text>

              {/* View Option */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onView}
                activeOpacity={0.7}
              >
                <Ionicons name="eye-outline" size={24} color="#007AFF" />
                <Text style={styles.actionText}>View Details</Text>
              </TouchableOpacity>

              {/* Delete Option */}
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={onDelete}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
              </TouchableOpacity>

              {/* Cancel Button */}
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#333',
    borderRadius: 12,
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  actionText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 16,
    fontWeight: '500',
  },
  deleteText: {
    color: '#FF3B30',
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
});
