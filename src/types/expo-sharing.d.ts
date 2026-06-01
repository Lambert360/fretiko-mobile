declare module 'expo-sharing' {
  export interface SharingOptions {
    mimeType?: string;
    UTI?: string;
    dialogTitle?: string;
  }

  export function shareAsync(url: string, options?: SharingOptions): Promise<void>;
  export function isAvailableAsync(): Promise<boolean>;
}
