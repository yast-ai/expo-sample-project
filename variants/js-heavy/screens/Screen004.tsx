import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-004-01", "module-004-02", "module-004-03", "module-004-04", "module-004-05", "module-004-06", "module-004-07", "module-004-08", "module-004-09", "module-004-10", "module-004-11", "module-004-12", "module-004-13", "module-004-14", "module-004-15", "module-004-16", "module-004-17", "module-004-18", "module-004-19", "module-004-20", "module-004-21", "module-004-22", "module-004-23", "module-004-24"];

export function Screen004() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 004</Text>
      <Text style={styles.detail}>Loaded 004: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
