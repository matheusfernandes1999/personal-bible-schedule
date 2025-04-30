// components/vidacrista/EditAssignmentModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal,
  TextInput, TouchableWithoutFeedback, KeyboardAvoidingView, Platform,
  Dimensions, ScrollView
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { VidaCristaAssignment } from '@/types'; // Importa o tipo
import { showMessage } from 'react-native-flash-message';
// Importar PersonSelector se criado para selecionar nomes
// import PersonSelector from '@/components/common/PersonSelector';

interface EditAssignmentModalProps {
  isVisible: boolean;
  onClose: () => void;
  assignment: VidaCristaAssignment | null; // Designação a ser editada
  // Função para salvar as alterações (recebe a designação atualizada)
  onSave: (updatedAssignment: VidaCristaAssignment) => Promise<void>;
  isSaving?: boolean; // Estado de loading externo
}

const EditAssignmentModal: React.FC<EditAssignmentModalProps> = ({
  isVisible,
  onClose,
  assignment,
  onSave,
  isSaving = false,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // Estados para os campos editáveis
  const [numeroParte, setNumeroParte] = useState(''); // Renomeado
  const [tema, setTema] = useState('');
  const [tempo, setTempo] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [assistantName, setAssistantName] = useState('');
  const [language, setLanguage] = useState('');

  // Preenche os campos quando uma designação é passada
  useEffect(() => {
    if (assignment) {
      setNumeroParte(String(assignment.numero_parte)); // <<< Usa numero_parte
      setTema(assignment.tema || '');                  // <<< Define tema
      setTempo(assignment.tempo || '');                // <<< Define tempo
      setParticipantName(assignment.participantName);
      setAssistantName(assignment.assistantName || '');
      setLanguage(assignment.language || '');
    } else {
      // Limpa
      setNumeroParte(''); setTema(''); setTempo(''); setParticipantName(''); setAssistantName(''); setLanguage('');
    }
  }, [assignment, isVisible]); // Depende da designação e visibilidade

  const handleSaveChanges = () => {
    if (!assignment) return; // Segurança

    const trimmedParticipant = participantName.trim();
    if (!trimmedParticipant) {
        showMessage({ message: "Nome do Participante Obrigatório", type: "warning" });
        return;
    }

    // <<< Monta objeto atualizado com novos campos >>>
    const updatedAssignment: VidaCristaAssignment = {
      ...assignment,
      numero_parte: numeroParte.trim(), // <<< Usa numero_parte
      tema: tema.trim() || null,
      tempo: tempo.trim() || null,
      participantName: trimmedParticipant,
      assistantName: assistantName.trim() || null,
      language: language.trim() || undefined,
    };
    onSave(updatedAssignment);
  };

  return (
    <Modal animationType="slide" transparent={true} visible={isVisible} onRequestClose={onClose} >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer} >
        <TouchableWithoutFeedback onPress={onClose}><View style={styles.modalOverlay} /></TouchableWithoutFeedback>
        <View style={[styles.modalContentContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} /></View>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Editar Designação</Text>

          <ScrollView style={styles.formScrollView} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">

            {/* Número da Parte */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Parte Nº</Text>
            <TextInput style={[styles.modalInput, styles.readOnlyInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} value={numeroParte} editable={false} />

            {/* <<< Campo Tema >>> */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Tema</Text>
            <TextInput style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Tema da parte" value={tema} onChangeText={setTema} autoCapitalize="sentences"/>

             {/* <<< Campo Tempo >>> */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Tempo</Text>
            <TextInput style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Ex: 10 min" value={tempo} onChangeText={setTempo} />

            {/* Nome do Participante */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Participante Principal*</Text>
            <TextInput style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Nome do Participante" value={participantName} onChangeText={setParticipantName} autoCapitalize="words"/>

            {/* Nome do Ajudante */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Ajudante (Opcional)</Text>
            <TextInput style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Nome do Ajudante" value={assistantName} onChangeText={setAssistantName} autoCapitalize="words"/>

             {/* Idioma */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Idioma (Opcional)</Text>
            <TextInput style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Ex: Português, Hunsrik" value={language} onChangeText={setLanguage} autoCapitalize="words"/>

            {/* Botão Salvar */}
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: isSaving ? colors.primaryLight : colors.primary, opacity: isSaving ? 0.7 : 1 }]} onPress={handleSaveChanges} disabled={isSaving} >
              {isSaving ? ( <ActivityIndicator size="small" color={colors.textOnPrimary} /> )
              : ( <Text style={[styles.modalButtonText, { color: colors.textOnPrimary }]}> Salvar Alterações </Text> )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const screenHeight = Dimensions.get('window').height;
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContentContainer: { width: '100%', maxHeight: screenHeight * 0.7, borderTopRightRadius: 20, borderTopLeftRadius: 20, },
  modalHeader: { width: '100%', alignItems: 'center', paddingTop: 10, marginBottom: 5, backgroundColor: colors.backgroundSecondary, borderTopRightRadius: 20, borderTopLeftRadius: 20, },
  modalHandle: { width: 40, height: 5, borderRadius: 4, },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', paddingHorizontal: 24, backgroundColor: colors.backgroundSecondary, paddingTop: 10 },
  formScrollView: { width: '100%', backgroundColor: colors.backgroundSecondary },
  formContent: { paddingHorizontal: 24, paddingBottom: 30, },
  inputLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 6, alignSelf: 'flex-start', width: '100%', marginTop: 10 },
  modalInput: { height: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, fontSize: 16, width: '100%', marginBottom: 15, },
  readOnlyInput: { fontStyle: 'italic' }, // Estilo para campo não editável
  modalButton: { height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center', width: '100%', marginTop: 20, },
  modalButtonText: { fontSize: 16, fontWeight: 'bold', },
});

export default EditAssignmentModal;
