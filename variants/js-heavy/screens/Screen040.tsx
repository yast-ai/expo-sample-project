import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-040-01", "module-040-02", "module-040-03", "module-040-04", "module-040-05", "module-040-06", "module-040-07", "module-040-08", "module-040-09", "module-040-10", "module-040-11", "module-040-12", "module-040-13", "module-040-14", "module-040-15", "module-040-16", "module-040-17", "module-040-18", "module-040-19", "module-040-20", "module-040-21", "module-040-22", "module-040-23", "module-040-24"];

export function Screen040() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 040</Text>
      <Text style={styles.detail}>Loaded 040: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
