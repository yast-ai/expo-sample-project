import { ConvexProvider, ConvexReactClient, useMutation, useQuery } from "convex/react";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Button, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "./convex/_generated/api";
import { convexUrl } from "./convexUrl";

const convex = new ConvexReactClient(convexUrl);

function Notes() {
  const notes = useQuery(api.notes.list) ?? [];
  const add = useMutation(api.notes.add);
  const [text, setText] = useState("");
  return <View style={styles.panel}>
    <Text style={styles.title}>Shared notes</Text>
    <View style={styles.row}><TextInput accessibilityLabel="New note" value={text} onChangeText={setText} placeholder="Write a note" style={styles.input} /><Button title="Add" onPress={async () => { await add({ text }); setText(""); }} /></View>
    {notes.map((note) => <Text key={note._id} style={styles.note}>• {note.text}</Text>)}
  </View>;
}

function Counter() {
  const counter = useQuery(api.counter.get);
  const increment = useMutation(api.counter.increment);
  return <View style={styles.panel}>
    <Text style={styles.title}>Live counter</Text><Text style={styles.count}>{counter?.value ?? "…"}</Text>
    <Button title="Increment" onPress={() => increment({})} />
  </View>;
}

function Sample() {
  const [screen, setScreen] = useState<"notes" | "counter">("notes");
  return <SafeAreaView style={styles.container}><Text style={styles.brand}>Expo + Convex</Text><View style={styles.tabs}>{(["notes", "counter"] as const).map((name) => <Pressable key={name} onPress={() => setScreen(name)} style={[styles.tab, screen === name && styles.active]}><Text>{name === "notes" ? "Notes" : "Counter"}</Text></Pressable>)}</View>{screen === "notes" ? <Notes /> : <Counter />}<StatusBar style="dark" /></SafeAreaView>;
}

export default function App() {
  return <ConvexProvider client={convex}><Sample /></ConvexProvider>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: "#f8fafc", padding: 24, gap: 20 }, brand: { fontSize: 28, fontWeight: "700", color: "#0f172a" }, tabs: { flexDirection: "row", gap: 12 }, tab: { padding: 12, borderRadius: 8, backgroundColor: "#e2e8f0" }, active: { backgroundColor: "#7dd3fc" }, panel: { gap: 14 }, title: { fontSize: 22, fontWeight: "600", color: "#0f172a" }, row: { flexDirection: "row", gap: 10, alignItems: "center" }, input: { flex: 1, backgroundColor: "white", borderWidth: 1, borderColor: "#94a3b8", padding: 12, borderRadius: 8 }, note: { fontSize: 17, color: "#1e293b" }, count: { fontSize: 60, fontWeight: "700", color: "#0284c7" } });
