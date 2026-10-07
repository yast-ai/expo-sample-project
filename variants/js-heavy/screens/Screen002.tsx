import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-002-01", "module-002-02", "module-002-03", "module-002-04", "module-002-05", "module-002-06", "module-002-07", "module-002-08", "module-002-09", "module-002-10", "module-002-11", "module-002-12", "module-002-13", "module-002-14", "module-002-15", "module-002-16", "module-002-17", "module-002-18", "module-002-19", "module-002-20", "module-002-21", "module-002-22", "module-002-23", "module-002-24"];

export function Screen002() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 002</Text>
      <Text style={styles.detail}>Loaded 002: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
