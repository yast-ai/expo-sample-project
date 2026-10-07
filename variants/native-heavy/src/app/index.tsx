import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import * as SQLite from 'expo-sqlite';
import { DeviceMotion } from 'expo-sensors';
import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const database = SQLite.openDatabaseSync('native-lab.db');
database.execSync(
  'CREATE TABLE IF NOT EXISTS samples (id INTEGER PRIMARY KEY NOT NULL, created_at TEXT NOT NULL);'
);

export default function HomeScreen() {
  const [rows, setRows] = useState(0);
  const [motion, setMotion] = useState('Waiting for device motion');

  useEffect(() => {
    DeviceMotion.setUpdateInterval(400);
    const subscription = DeviceMotion.addListener(({ accelerationIncludingGravity }) => {
      const z = accelerationIncludingGravity?.z?.toFixed(2) ?? '0.00';
      setMotion(`Gravity Z: ${z}`);
    });
    return () => subscription.remove();
  }, []);

  function writeSample() {
    database.runSync('INSERT INTO samples (created_at) VALUES (?)', new Date().toISOString());
    const result = database.getFirstSync<{ count: number }>('SELECT COUNT(*) AS count FROM samples');
    setRows(result?.count ?? 0);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">Native Lab</ThemedText>
          <ThemedText>
            This benchmark forces a real Android native build through Skia, Reanimated, SQLite, and
            device sensors.
          </ThemedText>

          <View style={styles.canvas}>
            <Canvas style={StyleSheet.absoluteFill}>
              <Group>
                <Circle cx={78} cy={78} r={62} color="#38bdf8" />
                <Circle cx={142} cy={114} r={50} color="#6366f1" opacity={0.8} />
                <Circle cx={108} cy={146} r={36} color="#f97316" opacity={0.85} />
              </Group>
            </Canvas>
          </View>

          <ThemedView style={styles.card} type="backgroundElement">
            <ThemedText type="subtitle">SQLite and sensors</ThemedText>
            <ThemedText>{motion}</ThemedText>
            <ThemedText>Stored samples: {rows}</ThemedText>
            <Button title="Write SQLite sample" onPress={writeSample} />
          </ThemedView>

          <ThemedText type="small">
            The Capture tab requests camera and location permissions. The Media tab uses native audio
            and video players.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { gap: 18, padding: 24, paddingBottom: 110 },
  canvas: { height: 220, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0f172a' },
  card: { gap: 10, padding: 18, borderRadius: 16 },
});
