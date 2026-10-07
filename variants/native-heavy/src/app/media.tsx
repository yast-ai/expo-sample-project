import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Button, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const sampleVideo = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

export default function MediaScreen() {
  const video = useVideoPlayer(sampleVideo, (player) => {
    player.loop = true;
  });
  const audio = useAudioPlayer(sampleVideo);
  const audioStatus = useAudioPlayerStatus(audio);

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">Media</ThemedText>
          <ThemedText>Native ExoPlayer video and audio player modules are linked into this APK.</ThemedText>

          <VideoView player={video} style={styles.video} nativeControls allowsPictureInPicture />
          <ThemedView style={styles.card} type="backgroundElement">
            <Button title="Play video" onPress={() => video.play()} />
            <Button title="Pause video" onPress={() => video.pause()} />
          </ThemedView>
          <ThemedView style={styles.card} type="backgroundElement">
            <ThemedText>{audioStatus.playing ? 'Audio is playing' : 'Audio is paused'}</ThemedText>
            <Button title={audioStatus.playing ? 'Pause audio' : 'Play audio'} onPress={() => audioStatus.playing ? audio.pause() : audio.play()} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { gap: 16, padding: 24, paddingBottom: 110 },
  video: { height: 220, borderRadius: 16, overflow: 'hidden' },
  card: { gap: 12, padding: 16, borderRadius: 16 },
});
