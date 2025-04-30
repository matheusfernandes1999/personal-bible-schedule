// components/vidacrista/ImportScheduleModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal,
  TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Dimensions, ScrollView, Linking
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { showMessage } from 'react-native-flash-message';
import { collection, doc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VidaCristaSchedule, VidaCristaAssignment, CongregationData } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse'; // Importa papaparse

// Funções auxiliares de data (manter ou mover para utils)
const getMonday = (d: Date): Date => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
};
const formatDateForDocId = (d: Date): string => {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};
// Função para parsear a data do CSV (ajuste o formato se necessário)
const parseDateFromCSV = (dateString: string): Date | null => {
    // Exemplo: Assume formato "DD de MMMM" (ex: "7 de Maio")
    // Adapte esta lógica para o formato exato do seu CSV
    const months: { [key: string]: number } = {
        'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5,
        'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
    };
    const parts = dateString.toLowerCase().split(' de ');
    if (parts.length === 2) {
        const day = parseInt(parts[0], 10);
        const monthName = parts[1];
        const month = months[monthName];
        if (!isNaN(day) && month !== undefined) {
            const currentYear = new Date().getFullYear(); // Assume ano atual
            // Poderia precisar de lógica mais robusta para o ano se o CSV cobrir virada de ano
            const date = new Date(currentYear, month, day);
             // Validação básica
             if (date.getDate() === day && date.getMonth() === month) {
                return date;
            }
        }
    }
    console.warn(`Formato de data inválido no CSV: "${dateString}"`);
    return null;
};


interface ImportScheduleModalProps {
  isVisible: boolean;
  onClose: () => void;
  onImportSuccess: () => void; // Callback para sucesso
  congregationId: string;
}

const ImportScheduleModal: React.FC<ImportScheduleModalProps> = ({
  isVisible,
  onClose,
  onImportSuccess,
  congregationId,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth(); // Pega usuário para 'updatedBy'
  const styles = createStyles(colors);

  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState<VidaCristaSchedule[]>([]); // Armazena programações por semana

  // Limpa estados ao fechar
  useEffect(() => {
    if (!isVisible) {
      setSelectedFile(null);
      setIsParsing(false);
      setIsUploading(false);
      setParsedData([]);
    }
  }, [isVisible]);

  // --- Seleção de Arquivo ---
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Permite apenas CSV
        copyToCacheDirectory: true, // Necessário para ler o conteúdo
      });

      console.log("Document Picker result:", JSON.stringify(result, null, 2));

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedFile(result.assets[0]);
        setParsedData([]); // Limpa dados antigos ao selecionar novo arquivo
        console.log("Arquivo selecionado:", result.assets[0].name);
      } else {
        console.log("Seleção de arquivo cancelada ou sem assets.");
        setSelectedFile(null);
      }
    } catch (error) {
      console.error("Erro ao selecionar documento:", error);
      showMessage({ message: "Erro", description: "Não foi possível selecionar o arquivo.", type: "danger" });
      setSelectedFile(null);
    }
  };

  // --- Parsing do CSV ---
  const handleParseCSV = async () => {
    if (!selectedFile || !selectedFile.uri) {
      showMessage({ message: "Nenhum arquivo selecionado", type: "warning" });
      return;
    }

    setIsParsing(true);
    setParsedData([]); // Limpa dados anteriores

    try {
        // Expo Go não tem acesso direto a 'fs', precisamos ler via fetch ou FileSystem API
        // Usando fetch para simplicidade (funciona com o cache do DocumentPicker)
        const response = await fetch(selectedFile.uri);
        const csvString = await response.text();

        console.log("CSV Lido:\n", csvString.substring(0, 300) + "..."); // Log do início do CSV

        Papa.parse<any>(csvString, {
            header: true, // Assume que a primeira linha é o cabeçalho
            skipEmptyLines: true,
            complete: (results) => {
                console.log("PapaParse results:", results.data.length, "linhas encontradas.");
                if (results.errors.length > 0) {
                    console.error("Erros no parsing:", results.errors);
                    showMessage({ message: "Erro no Arquivo", description: `Erro ao ler CSV: ${results.errors[0].message}`, type: "danger"});
                    setIsParsing(false);
                    return;
                }
                processParsedData(results.data);
            },
            error: (error: Error) => {
                console.error("Erro no PapaParse:", error);
                showMessage({ message: "Erro no Arquivo", description: `Não foi possível processar o CSV: ${error.message}`, type: "danger"});
                setIsParsing(false);
            }
        });

    } catch (error: any) {
        console.error("Erro ao ler ou parsear CSV:", error);
        showMessage({ message: "Erro", description: `Falha ao processar arquivo: ${error.message}`, type: "danger" });
        setIsParsing(false);
    }
  };

  // --- Processamento dos Dados Parseados ---
  const processParsedData = (data: any[]) => {
    const schedulesByWeek: { [weekId: string]: VidaCristaSchedule } = {};
    let processingErrors = 0;

    data.forEach((row, index) => {
      // <<< Verifica novas colunas obrigatórias e opcionais >>>
      const headers = Object.keys(row).map(h => h.trim().toLowerCase());
      const requiredHeaders = ['numero_parte', 'nome', 'data']; // Colunas essenciais
      const optionalHeaders = ['tema', 'tempo', 'ajudante', 'idioma']; // Colunas opcionais
      if (!requiredHeaders.every(h => headers.includes(h) && row[h]?.trim())) {
          console.warn(`Linha ${index + 2}: Dados obrigatórios faltando (${requiredHeaders.join(', ')}). Pulando linha.`);
          processingErrors++;
          return; // Pula linha inválida
      }

      // Normaliza nomes das chaves
      const normalizedRow: { [key: string]: string } = {};
      [...requiredHeaders, ...optionalHeaders].forEach(header => {
           // Encontra a chave original no objeto row (case-insensitive, trim)
           const originalKey = Object.keys(row).find(k => k.trim().toLowerCase() === header);
           if (originalKey) {
               normalizedRow[header] = row[originalKey]?.trim() ?? '';
           } else {
               normalizedRow[header] = ''; // Define como vazio se coluna opcional não existir
           }
      });

      // <<< Usa as novas chaves normalizadas >>>
      const { numero_parte, tema, tempo, nome, ajudante, idioma, data: dateStr } = normalizedRow;

      const assignmentDate = parseDateFromCSV(dateStr);
      if (!assignmentDate) { /* ... pula linha ... */ processingErrors++; return; }

      const weekStartDate = getMonday(assignmentDate);
      const weekId = formatDateForDocId(weekStartDate);

      if (!schedulesByWeek[weekId]) {
        schedulesByWeek[weekId] = {
          weekStartDate: Timestamp.fromDate(weekStartDate),
          assignments: [],
        };
      }

      // <<< Cria a designação com os novos campos >>>
      const assignment: VidaCristaAssignment = {
        id: `${weekId}-${numero_parte}-${index}`, // ID único simples
        numero_parte: numero_parte,
        tema: tema || null, // Define como null se vazio
        tempo: tempo || null, // Define como null se vazio
        participantName: nome,
        assistantName: ajudante || null, // Define como null se vazio
        language: idioma || undefined, // Define como undefined se vazio
      };

      schedulesByWeek[weekId].assignments.push(assignment);
    });

    const finalSchedules = Object.values(schedulesByWeek);
    console.log("Processamento concluído. Semanas encontradas:", finalSchedules.length, "Erros:", processingErrors);

    if (finalSchedules.length > 0) {
        setParsedData(finalSchedules);
        showMessage({ message: "Arquivo Processado", description: `${finalSchedules.length} semanas de programação encontradas.`, type: "info"});
    } else {
         showMessage({ message: "Nenhum Dado Válido", description: "Não foi possível encontrar programações válidas no arquivo.", type: "warning"});
    }
    if (processingErrors > 0) {
         showMessage({ message: "Atenção", description: `${processingErrors} linhas foram ignoradas devido a dados inválidos ou formato incorreto.`, type: "warning", duration: 5000});
    }

    setIsParsing(false);
  };


  // --- Upload para Firestore ---
  const handleUploadToFirestore = async () => {
    if (parsedData.length === 0) {
      showMessage({ message: "Nenhum dado para enviar", type: "warning" });
      return;
    }
    if (!user || !congregationId) {
       showMessage({ message: "Erro", description: "Usuário ou congregação não identificados.", type: "danger" });
       return;
    }

    setIsUploading(true);
    try {
      const batch = writeBatch(db);
      const scheduleColRef = collection(db, "congregations", congregationId, "nossaVidaCristaSchedule");

      parsedData.forEach(schedule => {
        const weekId = formatDateForDocId(schedule.weekStartDate instanceof Timestamp ? schedule.weekStartDate.toDate() : schedule.weekStartDate);
        const weekDocRef = doc(scheduleColRef, weekId);
        // Prepara dados para salvar, incluindo campos de auditoria
        const dataToSave = {
            ...schedule,
            assignments: schedule.assignments, // Garante que o array está correto
            lastUpdatedAt: serverTimestamp(),
            updatedBy: user.uid,
        };
        // Usa set com merge para criar ou sobrescrever o documento da semana
        batch.set(weekDocRef, dataToSave, { merge: true });
        console.log(`Batch: Adicionado set/merge para semana ${weekId}`);
      });

      await batch.commit();
      console.log("Batch de upload de programação commitado.");

      showMessage({ message: "Sucesso!", description: `${parsedData.length} semanas de programação importadas.`, type: "success" });
      onImportSuccess(); // Chama callback do pai
      onClose(); // Fecha o modal

    } catch (error: any) {
      console.error("Erro ao fazer upload para Firestore:", error);
      showMessage({ message: "Erro no Upload", description: error.message || "Não foi possível salvar a programação.", type: "danger" });
    } finally {
      setIsUploading(false);
    }
  };


  // --- Renderização ---
  const isLoading = isParsing || isUploading;

  return (
    <Modal animationType="slide" transparent={true} visible={isVisible} onRequestClose={onClose} >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer} >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={[styles.modalContentContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} /></View>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Importar Programação (CSV)</Text>

          <ScrollView style={styles.formScrollView} contentContainerStyle={styles.formContent}>
            {/* Instruções */}
            <Text style={[styles.instructions, { color: colors.textSecondary }]}>
              Selecione um arquivo CSV com as colunas: <Text style={styles.bold}>part_number, nome, ajudante, idioma, data</Text>. A data deve estar no formato "DD de MMMM" (ex: "07 de Maio").
            </Text>

            {/* Botão Selecionar Arquivo */}
            <TouchableOpacity
              style={[styles.selectButton, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}
              onPress={handlePickDocument}
              disabled={isLoading}
            >
                <Ionicons name="document-attach-outline" size={22} color={colors.primary} style={{marginRight: 10}}/>
                <Text style={[styles.selectButtonText, { color: selectedFile ? colors.textPrimary : colors.textSecondary }]}>
                    {selectedFile ? selectedFile.name : 'Selecionar Arquivo CSV'}
                </Text>
                {selectedFile && (
                    <TouchableOpacity onPress={() => setSelectedFile(null)} style={{ paddingLeft: 10 }}>
                        <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                )}
            </TouchableOpacity>

            {/* Botão Processar Arquivo */}
            {selectedFile && !parsedData.length && ( // Mostra só se tem arquivo e não foi parseado
                 <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.secondary }]}
                    onPress={handleParseCSV}
                    disabled={isParsing || isUploading}
                >
                    {isParsing ? <ActivityIndicator color={colors.textOnSecondary} />
                    : <Text style={[styles.actionButtonText, { color: colors.textOnSecondary }]}>Processar Arquivo</Text> }
                </TouchableOpacity>
            )}

             {/* Feedback do Processamento */}
             {parsedData.length > 0 && (
                <View style={styles.summaryContainer}>
                     <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                     <Text style={[styles.summaryText, { color: colors.success }]}>{parsedData.length} semanas prontas para importar.</Text>
                </View>
             )}


            {/* Botão Enviar para Firebase */}
            {parsedData.length > 0 && ( // Mostra só se tem dados parseados
                <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: isLoading ? colors.primaryLight : colors.primary, opacity: isLoading ? 0.7 : 1 }]}
                onPress={handleUploadToFirestore}
                disabled={isLoading}
                >
                {isUploading ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                    <Text style={[styles.modalButtonText, { color: colors.textOnPrimary }]}>
                    Importar Programação
                    </Text>
                )}
                </TouchableOpacity>
            )}

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// --- Estilos ---
const screenHeight = Dimensions.get('window').height;
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContentContainer: { width: '100%', maxHeight: screenHeight * 0.7, borderTopRightRadius: 20, borderTopLeftRadius: 20, },
  modalHeader: { width: '100%', alignItems: 'center', paddingTop: 10, marginBottom: 5, backgroundColor: colors.backgroundSecondary, borderTopRightRadius: 20, borderTopLeftRadius: 20, },
  modalHandle: { width: 40, height: 5, borderRadius: 4, },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', paddingHorizontal: 24, backgroundColor: colors.backgroundSecondary, paddingTop: 10 },
  formScrollView: { width: '100%', backgroundColor: colors.backgroundSecondary },
  formContent: { paddingHorizontal: 24, paddingBottom: 40, }, // Aumenta padding inferior
  instructions: { fontSize: 14, lineHeight: 20, marginBottom: 20, textAlign: 'center' },
  bold: { fontWeight: 'bold' },
  selectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 15,
      marginBottom: 20,
  },
  selectButtonText: {
      flex: 1, // Ocupa espaço
      fontSize: 16,
      marginRight: 10,
  },
  actionButton: {
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 20,
  },
  actionButtonText: {
      fontSize: 16,
      fontWeight: 'bold',
  },
  summaryContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 15,
      borderRadius: 8,
      backgroundColor: colors.backgroundPrimary, // Fundo ligeiramente diferente
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.success,
  },
  summaryText: {
      marginLeft: 10,
      fontSize: 15,
      fontWeight: '500',
  },
  modalButton: { height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center', width: '100%', marginTop: 10, },
  modalButtonText: { fontSize: 16, fontWeight: 'bold', },
  loadingIndicator: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
});

export default ImportScheduleModal;