// components/common/RenameModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';

interface RenameModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (newName: string) => Promise<void>; // Função que salva (pode ser async)
  title: string; // Ex: "Renomear Cidade"
  label: string; // Ex: "Novo nome para"
  itemNameToRename: string; // Ex: "Nome da Cidade Antiga"
  initialValue?: string; // Valor inicial do input
  placeholder?: string; // Placeholder do input
  isSaving?: boolean; // Para mostrar loading no botão Salvar
}

const RenameModal: React.FC<RenameModalProps> = ({
  isVisible,
  onClose,
  onSave,
  title,
  label,
  itemNameToRename,
  initialValue = '',
  placeholder = 'Digite o novo nome',
  isSaving = false,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [newName, setNewName] = useState(initialValue);

  // Reseta o nome quando o valor inicial muda (ao abrir para um item diferente)
  useEffect(() => {
    if (isVisible) {
      setNewName(initialValue);
    }
  }, [isVisible, initialValue]);

  const handleSavePress = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      // Poderia mostrar um erro aqui se necessário
      alert("O nome não pode ser vazio.");
      return;
    }
    // Chama a função onSave passada pelo componente pai
    await onSave(trimmedName);
    // onClose(); // O componente pai deve fechar o modal após onSave completar (ou falhar)
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalContainer}
      >
        {/* Overlay */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        {/* Conteúdo */}
        <View style={[styles.modalContentContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.modalHeader}>
            <View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} />
          </View>

          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>{label} "{itemNameToRename}":</Text>

          {/* Input */}
          <TextInput
            style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
            placeholder={placeholder}
            placeholderTextColor={colors.placeholder}
            value={newName}
            onChangeText={setNewName}
            autoCapitalize="words" // Capitaliza palavras por padrão
            autoFocus={true} // Foca no input ao abrir
            onSubmitEditing={handleSavePress} // Tenta salvar com 'Enter'
            returnKeyType="done"
          />

          {/* Botões */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}
              disabled={isSaving}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText, { color: colors.textSecondary }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }]}
              onPress={handleSavePress}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text style={[styles.buttonText, styles.saveButtonText, { color: colors.textOnPrimary }]}>
                  Salvar
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const screenHeight = Dimensions.get('window').height;
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContentContainer: {
    width: '100%',
    minHeight: screenHeight * 0.3, // Altura mínima
    maxHeight: screenHeight * 0.45, // Altura máxima
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 30,
    paddingTop: 10,
    alignItems: 'center',
  },
  modalHeader: { width: '100%', alignItems: 'center', marginBottom: 15 },
  modalHandle: { width: 40, height: 5, borderRadius: 4 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  modalLabel: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  modalInput: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    width: '100%',
    marginBottom: 25, // Espaço antes dos botões
  },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  button: { flex: 1, paddingVertical: 14, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginHorizontal: 5 },
  cancelButton: { backgroundColor: colors.backgroundPrimary, borderWidth: 1 },
  saveButton: { /* backgroundColor definido inline */ },
  buttonText: { fontSize: 16, fontWeight: 'bold' },
  cancelButtonText: { /* color definido inline */ },
  saveButtonText: { /* color definido inline */ },
});

export default RenameModal;

