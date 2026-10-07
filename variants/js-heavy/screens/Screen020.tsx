import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-020-01", "module-020-02", "module-020-03", "module-020-04", "module-020-05", "module-020-06", "module-020-07", "module-020-08", "module-020-09", "module-020-10", "module-020-11", "module-020-12", "module-020-13", "module-020-14", "module-020-15", "module-020-16", "module-020-17", "module-020-18", "module-020-19", "module-020-20", "module-020-21", "module-020-22", "module-020-23", "module-020-24"];

export function Screen020() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 020</Text>
      <Text style={styles.detail}>Loaded 020: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
