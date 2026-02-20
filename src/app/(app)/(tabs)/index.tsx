import {
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
  type AVPlaybackSource,
  type AVPlaybackStatus,
} from 'expo-av';
import { Stack as ExpoStack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CONNECT_TIMEOUT_MS = 12000;
const NOW_PLAYING_POLL_MS = 60000;
const NOW_PLAYING_FETCH_TIMEOUT_MS = 5000;
const DEFAULT_NOW_PLAYING_URL = 'https://stream.motivafm.com/listen/motiva/motiva.mp3';
const NOW_PLAYING_URL =
  process.env.EXPO_PUBLIC_TODOFM_NOWPLAYING_URL?.trim() || DEFAULT_NOW_PLAYING_URL;
const DEFAULT_STREAM_URLS = ['https://server1.easystreaming.pro:8443/95.5'];
const DEFAULT_NOW_PLAYING = {
  title: 'TODO FM Classic',
  artist: 'Jorge Sánchez',
};
const STREAM_URLS = (process.env.EXPO_PUBLIC_TODOFM_STREAM_URLS ?? '')
  .split(',')
  .map((value: string) => value.trim())
  .filter(Boolean);

const ACTIVE_STREAM_URLS = STREAM_URLS.length > 0 ? STREAM_URLS : DEFAULT_STREAM_URLS;

const createStreamSources = (uri: string): AVPlaybackSource[] => {
  const normalized = uri.endsWith('/') ? uri.slice(0, -1) : uri;
  return [
    {
      uri: normalized,
      headers: {
        Accept: '*/*',
        'User-Agent': 'TODOFMClassic/1.0',
      },
    },
    {
      uri: `${normalized}/`,
      headers: {
        Accept: '*/*',
        'User-Agent': 'TODOFMClassic/1.0',
      },
    },
    {
      uri: normalized,
      overrideFileExtensionAndroid: 'mp3',
      headers: {
        Accept: '*/*',
        'User-Agent': 'TODOFMClassic/1.0',
      },
    },
    {
      uri: `${normalized}/`,
      overrideFileExtensionAndroid: 'mp3',
      headers: {
        Accept: '*/*',
        'User-Agent': 'TODOFMClassic/1.0',
      },
    },
  ];
};

const STREAM_SOURCES: AVPlaybackSource[] = ACTIVE_STREAM_URLS.flatMap((uri: string) =>
  createStreamSources(uri),
);
type PlayerStatus = 'idle' | 'connecting' | 'buffering' | 'playing' | 'paused' | 'error';
type NowPlaying = {
  title: string;
  artist: string;
};

const parseArtistTitle = (value: string): NowPlaying | null => {
  const parts = value.split(' - ').map((item) => item.trim());
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { artist: parts[0], title: parts.slice(1).join(' - ') };
  }
  return null;
};

const parseIcyMetadata = (buffer: ArrayBuffer, metaint: number | null): NowPlaying | null => {
  const bytes = new Uint8Array(buffer);

  if (metaint && metaint > 0 && bytes.length > metaint) {
    const metadataLength = bytes[metaint] * 16;
    const metadataStart = metaint + 1;
    const metadataEnd = metadataStart + metadataLength;
    if (metadataLength > 0 && bytes.length >= metadataEnd) {
      const metadataBytes = bytes.slice(metadataStart, metadataEnd);
      const metadataText = new TextDecoder('iso-8859-1').decode(metadataBytes).replace(/\0/g, '');
      const metadataMatch = metadataText.match(/StreamTitle='([^']+)';/i);
      if (metadataMatch?.[1]) {
        return parseArtistTitle(metadataMatch[1].trim());
      }
    }
  }

  // Fallback: some servers include StreamTitle inline and omit icy-metaint.
  const text = new TextDecoder('iso-8859-1').decode(buffer).replace(/\0/g, '');
  const streamTitleMatch = text.match(/StreamTitle='([^']+)';/i);
  if (!streamTitleMatch?.[1]) {
    return null;
  }
  return parseArtistTitle(streamTitleMatch[1].trim());
};

const extractNowPlaying = (payload: unknown): NowPlaying | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Record<string, unknown>;
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const artist = typeof data.artist === 'string' ? data.artist.trim() : '';
  if (title && artist) {
    return { title, artist };
  }

  const song = data.song;
  if (song && typeof song === 'object') {
    const songData = song as Record<string, unknown>;
    const songTitle = typeof songData.title === 'string' ? songData.title.trim() : '';
    const songArtist = typeof songData.artist === 'string' ? songData.artist.trim() : '';
    if (songTitle && songArtist) {
      return { title: songTitle, artist: songArtist };
    }
  }

  const nowPlaying = data.now_playing;
  if (nowPlaying && typeof nowPlaying === 'object') {
    const nowPlayingData = nowPlaying as Record<string, unknown>;
    const nowPlayingSong = nowPlayingData.song;
    if (nowPlayingSong && typeof nowPlayingSong === 'object') {
      const nowPlayingSongData = nowPlayingSong as Record<string, unknown>;
      const songTitle =
        typeof nowPlayingSongData.title === 'string' ? nowPlayingSongData.title.trim() : '';
      const songArtist =
        typeof nowPlayingSongData.artist === 'string' ? nowPlayingSongData.artist.trim() : '';
      if (songTitle && songArtist) {
        return { title: songTitle, artist: songArtist };
      }
    }
  }

  const rawNowPlaying = typeof data.now_playing === 'string' ? data.now_playing.trim() : '';
  if (rawNowPlaying) {
    return parseArtistTitle(rawNowPlaying);
  }

  const rawCurrent = typeof data.current === 'string' ? data.current.trim() : '';
  if (rawCurrent) {
    return parseArtistTitle(rawCurrent);
  }

  return null;
};

export default function Index() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('idle');
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(DEFAULT_NOW_PLAYING);
  const soundRef = useRef<Audio.Sound | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStatusRef = useRef<PlayerStatus>('idle');
  const lastIsLiveRef = useRef(false);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      playThroughEarpieceAndroid: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      staysActiveInBackground: true,
    }).catch(() => null);

    return () => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
      }
      soundRef.current?.unloadAsync().catch(() => null);
      soundRef.current = null;
    };
  }, []);

  const clearConnectTimeout = useCallback(() => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  }, []);

  const failConnection = useCallback(
    async (detail?: string) => {
      clearConnectTimeout();
      setIsConnecting(false);
      setIsLive(false);
      setPlayerStatus('error');
      await soundRef.current?.unloadAsync().catch(() => null);
      soundRef.current = null;
    },
    [clearConnectTimeout],
  );

  const startConnectTimeout = useCallback(() => {
    clearConnectTimeout();
    connectTimeoutRef.current = setTimeout(() => {
      void failConnection(`Timeout after ${CONNECT_TIMEOUT_MS / 1000}s`);
    }, CONNECT_TIMEOUT_MS);
  }, [clearConnectTimeout, failConnection]);

  const onPlaybackStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        if (status.error) {
          if (lastIsLiveRef.current) {
            lastIsLiveRef.current = false;
            setIsLive(false);
          }
          setIsConnecting(false);
          if (lastStatusRef.current !== 'error') {
            lastStatusRef.current = 'error';
            setPlayerStatus('error');
          }
        }
        return;
      }
      if (status.isBuffering) {
        if (lastStatusRef.current !== 'buffering') {
          lastStatusRef.current = 'buffering';
          setPlayerStatus('buffering');
        }
        return;
      }
      setIsConnecting(false);
      if (lastIsLiveRef.current !== status.isPlaying) {
        lastIsLiveRef.current = status.isPlaying;
        setIsLive(status.isPlaying);
      }
      const nextStatus: PlayerStatus = status.isPlaying ? 'playing' : 'paused';
      if (lastStatusRef.current !== nextStatus) {
        lastStatusRef.current = nextStatus;
        setPlayerStatus(nextStatus);
      }
      if (status.isPlaying) {
        clearConnectTimeout();
      }
    },
    [clearConnectTimeout],
  );

  const refreshNowPlaying = useCallback(async () => {
    // Avoid extra network pressure while live audio is playing.
    if (isLive) {
      return;
    }
    if (!NOW_PLAYING_URL) {
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), NOW_PLAYING_FETCH_TIMEOUT_MS);
      const response = await fetch(NOW_PLAYING_URL, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Icy-MetaData': '1',
          Range: 'bytes=0-32767',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        return;
      }

      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (contentType.includes('application/json')) {
        const payload = (await response.json()) as unknown;
        const parsed = extractNowPlaying(payload);
        if (parsed) {
          setNowPlaying(parsed);
        }
        return;
      }

      const metaintHeader = response.headers.get('icy-metaint');
      const metaint = metaintHeader ? Number.parseInt(metaintHeader, 10) : null;
      const audioBuffer = await response.arrayBuffer();
      const parsedIcy = parseIcyMetadata(audioBuffer, Number.isFinite(metaint) ? metaint : null);
      if (parsedIcy) {
        setNowPlaying(parsedIcy);
      }
    } catch {
      // Ignore metadata fetch errors and keep last known song.
    }
  }, [isLive]);

  useEffect(() => {
    void refreshNowPlaying();
    const interval = setInterval(() => {
      void refreshNowPlaying();
    }, NOW_PLAYING_POLL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [refreshNowPlaying]);

  const toggleLiveStream = useCallback(async () => {
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync();
          clearConnectTimeout();
          setIsConnecting(false);
          setIsLive(false);
          setPlayerStatus('paused');
        } else {
          setIsConnecting(true);
          setPlayerStatus('connecting');
          startConnectTimeout();
          await soundRef.current.playAsync();
        }
        return;
      }

      setIsConnecting(true);
      setPlayerStatus('connecting');
      startConnectTimeout();
      const errors: string[] = [];
      let createdSound: Audio.Sound | null = null;
      for (const source of STREAM_SOURCES) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            source,
            {
              shouldPlay: true,
              progressUpdateIntervalMillis: 2000,
            },
            onPlaybackStatus,
          );
          createdSound = sound;
          break;
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'Unknown source error';
          errors.push(detail);
        }
      }

      if (!createdSound) {
        throw new Error(
          errors.join(' | ') ||
            `No source could be played. Configure EXPO_PUBLIC_TODOFM_STREAM_URLS with a valid endpoint.`,
        );
      }

      soundRef.current = createdSound;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown audio error';
      await failConnection(detail);
      Alert.alert('Error de audio', `Detalle: ${detail}`);
    } finally {
      if (playerStatus !== 'connecting') {
        setIsConnecting(false);
      }
    }
  }, [clearConnectTimeout, failConnection, onPlaybackStatus, playerStatus, startConnectTimeout]);

  return (
    <>
      <ExpoStack.Screen options={{ headerShown: false, title: 'TODO FM Classic' }} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.brandTitle}>Frecuencia FM</Text>

          <View style={styles.logoArea}>
            <View style={styles.logoCircle}>
              <Image source={require('../../../../frecuenciafm.png')} style={styles.logoImage} />
            </View>
            <Text style={styles.tagline}>95.5 FM{'\n'}Murcia</Text>
          </View>

          <Pressable
            accessibilityLabel={`En directo. Ahora suena: ${nowPlaying.title} - ${nowPlaying.artist}`}
            onPress={toggleLiveStream}
            style={[styles.mainButton, isLive ? styles.mainButtonLive : null]}
          >
            <Text style={styles.mainButtonText}>
              {isConnecting ? 'Conectando...' : 'En directo'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 20,
  },
  brandTitle: {
    color: '#e7e7e7',
    fontSize: 44,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 14,
  },
  logoArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
  },
  logoCircle: {
    width: 330,
    height: 330,
    borderRadius: 165,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 255,
    height: 255,
    resizeMode: 'contain',
  },
  tagline: {
    color: '#f2f2f2',
    fontSize: 38,
    textAlign: 'center',
    marginTop: 34,
    paddingHorizontal: 20,
  },
  mainButton: {
    backgroundColor: '#0000fe',
    borderRadius: 14,
    minHeight: 58,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  mainButtonLive: {
    backgroundColor: '#0000d8',
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
