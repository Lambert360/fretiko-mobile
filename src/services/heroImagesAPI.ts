import { api } from './api';

export interface HeroImage {
  id: string;
  name: string;
  url: string;
  title?: string;
  subtitle?: string;
  action_url?: string;
  is_active: boolean;
  sort_order: number;
}

class HeroImagesAPI {
  private cache = new Map<string, { data: HeroImage[]; timestamp: number }>();
  private cacheTimeout = 15 * 60 * 1000; // 15 minutes

  // Fallback local hero images
  private localHeroImages: HeroImage[] = [
    {
      id: 'local-1',
      name: 'hero1.jpeg',
      url: require('../../assets/images/hero1.jpeg'),
      title: 'Discover Amazing Deals! 🛍️',
      subtitle: 'Shop the latest trends',
      action_url: '',
      is_active: true,
      sort_order: 1
    },
    {
      id: 'local-2', 
      name: 'hero2.jpeg',
      url: require('../../assets/images/hero2.jpeg'),
      title: 'Join the Fretiko Community! 🎉',
      subtitle: 'Connect, buy, sell, repeat',
      action_url: '',
      is_active: true,
      sort_order: 2
    },
    {
      id: 'local-3',
      name: 'hero3.jpeg', 
      url: require('../../assets/images/hero3.jpeg'),
      title: 'Power of Music Meets Shopping! 🎵',
      subtitle: 'Discover, share, connect',
      action_url: '',
      is_active: true,
      sort_order: 3
    },
    {
      id: 'local-4',
      name: 'hero4.jpeg',
      url: require('../../assets/images/hero4.jpeg'),
      title: 'Shop Smart, Save More! 💰',
      subtitle: 'Best deals, best prices',
      action_url: '',
      is_active: true, 
      sort_order: 4
    }
  ];

  async getHeroImages(): Promise<HeroImage[]> {
    const cacheKey = 'hero_images';
    
    try {
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('📦 Using cached hero images');
        return cached.data;
      }

      console.log('🌐 Fetching hero images from Supabase');
      
      // Try to get images from backend API (which connects to Supabase)
      const response = await api.get('/hero-images');
      const files = response.data;

      if (!files || files.length === 0) {
        console.log('No hero images found in storage, using local images');
        return this.localHeroImages;
      }

      // Convert API response to HeroImage objects
      const heroImages: HeroImage[] = files
        .filter((file: any) => file.name.match(/\.(jpg|jpeg|png|webp)$/i))
        .map((file: any, index: number) => ({
          id: file.id || `hero-${index}`,
          name: file.name,
          url: file.public_url || file.url,
          title: file.title || this.getTitleFromFileName(file.name),
          subtitle: file.subtitle || this.getSubtitleFromFileName(file.name),
          action_url: file.action_url || '',
          is_active: file.is_active !== false,
          sort_order: file.sort_order || index + 1
        }))
        .sort((a, b) => a.sort_order - b.sort_order);

      // Cache the results
      this.cache.set(cacheKey, { data: heroImages, timestamp: Date.now() });
      
      console.log(`✅ Loaded ${heroImages.length} hero images from Supabase`);
      return heroImages;

    } catch (error) {
      console.warn('Failed to fetch hero images from Supabase, using local fallback:', error);
      return this.localHeroImages;
    }
  }

  // Generate titles based on filename
  private getTitleFromFileName(fileName: string): string {
    const titles = [
      'Discover Amazing Deals! 🛍️',
      'Join the Fretiko Community! 🎉', 
      'Power of Music Meets Shopping! 🎵',
      'Shop Smart, Save More! 💰',
      'Trending Now! 🔥',
      'Flash Sale Alert! ⚡'
    ];
    
    const hash = fileName.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return titles[Math.abs(hash) % titles.length];
  }

  private getSubtitleFromFileName(fileName: string): string {
    const subtitles = [
      'Shop the latest trends',
      'Connect, buy, sell, repeat',
      'Discover, share, connect', 
      'Best deals, best prices',
      'Don\'t miss out on these deals',
      'Limited time offers'
    ];
    
    const hash = fileName.split('').reduce((a, b) => {
      a = ((a << 7) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return subtitles[Math.abs(hash) % subtitles.length];
  }

  // Clear cache to force refresh
  clearCache(): void {
    this.cache.clear();
  }
}

export const heroImagesAPI = new HeroImagesAPI();