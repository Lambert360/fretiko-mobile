# 📱 Fretiko Mobile App

A React Native mobile app for the Fretiko social commerce platform, built with Expo and TypeScript.

## 🚀 Features

- **Dark Theme UI** - Modern, sleek interface
- **Authentication** - Login/signup with backend integration
- **Secure Storage** - JWT tokens stored securely
- **Network Detection** - Automatic backend connection testing
- **Navigation** - Stack-based navigation with auth flow
- **State Management** - React Context for auth state

## 🏗️ Architecture

```
src/
├── config/         # API configuration
├── contexts/       # React contexts (Auth)
├── screens/        # UI screens (Login, Signup, Home)
├── services/       # API services and network logic
└── types/          # TypeScript type definitions (coming soon)
```

## ⚡ Quick Start

### 1. Prerequisites

Make sure you have:
- **Node.js** (v16 or newer)
- **Expo CLI**: `npm install -g @expo/cli`
- **Expo Go app** on your phone (iOS/Android)
- **Fretiko Backend** running (see backend README)

### 2. Install Dependencies

```bash
cd fretiko-mobile
npm install
```

### 3. Configure API Connection

**IMPORTANT:** For Expo development, you need to use your computer's IP address instead of `localhost`:

1. Find your computer's IP address:
   ```bash
   # Windows
   ipconfig
   # Look for "IPv4 Address" under your network adapter
   
   # Mac/Linux  
   ifconfig
   # Look for "inet" under your network interface (usually en0 or wlan0)
   ```

2. Update the API configuration:
   ```typescript
   // src/config/api.ts
   BASE_URL: 'http://YOUR_IP_ADDRESS:3000', // Example: 'http://192.168.1.100:3000'
   ```

### 4. Start the App

```bash
# Start Expo development server
npm start

# Or start with specific platform
npm run android  # Android
npm run ios      # iOS
```

### 5. Test on Your Phone

1. Install **Expo Go** from the App Store/Google Play
2. Scan the QR code shown in your terminal
3. The app will load on your phone

## 📱 App Screens

### Authentication Flow
- **Login Screen** - Email/password login
- **Signup Screen** - Create new account
- **Loading Screen** - While checking auth state

### Main App
- **Home Screen** - Welcome screen with user info and feature preview

## 🔧 Configuration

### API Configuration (`src/config/api.ts`)
```typescript
export const API_CONFIG = {
  BASE_URL: 'http://YOUR_IP:3000',  // Your backend server
  TIMEOUT: 10000,                   // Request timeout
};
```

### Environment Setup
The app automatically detects and handles:
- Network connectivity
- Backend connection status
- Authentication state persistence

## 🎨 UI/UX Features

- **Dark Theme** - Consistent dark mode design
- **Form Validation** - Real-time input validation
- **Loading States** - Loading indicators during API calls
- **Error Handling** - User-friendly error messages
- **Safe Areas** - Proper handling of notches and system UI

## 🔐 Security Features

- **Secure Token Storage** - JWT tokens stored in Expo SecureStore
- **Input Validation** - Client-side and server-side validation
- **Auto-logout** - Handles expired tokens
- **Network Security** - HTTPS ready for production

## 🧪 Testing Your Setup

1. **Backend Connection Test**:
   - Open the app
   - If you see connection errors, check your IP configuration
   
2. **Authentication Test**:
   - Try creating a new account
   - Sign out and sign back in
   - Check if user data persists between app restarts

## 🐛 Troubleshooting

### Common Issues:

**"Network Error" or "Connection Refused"**
- ✅ Backend server is running (`npm run start:dev` in backend folder)
- ✅ IP address is correct in `src/config/api.ts`
- ✅ Phone and computer are on the same Wi-Fi network
- ✅ Firewall isn't blocking port 3000

**"Expo CLI not found"**
```bash
npm install -g @expo/cli
```

**"Metro bundler issues"**
```bash
npx expo start --clear
```

**"App won't load on phone"**
- Update Expo Go app to latest version
- Check phone and computer are on same network
- Try restarting Expo development server

## 🎯 Next Steps

Ready to add features? Here are logical next steps:

1. **Products Screen** - Browse and search products
2. **User Profile** - Edit profile, settings
3. **Chat Features** - Real-time messaging
4. **Camera Integration** - Product photos, profile pictures
5. **Push Notifications** - Order updates, messages

## 📚 Learn More

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [React Navigation](https://reactnavigation.org/docs/getting-started)

## 🔄 Development Workflow

```bash
# Start development
npm start

# Code, test, repeat!
# Changes auto-refresh on your phone

# When ready, build for production
npx expo build:android  # Android APK
npx expo build:ios      # iOS build
```

---

**Built with ❤️ for social commerce**

**Current Status**: ✅ Authentication complete, ready for feature development!