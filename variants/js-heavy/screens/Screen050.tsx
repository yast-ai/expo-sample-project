import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-050-01", "module-050-02", "module-050-03", "module-050-04", "module-050-05", "module-050-06", "module-050-07", "module-050-08", "module-050-09", "module-050-10", "module-050-11", "module-050-12", "module-050-13", "module-050-14", "module-050-15", "module-050-16", "module-050-17", "module-050-18", "module-050-19", "module-050-20", "module-050-21", "module-050-22", "module-050-23", "module-050-24"];

export function Screen050() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 050</Text>
      <Text style={styles.detail}>Loaded 050: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
