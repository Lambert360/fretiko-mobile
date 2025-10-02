import { useState, useEffect, useCallback } from 'react';
import { 
  liveInventoryService, 
  ProductInventory, 
  ReservationResult,
  StockReservation 
} from '../services/liveInventoryService';
import { useAuth } from '../contexts/AuthContext';

/**
 * React Hook for Live Inventory Management
 * 
 * Provides real-time inventory tracking with:
 * - Current stock levels
 * - Stock reservation
 * - Low stock alerts
 * - Purchase validation
 */
export const useLiveInventory = (streamId: string, productId: string) => {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<ProductInventory | null>(null);
  const [isLowStock, setIsLowStock] = useState(false);
  const [isOutOfStock, setIsOutOfStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentReservation, setCurrentReservation] = useState<StockReservation | null>(null);

  // Inventory callback
  const inventoryCallback = useCallback((newInventory: ProductInventory) => {
    setInventory(newInventory);
    setLoading(false);
    
    // Check stock levels
    const availableStock = newInventory.current_stock - newInventory.reserved_stock;
    setIsOutOfStock(availableStock <= 0);
    setIsLowStock(availableStock > 0 && availableStock <= 5); // Low stock threshold
  }, []);

  // Enhanced callback with alerts
  const enhancedCallback = useCallback((newInventory: ProductInventory) => {
    inventoryCallback(newInventory);
  }, [inventoryCallback]);

  // Add alert handlers
  enhancedCallback.onLowStock = useCallback((remainingStock: number) => {
    setIsLowStock(true);
    console.log(`Low stock alert: ${remainingStock} items remaining`);
  }, []);

  enhancedCallback.onOutOfStock = useCallback(() => {
    setIsOutOfStock(true);
    console.log('Product is now out of stock');
  }, []);

  // Subscribe to inventory updates
  useEffect(() => {
    if (streamId && productId) {
      liveInventoryService.subscribeToProduct(streamId, productId, enhancedCallback);
      
      return () => {
        liveInventoryService.unsubscribeFromProduct(streamId, productId, enhancedCallback);
      };
    }
  }, [streamId, productId, enhancedCallback]);

  // Reserve stock for purchase
  const reserveStock = useCallback(async (quantity: number): Promise<ReservationResult> => {
    if (!user?.id) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    try {
      const result = await liveInventoryService.reserveStock(
        streamId, 
        productId, 
        quantity, 
        user.id
      );
      
      if (result.success && result.reservation) {
        setCurrentReservation(result.reservation);
        
        // Auto-expire reservation after timeout
        setTimeout(() => {
          if (currentReservation?.id === result.reservation!.id) {
            cancelReservation();
          }
        }, 5 * 60 * 1000); // 5 minutes
      }
      
      return result;
    } catch (error) {
      console.error('Error reserving stock:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [streamId, productId, user?.id, currentReservation]);

  // Confirm reservation (complete purchase)
  const confirmReservation = useCallback(async (): Promise<boolean> => {
    if (!currentReservation) return false;
    
    try {
      const success = await liveInventoryService.confirmReservation(currentReservation.id);
      if (success) {
        setCurrentReservation(null);
      }
      return success;
    } catch (error) {
      console.error('Error confirming reservation:', error);
      return false;
    }
  }, [currentReservation]);

  // Cancel reservation
  const cancelReservation = useCallback(async (): Promise<boolean> => {
    if (!currentReservation) return false;
    
    try {
      const success = await liveInventoryService.cancelReservation(currentReservation.id);
      if (success) {
        setCurrentReservation(null);
      }
      return success;
    } catch (error) {
      console.error('Error canceling reservation:', error);
      return false;
    }
  }, [currentReservation]);

  // Check if quantity is available
  const canPurchase = useCallback((quantity: number): boolean => {
    return liveInventoryService.hasStock(streamId, productId, quantity);
  }, [streamId, productId]);

  // Get available stock count
  const availableStock = inventory 
    ? Math.max(0, inventory.current_stock - inventory.reserved_stock)
    : 0;

  // Get total sold count
  const soldCount = inventory?.sold_count || 0;

  // Check if reservation is active
  const hasActiveReservation = currentReservation !== null;

  // Get reservation time remaining
  const reservationTimeRemaining = currentReservation
    ? Math.max(0, currentReservation.expiresAt.getTime() - Date.now())
    : 0;

  return {
    // State
    inventory,
    loading,
    isLowStock,
    isOutOfStock,
    availableStock,
    soldCount,
    
    // Reservation
    currentReservation,
    hasActiveReservation,
    reservationTimeRemaining,
    
    // Actions
    reserveStock,
    confirmReservation,
    cancelReservation,
    canPurchase,
    
    // Computed
    isAvailable: availableStock > 0,
    stockPercentage: inventory 
      ? (availableStock / (inventory.current_stock || 1)) * 100 
      : 0,
  };
};

/**
 * Hook for tracking multiple products in a stream
 */
export const useStreamInventory = (streamId: string, productIds: string[]) => {
  const [inventories, setInventories] = useState<Map<string, ProductInventory>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let loadedCount = 0;
    const callbacks = new Map<string, any>();

    // Subscribe to each product
    productIds.forEach(productId => {
      const callback = (inventory: ProductInventory) => {
        setInventories(prev => {
          const newMap = new Map(prev);
          newMap.set(productId, inventory);
          return newMap;
        });
        
        loadedCount++;
        if (loadedCount >= productIds.length) {
          setLoading(false);
        }
      };
      
      callbacks.set(productId, callback);
      liveInventoryService.subscribeToProduct(streamId, productId, callback);
    });

    return () => {
      // Cleanup subscriptions
      productIds.forEach(productId => {
        const callback = callbacks.get(productId);
        if (callback) {
          liveInventoryService.unsubscribeFromProduct(streamId, productId, callback);
        }
      });
    };
  }, [streamId, productIds]);

  // Get inventory for specific product
  const getInventory = useCallback((productId: string): ProductInventory | null => {
    return inventories.get(productId) || null;
  }, [inventories]);

  // Get available stock for specific product
  const getAvailableStock = useCallback((productId: string): number => {
    const inventory = inventories.get(productId);
    return inventory 
      ? Math.max(0, inventory.current_stock - inventory.reserved_stock)
      : 0;
  }, [inventories]);

  // Check if any products are low on stock
  const hasLowStock = Array.from(inventories.values()).some(inventory => {
    const available = inventory.current_stock - inventory.reserved_stock;
    return available > 0 && available <= 5;
  });

  // Check if any products are out of stock
  const hasOutOfStock = Array.from(inventories.values()).some(inventory => {
    const available = inventory.current_stock - inventory.reserved_stock;
    return available <= 0;
  });

  return {
    inventories,
    loading,
    hasLowStock,
    hasOutOfStock,
    getInventory,
    getAvailableStock,
    totalProducts: productIds.length,
    loadedProducts: inventories.size,
  };
};