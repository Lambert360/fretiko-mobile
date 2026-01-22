/**
 * Auction Sound Service
 * Manages sound playback for live auction broadcasts
 * Uses expo-audio for React Native audio playback
 */

import React from 'react';
import { useAudioPlayer } from 'expo-audio';
import { Asset } from 'expo-asset';

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

  // Load assets on mount
  React.useEffect(() => {
    const loadAssets = async () => {
      try {
        const assets = await Asset.loadAsync([
          CHEER_SOUND_MODULE,
          CLAPPING_SOUND_MODULE,
          LAUGH_SOUND_MODULE,
          TIMER_SOUND_MODULE,
          GAVEL_SOUND_MODULE,
          CROWD_SOUND_MODULE,
          WINNER1_SOUND_MODULE,
          WINNER2_SOUND_MODULE,
        ]);

        setSoundUris({
          cheer: assets[0]?.localUri || assets[0]?.uri,
          clap: assets[1]?.localUri || assets[1]?.uri,
          laugh: assets[2]?.localUri || assets[2]?.uri,
          timer: assets[3]?.localUri || assets[3]?.uri,
          gavel: assets[4]?.localUri || assets[4]?.uri,
          crowd: assets[5]?.localUri || assets[5]?.uri,
          winner1: assets[6]?.localUri || assets[6]?.uri,
          winner2: assets[7]?.localUri || assets[7]?.uri,
        });
      } catch (error) {
        console.error('Error loading sound assets:', error);
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

    // Use polling to check for completion since statusChange events aren't reliable
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
    }, 100); // Check every 100ms

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
      if (onComplete) {
        console.log('✅ Timer callback registered');
        timerCompleteCallbackRef.current = onComplete;
      }
      if (timerPlayer.playing) {
        timerPlayer.seekTo(0);
        timerPlayer.play(); // Restart playback after seeking
      } else {
        timerPlayer.play();
      }
      console.log('▶️ Timer play() called');
      // Don't mark as playing here - let the statusChange listener detect when it actually starts
    } catch (error) {
      console.error('Error playing timer sound:', error);
      timerWasPlayingRef.current = false;
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
      if (onComplete) {
        gavelCompleteCallbackRef.current = onComplete;
      }
      if (gavelPlayer.playing) {
        gavelPlayer.seekTo(0);
      } else {
        gavelPlayer.play();
      }
    } catch (error) {
      console.error('Error playing gavel sound:', error);
      if (onComplete) onComplete();
    }
  };

  /**
   * Play winner sound based on bid amount
   * >100 Freti = winner2, ≤100 = winner1
   */
  const playWinner = async (finalBidAmount: number, onComplete?: () => void) => {
    try {
      const useWinner2 = finalBidAmount > 100;
      const player = useWinner2 ? winner2Player : winner1Player;

      if (winnerCompleteCallbackRef.current) {
        winnerCompleteCallbackRef.current = null;
      }
      if (onComplete) {
        winnerCompleteCallbackRef.current = onComplete;
      }

      if (player.playing) {
        player.seekTo(0);
      } else {
        player.play();
      }
    } catch (error) {
      console.error('Error playing winner sound:', error);
      if (onComplete) onComplete();
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

