/**
 * Auction Sound Service
 * Manages sound playback for live auction broadcasts
 * Uses expo-audio for React Native audio playback
 */

import React from 'react';
import { useAudioPlayer, createAudioPlayer, AudioPlayer } from 'expo-audio';
import { Asset } from 'expo-asset';
import { getCachedAssetUri, prefetchGiftAssets } from '../utils/giftAssetCache';

// Sound asset imports - using require() which Metro should resolve
// Note: These paths are relative to src/services/ -> ../../ goes to root, then assets/sounds/
const CHEER_SOUND_MODULE = require('../../assets/sounds/cheer.MP3');
const CLAPPING_SOUND_MODULE = require('../../assets/sounds/clapping.MP3');
const LAUGH_SOUND_MODULE = require('../../assets/sounds/laugh.MP3');
const TIMER_SOUND_MODULE = require('../../assets/sounds/timer.MP3');
const GAVEL_SOUND_MODULE = require('../../assets/sounds/gavel.MP3');
const CROWD_SOUND_MODULE = require('../../assets/sounds/crowd_sound.MP3');
const WINNER1_SOUND_MODULE = require('../../assets/sounds/winner1.MP3');
const WINNER2_SOUND_MODULE = require('../../assets/sounds/winner2.MP3');
const BID_SOUND_MODULE = require('../../assets/sounds/kaching.mp3');

// Module-level player for the bid sound so it can play outside the hook's
// lifecycle (e.g. auction detail screens that don't mount useAuctionSounds).
let bidSoundPlayer: AudioPlayer | null = null;

/**
 * Play the kaching sound when a new bid event arrives.
 */
export const playBidSound = () => {
  try {
    if (!bidSoundPlayer) {
      bidSoundPlayer = createAudioPlayer(BID_SOUND_MODULE);
      bidSoundPlayer.volume = 0.9;
    }
    bidSoundPlayer.seekTo(0);
    bidSoundPlayer.play();
  } catch (error) {
    console.warn('Error playing bid sound:', error);
  }
};

// =====================
// SOUNDBOARD PLAYBACK
// =====================

/**
 * Built-in soundboard slots shipped inside the app bundle. Referenced by
 * 'builtin:*' keys in the host's quick-play slots and in sound_played
 * socket payloads so every device resolves them to local assets.
 */
export const BUILTIN_SOUNDS: Record<string, { name: string; emoji: string; module: number }> = {
  'builtin:cheer': { name: 'Cheer', emoji: '🎉', module: CHEER_SOUND_MODULE },
  'builtin:clap': { name: 'Clap', emoji: '👏', module: CLAPPING_SOUND_MODULE },
  'builtin:laugh': { name: 'Laugh', emoji: '😂', module: LAUGH_SOUND_MODULE },
};

// Pooled players for soundboard playback, keyed by soundId so each sound
// gets a reusable player that works outside the hook's lifecycle (viewer
// screens receiving socket events don't mount useAuctionSounds).
const soundboardPlayers = new Map<string, AudioPlayer>();

/**
 * Play a soundboard sound by id.
 * - 'builtin:*' keys resolve to bundled assets
 * - anything else plays the remote sound_url (download-cached on first play)
 */
export const playSoundboardSound = async (soundId: string, soundUrl?: string) => {
  try {
    const builtin = BUILTIN_SOUNDS[soundId];
    const source: string | number | undefined = builtin
      ? builtin.module
      : soundUrl
        ? ((await getCachedAssetUri(soundUrl)) as string | undefined)
        : undefined;

    if (!source) {
      console.warn(`No playable source for soundboard sound: ${soundId}`);
      return;
    }

    let player = soundboardPlayers.get(soundId);
    if (!player) {
      player = createAudioPlayer(source);
      player.volume = 0.9;
      soundboardPlayers.set(soundId, player);
    } else if (!builtin && typeof source === 'string') {
      // URL may have changed for a re-uploaded sound — refresh the source
      player.replace(source);
    }

    player.seekTo(0);
    player.play();
  } catch (error) {
    console.warn('Error playing soundboard sound:', soundId, error);
  }
};

/**
 * Stop a soundboard sound mid-play (pause + rewind so it can be replayed).
 */
export const stopSoundboardSound = (soundId: string) => {
  try {
    const player = soundboardPlayers.get(soundId);
    if (player) {
      player.pause();
      player.seekTo(0);
    }
  } catch (error) {
    console.warn('Error stopping soundboard sound:', soundId, error);
  }
};

/** Stop every soundboard sound currently playing. */
export const stopAllSoundboardSounds = () => {
  soundboardPlayers.forEach((player) => {
    try {
      player.pause();
      player.seekTo(0);
    } catch {}
  });
};

/** Whether a given soundboard sound is currently playing. */
export const isSoundboardPlaying = (soundId: string) =>
  !!soundboardPlayers.get(soundId)?.playing;

/** Ids of all soundboard sounds currently playing. */
export const getPlayingSoundboardIds = (): string[] =>
  [...soundboardPlayers.entries()].filter(([, p]) => p.playing).map(([id]) => id);

/**
 * Warm the cache for remote soundboard sounds so first playback is instant.
 */
export const prefetchSoundboardSounds = async (sounds: { sound_url?: string }[]) => {
  try {
    await prefetchGiftAssets(sounds.map((s) => s.sound_url));
  } catch (error) {
    console.warn('Failed to prefetch soundboard sounds:', error);
  }
};

/**
 * Hook to use auction sound effects
 * Returns functions to play cheer, clap, and laugh sounds
 */
export const useAuctionSounds = () => {
  // State for asset URIs (loaded asynchronously)
  const [soundUris, setSoundUris] = React.useState<{
    cheer?: string;
    clap?: string;
    laugh?: string;
    timer?: string;
    gavel?: string;
    crowd?: string;
    winner1?: string;
    winner2?: string;
  }>({});

  // Load assets on mount - use lazy loading for better performance
  React.useEffect(() => {
    const loadAssets = async () => {
      try {
        // Load essential sounds first (timer, gavel, winner)
        const essentialAssets = await Asset.loadAsync([
          TIMER_SOUND_MODULE,
          GAVEL_SOUND_MODULE,
          WINNER1_SOUND_MODULE,
          WINNER2_SOUND_MODULE,
        ]);

        setSoundUris({
          timer: essentialAssets[0]?.localUri || essentialAssets[0]?.uri,
          gavel: essentialAssets[1]?.localUri || essentialAssets[1]?.uri,
          winner1: essentialAssets[2]?.localUri || essentialAssets[2]?.uri,
          winner2: essentialAssets[3]?.localUri || essentialAssets[3]?.uri,
        });

        // Load non-essential sounds in background
        setTimeout(async () => {
          try {
            const nonEssentialAssets = await Asset.loadAsync([
              CHEER_SOUND_MODULE,
              CLAPPING_SOUND_MODULE,
              LAUGH_SOUND_MODULE,
              CROWD_SOUND_MODULE,
            ]);

            setSoundUris(prev => ({
              ...prev,
              cheer: nonEssentialAssets[0]?.localUri || nonEssentialAssets[0]?.uri,
              clap: nonEssentialAssets[1]?.localUri || nonEssentialAssets[1]?.uri,
              laugh: nonEssentialAssets[2]?.localUri || nonEssentialAssets[2]?.uri,
              crowd: nonEssentialAssets[3]?.localUri || nonEssentialAssets[3]?.uri,
            }));
          } catch (error) {
            console.warn('Error loading non-essential sound assets:', error);
          }
        }, 1000); // Load after 1 second delay

      } catch (error) {
        console.error('Error loading essential sound assets:', error);
      }
    };

    loadAssets();
  }, []);

  // Create audio players for each sound effect (using URIs once loaded)
  const cheerPlayer = useAudioPlayer(soundUris.cheer || '');
  const clapPlayer = useAudioPlayer(soundUris.clap || '');
  const laughPlayer = useAudioPlayer(soundUris.laugh || '');
  const timerPlayer = useAudioPlayer(soundUris.timer || '');
  const gavelPlayer = useAudioPlayer(soundUris.gavel || '');
  const crowdPlayer = useAudioPlayer(soundUris.crowd || '');
  const winner1Player = useAudioPlayer(soundUris.winner1 || '');
  const winner2Player = useAudioPlayer(soundUris.winner2 || '');

  // Sound completion callback refs
  const timerCompleteCallbackRef = React.useRef<(() => void) | null>(null);
  const gavelCompleteCallbackRef = React.useRef<(() => void) | null>(null);
  const winnerCompleteCallbackRef = React.useRef<(() => void) | null>(null);
  
  // Track playing state to detect completion
  const timerWasPlayingRef = React.useRef<boolean>(false);
  const gavelWasPlayingRef = React.useRef<boolean>(false);
  const winnerWasPlayingRef = React.useRef<boolean>(false);

  // Fallback timeouts: if a player never reports playing (replay at EOF,
  // unloaded asset, silent failure) the poll can't detect completion, so a
  // hard timeout fires the callback instead of stalling the phase machine.
  const timerFallbackRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const gavelFallbackRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const winnerFallbackRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Configure players when they're ready (after soundUris are loaded)
  React.useEffect(() => {
    // Don't set up listeners if sound URIs aren't loaded yet
    if (!soundUris.timer || !soundUris.gavel || !soundUris.winner1 || !soundUris.winner2) {
      return;
    }

    console.log('🔊 Setting up auction sound listeners...');

    cheerPlayer.volume = 0.7;
    cheerPlayer.loop = false;
    clapPlayer.volume = 0.7;
    clapPlayer.loop = false;
    laughPlayer.volume = 0.7;
    laughPlayer.loop = false;
    timerPlayer.volume = 0.8;
    timerPlayer.loop = false;
    gavelPlayer.volume = 0.9;
    gavelPlayer.loop = false;
    crowdPlayer.volume = 0.4;
    crowdPlayer.loop = true; // Crowd sound loops
    winner1Player.volume = 0.8;
    winner1Player.loop = false;
    winner2Player.volume = 0.8;
    winner2Player.loop = false;

    // Use polling to check for completion but with reduced frequency
    const checkInterval = setInterval(() => {
      // Check timer
      if (timerPlayer.playing === false && timerWasPlayingRef.current && timerCompleteCallbackRef.current) {
        console.log('✅ Timer finished (detected via polling) - triggering callback');
        timerWasPlayingRef.current = false;
        const callback = timerCompleteCallbackRef.current;
        timerCompleteCallbackRef.current = null;
        setTimeout(() => callback(), 0);
      } else if (timerPlayer.playing) {
        timerWasPlayingRef.current = true;
      }

      // Check gavel
      if (gavelPlayer.playing === false && gavelWasPlayingRef.current && gavelCompleteCallbackRef.current) {
        console.log('✅ Gavel finished (detected via polling) - triggering callback');
        gavelWasPlayingRef.current = false;
        const callback = gavelCompleteCallbackRef.current;
        gavelCompleteCallbackRef.current = null;
        setTimeout(() => callback(), 0);
      } else if (gavelPlayer.playing) {
        gavelWasPlayingRef.current = true;
      }

      // Check winner1
      if (winner1Player.playing === false && winnerWasPlayingRef.current && winnerCompleteCallbackRef.current) {
        console.log('✅ Winner sound finished (detected via polling) - triggering callback');
        winnerWasPlayingRef.current = false;
        const callback = winnerCompleteCallbackRef.current;
        winnerCompleteCallbackRef.current = null;
        setTimeout(() => callback(), 0);
      } else if (winner1Player.playing) {
        winnerWasPlayingRef.current = true;
      }

      // Check winner2
      if (winner2Player.playing === false && winnerWasPlayingRef.current && winnerCompleteCallbackRef.current) {
        console.log('✅ Winner sound finished (detected via polling) - triggering callback');
        winnerWasPlayingRef.current = false;
        const callback = winnerCompleteCallbackRef.current;
        winnerCompleteCallbackRef.current = null;
        setTimeout(() => callback(), 0);
      } else if (winner2Player.playing) {
        winnerWasPlayingRef.current = true;
      }
    }, 250); // Reduced from 100ms to 250ms (4 times per second instead of 10)

    return () => {
      console.log('🔇 Clearing auction sound polling');
      clearInterval(checkInterval);
    };
  }, [soundUris, timerPlayer, gavelPlayer, winner1Player, winner2Player, cheerPlayer, clapPlayer, laughPlayer, crowdPlayer]);

  /**
   * Play cheer sound
   */
  const playCheer = async () => {
    try {
      // Check if player is ready and has valid URI
      if (!cheerPlayer || !soundUris.cheer) {
        console.warn('Cheer sound not loaded yet');
        return;
      }
      
      // Always seek to start and play to ensure sound can be replayed
      cheerPlayer.seekTo(0);
      cheerPlayer.play();
    } catch (error) {
      console.error('Error playing cheer sound:', error);
    }
  };

  /**
   * Play clapping sound
   */
  const playClap = async () => {
    try {
      // Check if player is ready and has valid URI
      if (!clapPlayer || !soundUris.clap) {
        console.warn('Clap sound not loaded yet');
        return;
      }
      
      // Always seek to start and play to ensure sound can be replayed
      clapPlayer.seekTo(0);
      clapPlayer.play();
    } catch (error) {
      console.error('Error playing clap sound:', error);
    }
  };

  /**
   * Play laugh sound
   */
  const playLaugh = async () => {
    try {
      // Check if player is ready and has valid URI
      if (!laughPlayer || !soundUris.laugh) {
        console.warn('Laugh sound not loaded yet');
        return;
      }
      
      // Always seek to start and play to ensure sound can be replayed
      laughPlayer.seekTo(0);
      laughPlayer.play();
    } catch (error) {
      console.error('Error playing laugh sound:', error);
    }
  };

  /**
   * Play timer sound with completion callback
   */
  const playTimer = async (onComplete?: () => void) => {
    try {
      console.log('🎬 Starting timer sound...');
      if (timerCompleteCallbackRef.current) {
        timerCompleteCallbackRef.current = null; // Clear previous callback
      }
      if (timerFallbackRef.current) {
        clearTimeout(timerFallbackRef.current);
        timerFallbackRef.current = null;
      }
      if (onComplete) {
        console.log('✅ Timer callback registered');
        timerCompleteCallbackRef.current = onComplete;
        // Hard fallback: if playback is never observed by the poll (e.g. an
        // at-EOF replay that silently ends), still fire completion so the
        // auction can't hang in 'timer_playing'.
        const durationMs =
          Number.isFinite(timerPlayer.duration) && timerPlayer.duration > 0
            ? timerPlayer.duration * 1000
            : 4000;
        timerFallbackRef.current = setTimeout(() => {
          const callback = timerCompleteCallbackRef.current;
          if (callback) {
            console.warn('⏱️ Timer completion fallback fired (playback not observed)');
            timerCompleteCallbackRef.current = null;
            timerWasPlayingRef.current = false;
            callback();
          }
        }, durationMs + 1000);
      }
      // Always rewind before playing — play() at end-of-file does not restart
      // reliably, which previously stalled the completion callback on replay.
      timerPlayer.seekTo(0);
      timerPlayer.play();
      console.log('▶️ Timer play() called');
      // Don't mark as playing here - let the statusChange listener detect when it actually starts
    } catch (error) {
      console.error('Error playing timer sound:', error);
      timerWasPlayingRef.current = false;
      timerCompleteCallbackRef.current = null;
      if (timerFallbackRef.current) {
        clearTimeout(timerFallbackRef.current);
        timerFallbackRef.current = null;
      }
      if (onComplete) onComplete();
    }
  };

  /**
   * Start playing crowd sound (loops until stopped)
   */
  const startCrowd = async () => {
    try {
      if (!crowdPlayer.playing) {
        crowdPlayer.play();
      }
    } catch (error) {
      console.error('Error starting crowd sound:', error);
    }
  };

  /**
   * Stop playing crowd sound
   */
  const stopCrowd = async () => {
    try {
      if (crowdPlayer.playing) {
        crowdPlayer.pause();
        crowdPlayer.seekTo(0);
      }
    } catch (error) {
      console.error('Error stopping crowd sound:', error);
    }
  };

  /**
   * Play gavel sound with completion callback
   */
  const playGavel = async (onComplete?: () => void) => {
    try {
      // Stop crowd sound first
      await stopCrowd();
      
      if (gavelCompleteCallbackRef.current) {
        gavelCompleteCallbackRef.current = null;
      }
      if (gavelFallbackRef.current) {
        clearTimeout(gavelFallbackRef.current);
        gavelFallbackRef.current = null;
      }
      if (onComplete) {
        gavelCompleteCallbackRef.current = onComplete;
        const durationMs =
          Number.isFinite(gavelPlayer.duration) && gavelPlayer.duration > 0
            ? gavelPlayer.duration * 1000
            : 4000;
        gavelFallbackRef.current = setTimeout(() => {
          const callback = gavelCompleteCallbackRef.current;
          if (callback) {
            console.warn('⏱️ Gavel completion fallback fired (playback not observed)');
            gavelCompleteCallbackRef.current = null;
            gavelWasPlayingRef.current = false;
            callback();
          }
        }, durationMs + 1000);
      }
      gavelPlayer.seekTo(0);
      gavelPlayer.play();
    } catch (error) {
      console.error('Error playing gavel sound:', error);
      gavelWasPlayingRef.current = false;
      gavelCompleteCallbackRef.current = null;
      if (gavelFallbackRef.current) {
        clearTimeout(gavelFallbackRef.current);
        gavelFallbackRef.current = null;
      }
      if (onComplete) onComplete();
    }
  };

  /**
   * Play winner sound based on bid amount
   * >100 Freti = winner2, ≤100 = winner1
   */
  const playWinner = async (finalBidAmount: number, onComplete?: () => void) => {
    const fireComplete = () => {
      winnerCompleteCallbackRef.current = null;
      winnerWasPlayingRef.current = false;
      if (winnerFallbackRef.current) {
        clearTimeout(winnerFallbackRef.current);
        winnerFallbackRef.current = null;
      }
      if (onComplete) onComplete();
    };

    try {
      const useWinner2 = finalBidAmount > 100;
      const player = useWinner2 ? winner2Player : winner1Player;
      const soundName = useWinner2 ? 'winner2' : 'winner1';

      // Check if sound is loaded
      if (!soundUris[soundName]) {
        console.warn(`Winner sound ${soundName} not loaded yet`);
        fireComplete();
        return;
      }

      if (winnerCompleteCallbackRef.current) {
        winnerCompleteCallbackRef.current = null;
      }
      if (winnerFallbackRef.current) {
        clearTimeout(winnerFallbackRef.current);
        winnerFallbackRef.current = null;
      }
      if (onComplete) {
        winnerCompleteCallbackRef.current = onComplete;
        const durationMs =
          Number.isFinite(player?.duration) && player.duration > 0
            ? player.duration * 1000
            : 5000;
        winnerFallbackRef.current = setTimeout(() => {
          const callback = winnerCompleteCallbackRef.current;
          if (callback) {
            console.warn('⏱️ Winner completion fallback fired (playback not observed)');
            winnerCompleteCallbackRef.current = null;
            winnerWasPlayingRef.current = false;
            callback();
          }
        }, durationMs + 1000);
      }

      // Add safety check for player state
      try {
        if (player && typeof player.seekTo === 'function' && typeof player.play === 'function') {
          player.seekTo(0);
          player.play();
        } else {
          console.warn(`Winner player ${soundName} is not properly initialized`);
          fireComplete();
        }
      } catch (playerError) {
        console.error(`Error with winner player ${soundName}:`, playerError);
        fireComplete();
      }
    } catch (error) {
      console.error('Error playing winner sound:', error);
      fireComplete();
    }
  };

  return {
    playCheer,
    playClap,
    playLaugh,
    playTimer,
    startCrowd,
    stopCrowd,
    playGavel,
    playWinner,
  };
};

