import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-001-01", "module-001-02", "module-001-03", "module-001-04", "module-001-05", "module-001-06", "module-001-07", "module-001-08", "module-001-09", "module-001-10", "module-001-11", "module-001-12", "module-001-13", "module-001-14", "module-001-15", "module-001-16", "module-001-17", "module-001-18", "module-001-19", "module-001-20", "module-001-21", "module-001-22", "module-001-23", "module-001-24"];

export function Screen001() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 001</Text>
      <Text style={styles.detail}>Loaded 001: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
