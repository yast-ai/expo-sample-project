import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-080-01", "module-080-02", "module-080-03", "module-080-04", "module-080-05", "module-080-06", "module-080-07", "module-080-08", "module-080-09", "module-080-10", "module-080-11", "module-080-12", "module-080-13", "module-080-14", "module-080-15", "module-080-16", "module-080-17", "module-080-18", "module-080-19", "module-080-20", "module-080-21", "module-080-22", "module-080-23", "module-080-24"];

export function Screen080() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 080</Text>
      <Text style={styles.detail}>Loaded 080: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
