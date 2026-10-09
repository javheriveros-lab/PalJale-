import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { getChatMessages, sendChatMessage, markChatAsRead, CHAT_TEMPLATES, ChatMessage, ChatTemplateKey } from '../../src/api/chat';
import { ArrowLeft, Send } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

export default function ChatScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getChatMessages(orderId);
      setMessages(data.items);
      await markChatAsRead(orderId);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudieron cargar mensajes');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    try {
      setSending(true);
      const msg = await sendChatMessage(orderId, text);
      setMessages((prev) => [...prev, msg]);
      setInput('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleTemplate(key: ChatTemplateKey) {
    try {
      setSending(true);
      const msg = await sendChatMessage(orderId, CHAT_TEMPLATES[key]);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSending(false);
    }
  }

  function renderItem({ item }: { item: ChatMessage }) {
    const isMe = item.sender_id === user?.id;
    return (
      <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
        <Text style={[styles.messageText, isMe ? styles.myText : styles.otherText]}>{item.content}</Text>
        <Text style={styles.messageMeta}>{new Date(item.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ArrowLeft size={24} color="#333" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Chat de orden</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading && messages.length === 0 ? (
          <ActivityIndicator color={THEME_ORANGE} style={styles.loader} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <View style={styles.templates}>
          <FlatList
            horizontal
            data={Object.keys(CHAT_TEMPLATES) as ChatTemplateKey[]}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.templateChip} onPress={() => handleTemplate(item)} disabled={sending}>
                <Text style={styles.templateText}>{CHAT_TEMPLATES[item]}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Escribe un mensaje..."
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]} onPress={handleSend} disabled={!input.trim() || sending}>
            <Send size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  loader: { marginTop: 40 },
  list: { padding: 16, paddingBottom: 8 },
  messageBubble: { maxWidth: '80%', borderRadius: 16, padding: 12, marginBottom: 10 },
  myBubble: { alignSelf: 'flex-end', backgroundColor: THEME_ORANGE },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  messageText: { fontSize: 14, lineHeight: 20 },
  myText: { color: '#fff' },
  otherText: { color: '#1a1a1a' },
  messageMeta: { fontSize: 10, color: 'rgba(0,0,0,0.4)', marginTop: 6, alignSelf: 'flex-end' },
  templates: { backgroundColor: '#fff', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  templateChip: { backgroundColor: '#f0f0f0', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 6 },
  templateText: { fontSize: 12, color: '#333' },
  inputBar: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  input: { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100, fontSize: 15 },
  sendBtn: { backgroundColor: THEME_ORANGE, borderRadius: 24, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  sendBtnDisabled: { opacity: 0.5 },
});
