/**
 * Base64 polyfill for React Native
 * Provides atob and btoa functions if they're not available
 */

// Check if btoa and atob are available, if not, add polyfill
if (typeof global.btoa === 'undefined') {
  global.btoa = (str: string): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let result = '';
    let i = 0;

    do {
      const a = str.charCodeAt(i++);
      const b = str.charCodeAt(i++);
      const c = str.charCodeAt(i++);

      const bitmap = (a << 16) | (b << 8) | c;

      result += chars.charAt((bitmap >> 18) & 63) +
                chars.charAt((bitmap >> 12) & 63) +
                chars.charAt((bitmap >> 6) & 63) +
                chars.charAt(bitmap & 63);
    } while (i < str.length);

    const paddingLength = str.length % 3;
    return paddingLength ? result.slice(0, paddingLength - 3) + '==='.substring(paddingLength) : result;
  };
}

if (typeof global.atob === 'undefined') {
  global.atob = (str: string): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let result = '';
    let i = 0;

    str = str.replace(/[^A-Za-z0-9+/]/g, '');

    do {
      const encoded1 = chars.indexOf(str.charAt(i++));
      const encoded2 = chars.indexOf(str.charAt(i++));
      const encoded3 = chars.indexOf(str.charAt(i++));
      const encoded4 = chars.indexOf(str.charAt(i++));

      const bitmap = (encoded1 << 18) | (encoded2 << 12) | (encoded3 << 6) | encoded4;

      result += String.fromCharCode((bitmap >> 16) & 255);
      if (encoded3 !== 64) {
        result += String.fromCharCode((bitmap >> 8) & 255);
      }
      if (encoded4 !== 64) {
        result += String.fromCharCode(bitmap & 255);
      }
    } while (i < str.length);

    return result;
  };
}

// Also add them to the global scope for TypeScript
declare global {
  function btoa(str: string): string;
  function atob(str: string): string;
}

console.log('✅ Base64 polyfill loaded');