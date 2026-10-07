import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useRef, useState } from 'react';
import { Button, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function CaptureScreen() {
  const camera = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [location, setLocation] = useState('Location has not been requested');
  const [capture, setCapture] = useState('No photo taken');

  async function readLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setLocation('Location permission was denied');
      return;
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLocation(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
  }

  async function takePhoto() {
    const photo = await camera.current?.takePictureAsync({ quality: 0.4 });
    setCapture(photo?.uri ? 'Photo captured in the app cache' : 'Camera did not return a photo');
  }

  if (!cameraPermission) return <ThemedView style={styles.fill} />;

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">Capture</ThemedText>
          <ThemedText>Camera and foreground location exercise Android permissions and native modules.</ThemedText>

          {cameraPermission.granted ? (
            <View style={styles.preview}>
              <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
            </View>
          ) : (
            <ThemedView style={styles.card} type="backgroundElement">
              <ThemedText>Camera permission is required to show the native preview.</ThemedText>
              <Button title="Allow camera" onPress={requestCameraPermission} />
            </ThemedView>
          )}

          <ThemedView style={styles.card} type="backgroundElement">
            <Button title="Take photo" onPress={takePhoto} disabled={!cameraPermission.granted} />
            <ThemedText>{capture}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.card} type="backgroundElement">
            <Button title="Read current location" onPress={readLocation} />
            <ThemedText>{location}</ThemedText>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { gap: 16, padding: 24, paddingBottom: 110 },
  preview: { height: 310, overflow: 'hidden', borderRadius: 20, backgroundColor: '#0f172a' },
  card: { gap: 12, padding: 16, borderRadius: 16 },
});
