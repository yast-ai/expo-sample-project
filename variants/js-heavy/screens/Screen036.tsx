import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-036-01", "module-036-02", "module-036-03", "module-036-04", "module-036-05", "module-036-06", "module-036-07", "module-036-08", "module-036-09", "module-036-10", "module-036-11", "module-036-12", "module-036-13", "module-036-14", "module-036-15", "module-036-16", "module-036-17", "module-036-18", "module-036-19", "module-036-20", "module-036-21", "module-036-22", "module-036-23", "module-036-24"];

export function Screen036() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 036</Text>
      <Text style={styles.detail}>Loaded 036: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
