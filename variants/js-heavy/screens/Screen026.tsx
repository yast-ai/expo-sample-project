import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-026-01", "module-026-02", "module-026-03", "module-026-04", "module-026-05", "module-026-06", "module-026-07", "module-026-08", "module-026-09", "module-026-10", "module-026-11", "module-026-12", "module-026-13", "module-026-14", "module-026-15", "module-026-16", "module-026-17", "module-026-18", "module-026-19", "module-026-20", "module-026-21", "module-026-22", "module-026-23", "module-026-24"];

export function Screen026() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 026</Text>
      <Text style={styles.detail}>Loaded 026: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
