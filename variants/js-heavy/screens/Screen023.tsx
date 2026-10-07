import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-023-01", "module-023-02", "module-023-03", "module-023-04", "module-023-05", "module-023-06", "module-023-07", "module-023-08", "module-023-09", "module-023-10", "module-023-11", "module-023-12", "module-023-13", "module-023-14", "module-023-15", "module-023-16", "module-023-17", "module-023-18", "module-023-19", "module-023-20", "module-023-21", "module-023-22", "module-023-23", "module-023-24"];

export function Screen023() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 023</Text>
      <Text style={styles.detail}>Loaded 023: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
