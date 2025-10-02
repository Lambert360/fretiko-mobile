import { liveStreamSocket } from './liveStreamSocket';

/**
 * Live Inventory Service
 * 
 * Handles real-time inventory tracking for live sales with:
 * - Real-time stock updates
 * - Purchase queue management
 * - Stock validation
 * - Inventory alerts
 */
export class LiveInventoryService {
  private inventoryCache: Map<string, ProductInventory> = new Map();
  private purchaseQueue: Map<string, PurchaseRequest[]> = new Map();
  private callbacks: Map<string, InventoryCallback[]> = new Map();

  /**
   * Subscribe to inventory updates for a product
   */
  subscribeToProduct(streamId: string, productId: string, callback: InventoryCallback): void {
    const key = `${streamId}-${productId}`;
    
    if (!this.callbacks.has(key)) {
      this.callbacks.set(key, []);
    }
    
    this.callbacks.get(key)!.push(callback);
    
    // Setup socket listener for this product
    this.setupProductListener(streamId, productId);
    
    // Send current cached data if available
    const cached = this.inventoryCache.get(key);
    if (cached) {
      callback(cached);
    }
  }

  /**
   * Unsubscribe from inventory updates
   */
  unsubscribeFromProduct(streamId: string, productId: string, callback: InventoryCallback): void {
    const key = `${streamId}-${productId}`;
    const callbacks = this.callbacks.get(key);
    
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
      
      // Clean up if no more callbacks
      if (callbacks.length === 0) {
        this.callbacks.delete(key);
        this.inventoryCache.delete(key);
      }
    }
  }

  /**
   * Reserve stock for a purchase (temporary hold)
   */
  async reserveStock(
    streamId: string, 
    productId: string, 
    quantity: number, 
    userId: string
  ): Promise<ReservationResult> {
    try {
      const key = `${streamId}-${productId}`;
      const currentInventory = this.inventoryCache.get(key);
      
      if (!currentInventory) {
        throw new Error('Product inventory not available');
      }
      
      // Check if enough stock is available
      const availableStock = currentInventory.current_stock - currentInventory.reserved_stock;
      
      if (availableStock < quantity) {
        return {
          success: false,
          error: 'Insufficient stock',
          availableStock,
        };
      }
      
      // Create reservation
      const reservation: StockReservation = {
        id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        streamId,
        productId,
        quantity,
        userId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        status: 'active',
      };
      
      // Update local cache
      const updatedInventory = {
        ...currentInventory,
        reserved_stock: currentInventory.reserved_stock + quantity,
      };
      this.inventoryCache.set(key, updatedInventory);
      
      // Notify listeners
      this.notifyInventoryUpdate(key, updatedInventory);
      
      // Send to server via socket
      liveStreamSocket.emit('reserve_stock', {
        streamId,
        productId,
        quantity,
        reservationId: reservation.id,
      });
      
      return {
        success: true,
        reservation,
      };
    } catch (error) {
      console.error('Error reserving stock:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Confirm stock reservation (convert to sale)
   */
  async confirmReservation(reservationId: string): Promise<boolean> {
    try {
      liveStreamSocket.emit('confirm_reservation', { reservationId });
      return true;
    } catch (error) {
      console.error('Error confirming reservation:', error);
      return false;
    }
  }

  /**
   * Cancel stock reservation
   */
  async cancelReservation(reservationId: string): Promise<boolean> {
    try {
      liveStreamSocket.emit('cancel_reservation', { reservationId });
      return true;
    } catch (error) {
      console.error('Error canceling reservation:', error);
      return false;
    }
  }

  /**
   * Get current inventory for a product
   */
  getProductInventory(streamId: string, productId: string): ProductInventory | null {
    const key = `${streamId}-${productId}`;
    return this.inventoryCache.get(key) || null;
  }

  /**
   * Check if product has sufficient stock
   */
  hasStock(streamId: string, productId: string, quantity: number): boolean {
    const inventory = this.getProductInventory(streamId, productId);
    if (!inventory) return false;
    
    const availableStock = inventory.current_stock - inventory.reserved_stock;
    return availableStock >= quantity;
  }

  /**
   * Get available stock count
   */
  getAvailableStock(streamId: string, productId: string): number {
    const inventory = this.getProductInventory(streamId, productId);
    if (!inventory) return 0;
    
    return Math.max(0, inventory.current_stock - inventory.reserved_stock);
  }

  /**
   * Setup socket listener for product inventory updates
   */
  private setupProductListener(streamId: string, productId: string): void {
    const key = `${streamId}-${productId}`;
    
    // Avoid duplicate listeners
    if (this.inventoryCache.has(key)) {
      return;
    }
    
    // Listen for inventory updates
    liveStreamSocket.on('inventory_update', (data) => {
      if (data.streamId === streamId && data.productId === productId) {
        const inventory: ProductInventory = {
          streamId: data.streamId,
          productId: data.productId,
          current_stock: data.currentStock,
          reserved_stock: data.reservedStock,
          sold_count: data.soldCount,
          last_updated: new Date(data.lastUpdated),
        };
        
        this.inventoryCache.set(key, inventory);
        this.notifyInventoryUpdate(key, inventory);
      }
    });
    
    // Listen for low stock alerts
    liveStreamSocket.on('low_stock_alert', (data) => {
      if (data.streamId === streamId && data.productId === productId) {
        this.notifyLowStock(key, data.remainingStock);
      }
    });
    
    // Listen for out of stock alerts
    liveStreamSocket.on('out_of_stock', (data) => {
      if (data.streamId === streamId && data.productId === productId) {
        this.notifyOutOfStock(key);
      }
    });
    
    // Request initial inventory data
    liveStreamSocket.emit('get_inventory', { streamId, productId });
  }

  /**
   * Notify callbacks of inventory updates
   */
  private notifyInventoryUpdate(key: string, inventory: ProductInventory): void {
    const callbacks = this.callbacks.get(key);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(inventory);
        } catch (error) {
          console.error('Error in inventory callback:', error);
        }
      });
    }
  }

  /**
   * Notify callbacks of low stock
   */
  private notifyLowStock(key: string, remainingStock: number): void {
    const callbacks = this.callbacks.get(key);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          if (callback.onLowStock) {
            callback.onLowStock(remainingStock);
          }
        } catch (error) {
          console.error('Error in low stock callback:', error);
        }
      });
    }
  }

  /**
   * Notify callbacks of out of stock
   */
  private notifyOutOfStock(key: string): void {
    const callbacks = this.callbacks.get(key);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          if (callback.onOutOfStock) {
            callback.onOutOfStock();
          }
        } catch (error) {
          console.error('Error in out of stock callback:', error);
        }
      });
    }
  }

  /**
   * Clear all cached data (on disconnect)
   */
  clearCache(): void {
    this.inventoryCache.clear();
    this.purchaseQueue.clear();
    this.callbacks.clear();
  }
}

// Types
export interface ProductInventory {
  streamId: string;
  productId: string;
  current_stock: number;
  reserved_stock: number;
  sold_count: number;
  last_updated: Date;
}

export interface StockReservation {
  id: string;
  streamId: string;
  productId: string;
  quantity: number;
  userId: string;
  expiresAt: Date;
  status: 'active' | 'confirmed' | 'cancelled' | 'expired';
}

export interface ReservationResult {
  success: boolean;
  reservation?: StockReservation;
  error?: string;
  availableStock?: number;
}

export interface PurchaseRequest {
  id: string;
  productId: string;
  quantity: number;
  userId: string;
  timestamp: Date;
  priority: number;
}

export interface InventoryCallback {
  (inventory: ProductInventory): void;
  onLowStock?: (remainingStock: number) => void;
  onOutOfStock?: () => void;
}

// Export singleton instance
export const liveInventoryService = new LiveInventoryService();