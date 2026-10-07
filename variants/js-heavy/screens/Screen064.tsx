import { StyleSheet, Text, View } from 'react-native';

const payload = ["module-064-01", "module-064-02", "module-064-03", "module-064-04", "module-064-05", "module-064-06", "module-064-07", "module-064-08", "module-064-09", "module-064-10", "module-064-11", "module-064-12", "module-064-13", "module-064-14", "module-064-15", "module-064-16", "module-064-17", "module-064-18", "module-064-19", "module-064-20", "module-064-21", "module-064-22", "module-064-23", "module-064-24"];

export function Screen064() {
  const checksum = payload.reduce((sum, entry) => sum + entry.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screen 064</Text>
      <Text style={styles.detail}>Loaded 064: {payload.length} JS records, checksum {checksum}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20, borderRadius: 12, backgroundColor: '#172554' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700' },
  detail: { color: '#bfdbfe', fontSize: 15 },
});
