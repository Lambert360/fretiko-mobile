import * as Linking from 'expo-linking';

// Deep linking configuration.
// Extracted from App.tsx into its own module so it can be safely imported by
// deeply-nested components (e.g. RichText's internal link resolver) without
// creating a circular dependency on App.tsx.
export const linking: any = {
  prefixes: [
    Linking.createURL('/'),
    'fretiko://',
    'https://www.fretiko.com',
    'http://www.fretiko.com',
    'https://fretiko.com',
    'http://fretiko.com',
  ],
  config: {
    screens: {
      EmailVerification: {
        path: 'auth/callback',
        parse: {
          token: (token: string) => token,
          email: (email: string) => email,
        },
      },
      Main: {
        screens: {
          Stories: 'stories',
        },
      },
      StoryDeepLink: {
        path: 'story/:storyId',
        parse: {
          storyId: (storyId: string) => storyId,
        },
      },
      GiftCardDetails: {
        path: 'gift-cards/claim/:claimCode',
        parse: {
          claimCode: (claimCode: string) => claimCode,
        },
      },
      WalletDeposit: {
        path: 'wallet/deposit/callback',
        parse: {
          deposit_id: (deposit_id: string) => deposit_id,
        },
        screens: {
          Main: 'Wallet', // Navigate to Wallet screen instead of WalletDeposit
        },
      },
      SharedWishlist: {
        path: 'wishlist/:ownerId/:ownerUsername',
        parse: {
          ownerId: (ownerId: string) => ownerId,
          ownerUsername: (ownerUsername: string) => decodeURIComponent(ownerUsername),
        },
      },
      ShareStory: 'share-story',
      Workspace: 'workspace',
      Analytics: 'analytics',
      OrderLinkHandler: {
        path: 'order/:orderId',
        parse: {
          orderId: (orderId: string) => orderId,
        },
      },
      PostDetails: {
        path: 'post/:postId',
        parse: {
          postId: (postId: string) => postId,
        },
      },
      PublicProfile: {
        path: 'profile/:userId',
        parse: {
          userId: (userId: string) => userId,
        },
      },
      ProductDetails: {
        path: 'product/:productId',
        parse: {
          productId: (productId: string) => productId,
        },
      },
      ServiceDetails: {
        path: 'service/:serviceId',
        parse: {
          serviceId: (serviceId: string) => serviceId,
        },
      },
      AuctionDetails: {
        path: 'auction/:auctionId',
        parse: {
          auctionId: (auctionId: string) => auctionId,
        },
      },
      LiveStreamViewer: {
        path: 'live/:streamId',
        parse: {
          streamId: (streamId: string) => streamId,
        },
      },
      ReferralHandler: {
        path: 'r/:referralCode',
        parse: {
          referralCode: (referralCode: string) => referralCode,
        },
      },
    },
  },
};
