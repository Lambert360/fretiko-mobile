import React, { useCallback } from 'react';
import { Text, TextProps } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { userAPI } from '../services/userAPI';
import { resolveInternalRoute } from '../utils/internalLinkResolver';

interface RichTextProps extends TextProps {
  children: string;
}

// Simple regex to split text into mentions, tags, links, and other chunks
// Also matches bare domains (e.g. google.com, www.google.com) so they become tappable.
const TOKEN_REGEX = /(@[A-Za-z0-9_.]{1,100}|#[A-Za-z0-9_]{1,100}|(?:https?:\/\/|fretiko:\/\/)[^\s]+|www\.[^\s]+|[a-zA-Z0-9][a-zA-Z0-9\-]*\.[a-zA-Z]{2,}(?::\d+)?(?:\/[^\s]*)?)/g;

// Trim common trailing punctuation that isn't actually part of the URL
// (e.g. "Check this out: https://fretiko.com." -> "https://fretiko.com")
const stripTrailingPunctuation = (url: string) => url.replace(/[.,!?;:)\]"']+$/, '');

export const RichText: React.FC<RichTextProps> = ({ children, style, ...rest }) => {
  const navigation = useNavigation<any>();

  const handlePressMention = useCallback(async (usernameWithAt: string) => {
    const username = usernameWithAt.slice(1); // remove @
    if (!username) return;

    try {
      const profile = await userAPI.getPublicProfileByUsername(username);
      if (profile?.id) {
        navigation.navigate('PublicProfile', { userId: profile.id, username: profile.username });
      }
    } catch (error) {
      console.error('Failed to open profile for mention', username, error);
    }
  }, [navigation]);

  const handlePressTag = useCallback((tagWithHash: string) => {
    const tag = tagWithHash.slice(1); // remove #
    if (!tag) return;

    try {
      // Navigate to Search screen with the tag as the initial query
      const initialQuery = `#${tag}`;
      const nav: any = navigation as any;
      const state = nav?.getState?.();
      const routeNames: string[] = state?.routeNames || [];

      if (routeNames.includes('Search')) {
        nav.navigate('Search', { initialQuery });
        return;
      }

      if (routeNames.includes('Main')) {
        nav.navigate('Main', { screen: 'Search', params: { initialQuery } });
        return;
      }

      const parent = nav.getParent?.();
      const parentState = parent?.getState?.();
      const parentRouteNames: string[] = parentState?.routeNames || [];

      if (parentRouteNames.includes('Search')) {
        parent.navigate('Search', { initialQuery });
      } else if (parentRouteNames.includes('Main')) {
        parent.navigate('Main', { screen: 'Search', params: { initialQuery } });
      } else {
        console.warn('RichText: No navigator found for Search screen');
      }
    } catch (error) {
      console.error('Failed to navigate to tag search', tag, error);
    }
  }, [navigation]);

  const handlePressLink = useCallback((rawUrl: string) => {
    let url = stripTrailingPunctuation(rawUrl);

    // Add a scheme silently if the user typed a bare domain (e.g. google.com or www.google.com).
    // This keeps the displayed text unchanged while making the link tappable.
    if (!/^https?:\/\//i.test(url) && !/^fretiko:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    // Links to routes the app already renders natively (e.g. fretiko.com/product/:id)
    // should navigate straight there instead of loading the web page.
    const internalRoute = resolveInternalRoute(url);
    if (internalRoute) {
      (navigation as any).navigate(internalRoute.screen, internalRoute.params);
      return;
    }

    // Everything else opens in the in-app browser, same as the wallet deposit flow.
    WebBrowser.openBrowserAsync(url).catch((error) => {
      console.error('Failed to open link', url, error);
    });
  }, [navigation]);

  const renderContent = () => {
    if (!children) return null;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    children.replace(TOKEN_REGEX, (match, _token, offset) => {
      if (offset > lastIndex) {
        const textBefore = children.slice(lastIndex, offset);
        if (textBefore.length > 0) {
          parts.push(
            <Text key={`${lastIndex}-text`} style={style}>
              {textBefore}
            </Text>
          );
        }
      }

      const key = `${offset}-${match}`;

      if (match.startsWith('@')) {
        parts.push(
          <Text
            key={key}
            style={[style, { color: '#4DA3FF', fontWeight: '600' }]}
            onPress={() => handlePressMention(match)}
          >
            {match}
          </Text>
        );
      } else if (match.startsWith('#')) {
        parts.push(
          <Text
            key={key}
            style={[style, { color: '#FFB347', fontWeight: '600' }]}
            onPress={() => handlePressTag(match)}
          >
            {match}
          </Text>
        );
      } else if (/^(?:https?:\/\/|fretiko:\/\/|www\.)/i.test(match) || /\.[a-zA-Z]{2,}/.test(match)) {
        parts.push(
          <Text
            key={key}
            style={[style, { color: '#4DA3FF', textDecorationLine: 'underline' }]}
            onPress={() => handlePressLink(match)}
          >
            {match}
          </Text>
        );
      }

      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < children.length) {
      const tail = children.slice(lastIndex);
      if (tail.length > 0) {
        parts.push(
          <Text key={`${lastIndex}-tail`} style={style}>
            {tail}
          </Text>
        );
      }
    }

    return parts;
  };

  return (
    <Text {...rest} style={style}>
      {renderContent()}
    </Text>
  );
};

export default RichText;
