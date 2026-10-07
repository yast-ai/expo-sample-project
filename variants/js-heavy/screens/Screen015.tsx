import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-015-01", "module-015-02", "module-015-03", "module-015-04", "module-015-05", "module-015-06", "module-015-07", "module-015-08", "module-015-09", "module-015-10", "module-015-11", "module-015-12", "module-015-13", "module-015-14", "module-015-15", "module-015-16", "module-015-17", "module-015-18", "module-015-19", "module-015-20", "module-015-21", "module-015-22", "module-015-23", "module-015-24"];

export function Screen015() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 015</Text>
      <Text style={styles.detail}>Loaded 015: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
