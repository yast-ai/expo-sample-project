import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-007-01", "module-007-02", "module-007-03", "module-007-04", "module-007-05", "module-007-06", "module-007-07", "module-007-08", "module-007-09", "module-007-10", "module-007-11", "module-007-12", "module-007-13", "module-007-14", "module-007-15", "module-007-16", "module-007-17", "module-007-18", "module-007-19", "module-007-20", "module-007-21", "module-007-22", "module-007-23", "module-007-24"];

export function Screen007() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 007</Text>
      <Text style={styles.detail}>Loaded 007: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
