import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-024-01", "module-024-02", "module-024-03", "module-024-04", "module-024-05", "module-024-06", "module-024-07", "module-024-08", "module-024-09", "module-024-10", "module-024-11", "module-024-12", "module-024-13", "module-024-14", "module-024-15", "module-024-16", "module-024-17", "module-024-18", "module-024-19", "module-024-20", "module-024-21", "module-024-22", "module-024-23", "module-024-24"];

export function Screen024() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 024</Text>
      <Text style={styles.detail}>Loaded 024: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
