import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-081-01", "module-081-02", "module-081-03", "module-081-04", "module-081-05", "module-081-06", "module-081-07", "module-081-08", "module-081-09", "module-081-10", "module-081-11", "module-081-12", "module-081-13", "module-081-14", "module-081-15", "module-081-16", "module-081-17", "module-081-18", "module-081-19", "module-081-20", "module-081-21", "module-081-22", "module-081-23", "module-081-24"];

export function Screen081() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 081</Text>
      <Text style={styles.detail}>Loaded 081: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
