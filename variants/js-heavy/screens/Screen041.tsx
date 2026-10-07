import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-041-01", "module-041-02", "module-041-03", "module-041-04", "module-041-05", "module-041-06", "module-041-07", "module-041-08", "module-041-09", "module-041-10", "module-041-11", "module-041-12", "module-041-13", "module-041-14", "module-041-15", "module-041-16", "module-041-17", "module-041-18", "module-041-19", "module-041-20", "module-041-21", "module-041-22", "module-041-23", "module-041-24"];

export function Screen041() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 041</Text>
      <Text style={styles.detail}>Loaded 041: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
