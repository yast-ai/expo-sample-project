import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-006-01", "module-006-02", "module-006-03", "module-006-04", "module-006-05", "module-006-06", "module-006-07", "module-006-08", "module-006-09", "module-006-10", "module-006-11", "module-006-12", "module-006-13", "module-006-14", "module-006-15", "module-006-16", "module-006-17", "module-006-18", "module-006-19", "module-006-20", "module-006-21", "module-006-22", "module-006-23", "module-006-24"];

export function Screen006() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 006</Text>
      <Text style={styles.detail}>Loaded 006: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
