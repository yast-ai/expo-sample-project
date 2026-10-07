import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-052-01", "module-052-02", "module-052-03", "module-052-04", "module-052-05", "module-052-06", "module-052-07", "module-052-08", "module-052-09", "module-052-10", "module-052-11", "module-052-12", "module-052-13", "module-052-14", "module-052-15", "module-052-16", "module-052-17", "module-052-18", "module-052-19", "module-052-20", "module-052-21", "module-052-22", "module-052-23", "module-052-24"];

export function Screen052() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 052</Text>
      <Text style={styles.detail}>Loaded 052: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
