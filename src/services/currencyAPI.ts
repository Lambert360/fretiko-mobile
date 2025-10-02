import { api } from './api';

export interface ExchangeRate {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  lastUpdated: string;
  source: string;
}

export interface CurrencyConversion {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  timestamp: string;
}

export interface SupportedCurrencies {
  currencies: string[];
}

class CurrencyAPI {
  private exchangeRateCache = new Map<string, { rate: ExchangeRate; expiry: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get exchange rate from USD to target currency
   */
  async getExchangeRate(targetCurrency: string): Promise<ExchangeRate> {
    const cacheKey = `USD_${targetCurrency}`;
    const cached = this.exchangeRateCache.get(cacheKey);
    
    // Return cached rate if still valid
    if (cached && Date.now() < cached.expiry) {
      return cached.rate;
    }

    try {
      const response = await api.get(`/exchange-rates/rate?target=${targetCurrency}`);
      const rate = response.data;
      
      // Cache the result
      this.exchangeRateCache.set(cacheKey, {
        rate,
        expiry: Date.now() + this.CACHE_DURATION
      });
      
      return rate;
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      throw error;
    }
  }

  /**
   * Get multiple exchange rates at once
   */
  async getMultipleRates(currencies: string[]): Promise<Record<string, ExchangeRate>> {
    try {
      const currencyParam = currencies.join(',');
      const response = await api.get(`/exchange-rates/rates?currencies=${currencyParam}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching multiple exchange rates:', error);
      throw error;
    }
  }

  /**
   * Convert between any two currencies
   */
  async convertCurrency(
    fromCurrency: string,
    toCurrency: string,
    amount: number
  ): Promise<CurrencyConversion> {
    try {
      const response = await api.get(
        `/exchange-rates/convert?from=${fromCurrency}&to=${toCurrency}&amount=${amount}`
      );
      return response.data;
    } catch (error) {
      console.error('Error converting currency:', error);
      throw error;
    }
  }

  /**
   * Convert Freti to local currency
   */
  async convertFretiToLocal(fretiAmount: number, localCurrency: string): Promise<CurrencyConversion> {
    try {
      const response = await api.get(
        `/exchange-rates/freti-to-local?amount=${fretiAmount}&currency=${localCurrency}`
      );
      return response.data;
    } catch (error) {
      console.error('Error converting Freti to local:', error);
      throw error;
    }
  }

  /**
   * Convert local currency to Freti
   */
  async convertLocalToFreti(localAmount: number, localCurrency: string): Promise<CurrencyConversion> {
    try {
      const response = await api.get(
        `/exchange-rates/local-to-freti?amount=${localAmount}&currency=${localCurrency}`
      );
      return response.data;
    } catch (error) {
      console.error('Error converting local to Freti:', error);
      throw error;
    }
  }

  /**
   * Get list of supported currencies
   */
  async getSupportedCurrencies(): Promise<SupportedCurrencies> {
    try {
      const response = await api.get('/exchange-rates/supported');
      return response.data;
    } catch (error) {
      console.error('Error fetching supported currencies:', error);
      throw error;
    }
  }

  /**
   * Real-time conversion for dual currency inputs
   * This is optimized for UI responsiveness with caching
   */
  async quickConvert(
    fromCurrency: string,
    toCurrency: string,
    amount: number,
    useCache: boolean = true
  ): Promise<number> {
    if (amount === 0 || isNaN(amount)) return 0;
    if (fromCurrency === toCurrency) return amount;

    try {
      // For Freti conversions, we can optimize
      if (fromCurrency === 'FRETI' && toCurrency !== 'USD') {
        // Freti -> Local: Convert via USD (1 Freti = 1 USD)
        const rate = await this.getExchangeRate(toCurrency);
        return Math.round((amount * rate.rate) * 100) / 100;
      } else if (toCurrency === 'FRETI' && fromCurrency !== 'USD') {
        // Local -> Freti: Convert via USD
        const rate = await this.getExchangeRate(fromCurrency);
        return Math.round((amount / rate.rate) * 100) / 100;
      } else if (fromCurrency === 'FRETI' && toCurrency === 'USD') {
        // Freti to USD is 1:1
        return amount;
      } else if (fromCurrency === 'USD' && toCurrency === 'FRETI') {
        // USD to Freti is 1:1
        return amount;
      } else {
        // General conversion
        const conversion = await this.convertCurrency(fromCurrency, toCurrency, amount);
        return conversion.toAmount;
      }
    } catch (error) {
      console.error(`Quick convert error (${fromCurrency} -> ${toCurrency}):`, error);
      return 0;
    }
  }

  /**
   * Format currency amount with proper symbol and decimals
   */
  formatCurrency(amount: number, currency: string): string {
    const currencySymbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'NGN': '₦',
      'FRETI': '₣',
      'CAD': 'C$',
      'AUD': 'A$'
    };

    const symbol = currencySymbols[currency] || currency;
    const decimals = currency === 'FRETI' ? 2 : (currency === 'NGN' ? 0 : 2);
    
    return `${symbol}${amount.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })}`;
  }

  /**
   * Get currency symbol
   */
  getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'NGN': '₦',
      'FRETI': '₣',
      'CAD': 'C$',
      'AUD': 'A$'
    };
    return symbols[currency] || currency;
  }

  /**
   * Clear local cache
   */
  clearCache(): void {
    this.exchangeRateCache.clear();
  }
}

export const currencyAPI = new CurrencyAPI();