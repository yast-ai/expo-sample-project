import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-061-01", "module-061-02", "module-061-03", "module-061-04", "module-061-05", "module-061-06", "module-061-07", "module-061-08", "module-061-09", "module-061-10", "module-061-11", "module-061-12", "module-061-13", "module-061-14", "module-061-15", "module-061-16", "module-061-17", "module-061-18", "module-061-19", "module-061-20", "module-061-21", "module-061-22", "module-061-23", "module-061-24"];

export function Screen061() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 061</Text>
      <Text style={styles.detail}>Loaded 061: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
