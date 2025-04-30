// app/(auth)/index.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { showMessage } from "react-native-flash-message";

export default function AuthScreen() {
  const { colors } = useTheme();
  const { login, signup } = useAuth();

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [congregationCode, setCongregationCode] = useState(''); // <<< Novo estado para o código
  const [localLoading, setLocalLoading] = useState(false);

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setName('');
    setEmail('');
    setPassword('');
    setCongregationCode('');
  };

  const handleSubmit = async () => {
    if (isLoginMode) {
      if (!email || !password) {
        showMessage({ message: "Campos Obrigatórios", description: "Por favor, preencha o email e a senha.", type: "warning", icon: "warning" });
        return;
      }
    } else { // Modo Signup
      if (!name || !email || !password) {
        showMessage({ message: "Campos Obrigatórios", description: "Por favor, preencha nome, email e senha.", type: "warning", icon: "warning" });
        return;
      }
      // Validação do código (opcional) - pode ser feita aqui ou no AuthContext
      // Ex: if (congregationCode.trim() && congregationCode.trim().length < 10) { ... }
    }

    setLocalLoading(true);
    try {
      if (isLoginMode) {
        await login({ email, password });
      } else {
        // --- Lógica de Signup (Passa o código) ---
        await signup({
            name,
            email,
            password,
            // Passa o código da congregação (trim remove espaços extras)
            // Se vazio, será tratado como nulo no AuthContext
            congregationId: congregationCode.trim() || undefined
        });
        showMessage({ message: "Sucesso!", description: "Sua conta foi criada.", type: "success", icon: "success" });
      }
    } catch (error: any) {
      console.error(`Erro em ${isLoginMode ? 'Login' : 'Signup'}:`, error);
      let errorMessage = error.message || `Falha ao ${isLoginMode ? 'entrar' : 'cadastrar'}.`;
       if (error.code) {
         switch (error.code) {
             // ... (códigos de erro) ...
             case 'auth/user-not-found':
             case 'auth/wrong-password':
             case 'auth/invalid-credential':
                errorMessage = 'Email ou senha inválidos.';
                break;
             case 'auth/invalid-email':
                errorMessage = 'O formato do email é inválido.';
                break;
             case 'auth/email-already-in-use':
                errorMessage = 'Este email já está sendo utilizado.';
                break;
             case 'auth/weak-password':
                errorMessage = 'A senha é muito fraca (mínimo 6 caracteres).';
                break;
             // Adicionar erro específico se a validação do código falhar no backend
             case 'functions/not-found': // Exemplo se usar Cloud Function para validar
             case 'invalid-argument': // Exemplo se a validação for no AuthContext
                errorMessage = 'Código da Congregação inválido ou não encontrado.';
                break;
             default:
                errorMessage = error.message;
          }
       }
       showMessage({ message: `Erro ao ${isLoginMode ? 'Entrar' : 'Cadastrar'}`, description: errorMessage, type: "danger", icon: "danger" });
    } finally {
      setLocalLoading(false);
    }
  };

  const styles = createStyles(colors);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isLoginMode ? 'Bem-vindo!' : 'Crie sua Conta'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isLoginMode ? 'Faça login para continuar' : 'É rápido e fácil'}
          </Text>

          {/* --- Campos Comuns --- */}
          {!isLoginMode && ( // Nome só no Signup
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
              placeholder="Nome Completo"
              placeholderTextColor={colors.placeholder}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
            />
          )}
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
            placeholder="Email"
            placeholderTextColor={colors.placeholder}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
            placeholder={isLoginMode ? "Senha" : "Senha (mínimo 6 caracteres)"}
            placeholderTextColor={colors.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={isLoginMode ? "password" : "new-password"}
            returnKeyType={isLoginMode ? "done" : "next"} // 'next' no signup se tiver código
            onSubmitEditing={isLoginMode ? handleSubmit : undefined} // Só submete no login
          />

          {/* --- Campo Código da Congregação (Opcional - Signup) --- */}
          {!isLoginMode && (
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
              placeholder="Código da Congregação (Opcional)"
              placeholderTextColor={colors.placeholder}
              value={congregationCode}
              onChangeText={setCongregationCode}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done" // Último campo do signup
              onSubmitEditing={handleSubmit} // Submete ao pressionar 'done' aqui
            />
          )}

          {/* --- Botão Principal --- */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: localLoading ? colors.primaryLight : colors.primary, opacity: localLoading ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={localLoading}
          >
            {localLoading ? ( <ActivityIndicator size="small" color={colors.textOnPrimary} /> ) : (
              <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
                {isLoginMode ? 'Entrar' : 'Cadastrar'}
              </Text>
            )}
          </TouchableOpacity>

          {/* --- Link Alternar Modo --- */}
          <View style={styles.footer}>
            <Text style={{ color: colors.textSecondary }}>
              {isLoginMode ? 'Não tem uma conta? ' : 'Já tem uma conta? '}
            </Text>
            <TouchableOpacity onPress={toggleMode} disabled={localLoading}>
              <Text style={[styles.link, { color: localLoading ? colors.textMuted : colors.primary }]}>
                {isLoginMode ? 'Cadastre-se' : 'Faça Login'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Estilos (sem alterações necessárias aqui)
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, },
  scrollContent: { flexGrow: 1, justifyContent: 'center', },
  content: { paddingHorizontal: 30, paddingBottom: 20, },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 30, },
  input: { height: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, fontSize: 16, marginBottom: 15, },
  button: { height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 10, },
  buttonText: { fontSize: 18, fontWeight: 'bold', },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 25, },
  link: { fontWeight: 'bold', fontSize: 14, marginLeft: 5, },
});
