import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-017-01", "module-017-02", "module-017-03", "module-017-04", "module-017-05", "module-017-06", "module-017-07", "module-017-08", "module-017-09", "module-017-10", "module-017-11", "module-017-12", "module-017-13", "module-017-14", "module-017-15", "module-017-16", "module-017-17", "module-017-18", "module-017-19", "module-017-20", "module-017-21", "module-017-22", "module-017-23", "module-017-24"];

export function Screen017() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 017</Text>
      <Text style={styles.detail}>Loaded 017: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
