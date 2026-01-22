# 📱 Push Notifications Implementation Guide

## Overview

This document describes the complete push notification system implementation for the Fretiko mobile app. The system uses Expo Notifications for delivering real-time updates to users about orders, messages, deliveries, payments, and other important events.

## Architecture

### Components

1. **Push Notification Service** (`src/services/pushNotificationService.ts`)
   - Handles permission requests
   - Manages Expo push tokens
   - Sets up notification listeners
   - Configures Android notification channels
   - Provides helper methods for local notifications

2. **Notifications API** (`src/services/notificationsAPI.ts`)
   - Registers/unregisters push tokens with backend
   - Manages user notification preferences
   - Fetches notification history

3. **Auth Context Integration** (`src/contexts/AuthContext.tsx`)
   - Automatically registers push tokens on user login
   - Unregisters tokens on logout

4. **App-Level Handlers** (`App.tsx`)
   - Configures notification channels (Android)
   - Sets up notification listeners
   - Handles deep linking from notifications

5. **Notification Settings UI** (`src/screens/NotificationSettingsScreen.tsx`)
   - Allows users to manage notification preferences
   - Test notification functionality
   - View notification status

## Flow Diagram

```
┌─────────────────┐
│  User Login     │
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│ Request Permissions      │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Get Expo Push Token      │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Register Token with      │
│ Backend API              │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Backend Sends            │
│ Notification via Expo    │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Expo Delivers to Device  │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ App Handles Notification │
│ - Show alert (foreground)│
│ - Navigate (tap)         │
└──────────────────────────┘
```

## Installation

### 1. Install Dependencies

```bash
cd fretiko-mobile
npm install
```

The following packages are already added to `package.json`:
- `expo-notifications@~0.29.14`

### 2. Configure `app.json`

Already configured with:
- iOS permissions (`NSUserNotificationsUsageDescription`)
- Android permissions (`POST_NOTIFICATIONS`)
- Notification plugin with custom icon and color
- Background modes for iOS

### 3. Build Development Client

Push notifications require a custom development build (not Expo Go):

```bash
# iOS
npx eas build --profile development --platform ios

# Android
npx eas build --profile development --platform android
```

### 4. Set up Expo Push Notification Credentials

For production, you need to configure push notification credentials in your Expo account:

#### iOS (APNs - Apple Push Notification service)
1. Go to https://expo.dev
2. Navigate to your project
3. Go to "Credentials" → "iOS" → "Push Notifications"
4. Follow the instructions to upload your APNs key or certificate

#### Android (FCM - Firebase Cloud Messaging)
1. Create a Firebase project at https://console.firebase.google.com
2. Add an Android app to your Firebase project
3. Download `google-services.json` and place it in `fretiko-mobile/`
4. Upload your FCM server key to Expo:
   - Go to https://expo.dev
   - Navigate to your project
   - Go to "Credentials" → "Android" → "Push Notifications"
   - Add your FCM server key

## Usage

### For Users

#### Enabling Notifications
1. Open the app
2. Go to Settings → Notification Settings
3. Tap "Enable Push Notifications"
4. Grant permissions when prompted

#### Managing Preferences
Users can toggle notifications for:
- Orders (status updates)
- Messages (new chats)
- Delivery (rider updates)
- Payments (wallet changes)
- Social (connections)
- Live Events (streams, auctions)
- System (important updates)
- Marketing (promotions)

### For Developers

#### Sending Notifications from Backend

```typescript
// Example: Sending a push notification via Expo API
const sendPushNotification = async (expoPushToken: string, title: string, body: string, data: any) => {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
    channelId: 'fretiko_orders', // Android channel
  };

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
};
```

#### Notification Data Payload

Each notification should include a `data` object with routing information:

```typescript
{
  type: 'order_status' | 'message' | 'delivery_update' | 'payment_received' | 'connection_request' | 'live_stream_started' | 'auction_update',
  orderId?: string,
  conversationId?: string,
  messageId?: string,
  userId?: string,
  auctionId?: string,
  streamId?: string,
  // ... other relevant fields
}
```

#### Notification Types

| Type | Description | Navigation |
|------|-------------|------------|
| `order_status` | Order status changes | `GroupedOrder` screen |
| `order_update` | General order updates | `GroupedOrder` screen |
| `message` | New messages | `IndividualChat` screen |
| `new_message` | New message received | `IndividualChat` screen |
| `delivery_update` | Delivery status changes | `OrderTracking` screen |
| `rider_assigned` | Rider assigned to order | `OrderTracking` screen |
| `payment_received` | Payment successful | `Wallet` screen |
| `wallet_update` | Wallet balance changed | `Wallet` screen |
| `connection_request` | New connection request | `ConnectionRequests` screen |
| `live_stream_started` | Live stream began | `LiveStreamViewer` screen |
| `auction_update` | Auction status changed | `AuctionDetails` screen |
| `auction_won` | User won an auction | `AuctionDetails` screen |

#### Testing Notifications

##### Local Notifications
```typescript
import { pushNotificationService } from './src/services/pushNotificationService';

// Schedule a test notification
await pushNotificationService.scheduleLocalNotification(
  'Test Title',
  'Test Body',
  { type: 'test' },
  5 // seconds
);
```

##### From Expo Dashboard
1. Go to https://expo.dev/notifications
2. Enter your Expo push token
3. Compose a test notification
4. Send

##### Using Expo Push Tool
```bash
curl -H "Content-Type: application/json" -X POST "https://exp.host/--/api/v2/push/send" -d '{
  "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "title":"Test Notification",
  "body": "This is a test notification",
  "data": { "type": "test" }
}'
```

## Android Notification Channels

The app configures the following notification channels for Android:

| Channel ID | Importance | Description |
|------------|------------|-------------|
| `fretiko_orders` | HIGH | Order updates |
| `fretiko_messages` | HIGH | New messages |
| `fretiko_delivery` | MAX | Delivery updates |
| `fretiko_payments` | HIGH | Payment updates |
| `fretiko_social` | DEFAULT | Social interactions |
| `fretiko_live` | HIGH | Live events |
| `fretiko_system` | DEFAULT | System updates |
| `fretiko_general` | DEFAULT | General notifications |

Users can customize channel settings in Android Settings → Apps → Fretiko → Notifications.

## Backend Integration

### Required Endpoints

The backend must implement the following endpoints:

#### 1. Register Push Token
```
POST /api/notifications/register-push-token
Headers: Authorization: Bearer <token>
Body: {
  "push_token": "ExponentPushToken[...]",
  "device_type": "ios" | "android"
}
```

#### 2. Unregister Push Token
```
POST /api/notifications/unregister-push-token
Headers: Authorization: Bearer <token>
Body: {
  "push_token": "ExponentPushToken[...]"
}
```

#### 3. Get User Preferences
```
GET /api/notifications/preferences
Headers: Authorization: Bearer <token>
Response: {
  "orders": true,
  "messages": true,
  "delivery": true,
  "payments": true,
  "social": false,
  "live_events": true,
  "system": true,
  "marketing": false
}
```

#### 4. Update User Preferences
```
PUT /api/notifications/preferences
Headers: Authorization: Bearer <token>
Body: {
  "orders": true,
  "messages": false,
  // ... other preferences
}
```

#### 5. Send Notification (Backend internal)
When an event occurs (new order, message, etc.), the backend should:
1. Look up the user's push token(s) from the database
2. Check user's notification preferences
3. If enabled, send push notification via Expo API

### Database Schema

#### push_tokens table
```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  device_type TEXT CHECK (device_type IN ('ios', 'android')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, push_token)
);

CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX idx_push_tokens_push_token ON push_tokens(push_token);
```

#### notification_preferences table
```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  orders BOOLEAN DEFAULT TRUE,
  messages BOOLEAN DEFAULT TRUE,
  delivery BOOLEAN DEFAULT TRUE,
  payments BOOLEAN DEFAULT TRUE,
  social BOOLEAN DEFAULT FALSE,
  live_events BOOLEAN DEFAULT TRUE,
  system BOOLEAN DEFAULT TRUE,
  marketing BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);
```

## Troubleshooting

### Issue: No push token generated
**Cause**: Running on simulator/emulator
**Solution**: Push notifications only work on physical devices. Build and install on a real device.

### Issue: Notifications not received
**Possible causes**:
1. Permissions not granted
   - Check device settings
   - Re-request permissions via Notification Settings screen
2. Push token not registered
   - Check logs for registration errors
   - Verify backend is storing the token
3. Backend not sending notifications
   - Check backend logs
   - Verify Expo API calls are successful
4. Expo credentials not configured
   - Verify APNs/FCM setup in Expo dashboard

### Issue: App crashes when notification received
**Cause**: Malformed notification data
**Solution**: Ensure notification data matches expected payload structure

### Issue: Deep linking not working
**Cause**: Navigation ref not available or incorrect screen name
**Solution**: Verify screen names in `App.tsx` match navigation definitions

## Best Practices

### 1. Respect User Preferences
Always check if the user has enabled notifications for a specific category before sending.

### 2. Meaningful Notifications
- Use clear, concise titles and bodies
- Include actionable information
- Avoid spamming users with too many notifications

### 3. Proper Data Payload
Always include:
- `type`: Notification type for routing
- Relevant IDs (orderId, conversationId, etc.)
- Any context needed for deep linking

### 4. Error Handling
- Handle token registration failures gracefully
- Log errors for debugging
- Don't block user flow if notifications fail

### 5. Testing
- Test on both iOS and Android physical devices
- Test foreground and background scenarios
- Test notification taps and deep linking
- Test with notifications disabled

### 6. Rate Limiting
- Implement rate limiting on backend to prevent spam
- Group similar notifications (e.g., "5 new messages" instead of 5 separate notifications)

### 7. Timely Delivery
- Send notifications immediately for time-sensitive events (delivery updates)
- Batch less urgent notifications (marketing)

## Security Considerations

1. **Token Security**
   - Store push tokens securely in backend database
   - Use HTTPS for all API calls
   - Invalidate tokens on logout

2. **Data Privacy**
   - Don't include sensitive information in notification body
   - Use notification data payload for routing only
   - Fetch sensitive data after app opens

3. **User Consent**
   - Always request permission before sending notifications
   - Allow users to opt-out of specific categories
   - Respect "Do Not Disturb" settings

## Performance Optimization

1. **Batch Token Registration**
   - Register token only once on login
   - Cache token to avoid repeated API calls

2. **Efficient Listeners**
   - Set up listeners once in App.tsx
   - Clean up listeners on unmount
   - Avoid duplicate subscriptions

3. **Background Processing**
   - Handle notification data processing efficiently
   - Avoid heavy computations in notification handlers

## Future Enhancements

1. **Rich Notifications**
   - Add images, videos, and action buttons
   - Implement notification categories with custom actions

2. **Notification History**
   - Store notification history in local database
   - Allow users to view past notifications

3. **Smart Notifications**
   - Use ML to determine optimal notification times
   - Predict user engagement and adjust frequency

4. **In-App Notification Center**
   - Create a dedicated screen for all notifications
   - Mark as read/unread functionality

5. **Notification Analytics**
   - Track notification open rates
   - Measure engagement by category
   - A/B test notification content

## Resources

- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Push Notifications Guide](https://docs.expo.dev/push-notifications/overview/)
- [Apple Push Notification Service](https://developer.apple.com/documentation/usernotifications)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)

## Support

For issues or questions:
1. Check logs in the app for errors
2. Review this documentation
3. Check Expo forums: https://forums.expo.dev
4. Contact the development team

---

**Last Updated**: January 2026
**Version**: 1.0.0
**Maintainer**: Fretiko Development Team

