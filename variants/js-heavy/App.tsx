import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { screens } from './screens';

export default function App() {
  const [index, setIndex] = useState(0);
  const active = screens[index];
  const ActiveScreen = active.Component;
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>JS-heavy Expo benchmark</Text>
      <Text style={styles.subtitle}>{active.title} of {screens.length}</Text>
      <ActiveScreen />
      <View style={styles.controls}>
        <Pressable onPress={() => setIndex((index + screens.length - 1) % screens.length)} style={styles.control}><Text style={styles.controlText}>Previous</Text></Pressable>
        <Pressable onPress={() => setIndex((index + 1) % screens.length)} style={styles.control}><Text style={styles.controlText}>Next</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.menu}>
        {screens.map((screen, screenIndex) => (
          <Pressable key={screen.id} onPress={() => setIndex(screenIndex)} style={[styles.choice, screenIndex === index && styles.selected]}>
            <Text style={styles.choiceText}>{screen.title}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    padding: 20,
    backgroundColor: '#eff6ff',
  },
  heading: { color: '#0f172a', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#334155', fontSize: 16 },
  controls: { flexDirection: 'row', gap: 12 },
  control: { flex: 1, alignItems: 'center', borderRadius: 8, backgroundColor: '#2563eb', padding: 12 },
  controlText: { color: '#fff', fontWeight: '700' },
  menu: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 20 },
  choice: { borderRadius: 6, backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 7 },
  selected: { backgroundColor: '#93c5fd' },
  choiceText: { color: '#1e3a8a', fontSize: 13, fontWeight: '600' },
});
