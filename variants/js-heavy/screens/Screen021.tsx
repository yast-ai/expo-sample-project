import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-021-01", "module-021-02", "module-021-03", "module-021-04", "module-021-05", "module-021-06", "module-021-07", "module-021-08", "module-021-09", "module-021-10", "module-021-11", "module-021-12", "module-021-13", "module-021-14", "module-021-15", "module-021-16", "module-021-17", "module-021-18", "module-021-19", "module-021-20", "module-021-21", "module-021-22", "module-021-23", "module-021-24"];

export function Screen021() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 021</Text>
      <Text style={styles.detail}>Loaded 021: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
