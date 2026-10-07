import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-066-01", "module-066-02", "module-066-03", "module-066-04", "module-066-05", "module-066-06", "module-066-07", "module-066-08", "module-066-09", "module-066-10", "module-066-11", "module-066-12", "module-066-13", "module-066-14", "module-066-15", "module-066-16", "module-066-17", "module-066-18", "module-066-19", "module-066-20", "module-066-21", "module-066-22", "module-066-23", "module-066-24"];

export function Screen066() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 066</Text>
      <Text style={styles.detail}>Loaded 066: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
