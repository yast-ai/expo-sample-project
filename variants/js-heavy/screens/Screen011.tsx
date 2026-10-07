import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-011-01", "module-011-02", "module-011-03", "module-011-04", "module-011-05", "module-011-06", "module-011-07", "module-011-08", "module-011-09", "module-011-10", "module-011-11", "module-011-12", "module-011-13", "module-011-14", "module-011-15", "module-011-16", "module-011-17", "module-011-18", "module-011-19", "module-011-20", "module-011-21", "module-011-22", "module-011-23", "module-011-24"];

export function Screen011() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 011</Text>
      <Text style={styles.detail}>Loaded 011: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
