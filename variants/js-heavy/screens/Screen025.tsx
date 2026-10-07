import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-025-01", "module-025-02", "module-025-03", "module-025-04", "module-025-05", "module-025-06", "module-025-07", "module-025-08", "module-025-09", "module-025-10", "module-025-11", "module-025-12", "module-025-13", "module-025-14", "module-025-15", "module-025-16", "module-025-17", "module-025-18", "module-025-19", "module-025-20", "module-025-21", "module-025-22", "module-025-23", "module-025-24"];

export function Screen025() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 025</Text>
      <Text style={styles.detail}>Loaded 025: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
