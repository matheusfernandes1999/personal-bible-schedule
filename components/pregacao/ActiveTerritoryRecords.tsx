// components/pregacao/ActiveTerritoryRecords.tsx
import React, { useState, useEffect, useCallback } from 'react'; // <<< Adiciona useCallback
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity /*, Alert */ } from 'react-native'; // <<< Remove Alert
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext'; // <<< Importa useAuth (necessário para pegar user)
import { collection, query, where, onSnapshot, Unsubscribe, orderBy, Timestamp, doc, writeBatch, serverTimestamp } from "firebase/firestore"; // <<< Importa writeBatch, doc, updateDoc, serverTimestamp
import { db } from '@/lib/firebase';
import { TerritoryRecordData } from '@/types';
import { showMessage } from 'react-native-flash-message';
import { Ionicons } from '@expo/vector-icons';
import ConfirmationModal from '@/components/common/ConfirmationModal'; // <<< Importa ConfirmationModal

// Remove props onReturnCard, congregationId, userId, disabled
interface ActiveTerritoryRecordsProps {
    // Pode adicionar outras props de estilo ou filtro no futuro, se necessário
}

// Função auxiliar para calcular dias em andamento
const calculateDaysInProgress = (startDate: Timestamp | Date | undefined | null): number => {
  if (!startDate) return 0;
  const start = (startDate instanceof Timestamp) ? startDate.toDate() : startDate;
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(today.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};


const ActiveTerritoryRecords: React.FC<ActiveTerritoryRecordsProps> = () => {
  const { colors } = useTheme();
  const { user, userData, loading: authLoading } = useAuth(); // <<< Pega dados do contexto
  const [activeRecords, setActiveRecords] = useState<TerritoryRecordData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessingReturn, setIsProcessingReturn] = useState(false); // <<< Loading específico para devolver

  // <<< Estados para o Modal de Confirmação >>>
  const [isConfirmReturnVisible, setIsConfirmReturnVisible] = useState(false);
  const [recordToReturn, setRecordToReturn] = useState<TerritoryRecordData | null>(null);

  // Busca registros ATIVOS associados ao USUÁRIO LOGADO
  useEffect(() => {
    // Usa dados do contexto
    const congregationId = userData?.congregationId;
    const userId = user?.uid;

    // Verifica se os IDs necessários estão presentes
    if (authLoading || !congregationId || !userId) {
      setLoading(false);
      setActiveRecords([]);
      // Não mostra aviso aqui, a tela pai deve lidar com usuário sem congregação
      return;
    }

    setLoading(true);
    console.log(`ActiveTerritoryRecords: Buscando registros ativos para ${userId} em ${congregationId}`);
    const recordsRef = collection(db, "congregations", congregationId, "territoryRecords");
    const q = query(recordsRef,
        where("status", "==", "Ativo"),
        // Se este componente for SÓ para o usuário logado, mantém este where
        // where("personId", "==", userId),
        orderBy("startDate", "asc") // Ordena pelos mais antigos primeiro
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: TerritoryRecordData[] = [];
      snapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() } as TerritoryRecordData);
      });
      setActiveRecords(records);
      setLoading(false);
      console.log(`ActiveTerritoryRecords: ${records.length} registros ativos encontrados.`);
    }, (error) => {
      console.error("Erro ao buscar registros ativos:", error);
      showMessage({ message: "Erro", description: "Não foi possível carregar os registros ativos.", type: "danger" });
      setLoading(false);
    });

    // Limpa o listener
    return () => {
        console.log("ActiveTerritoryRecords: Limpando listener.");
        unsubscribe();
    };
    // Depende APENAS do congregationId e authLoading, pois busca TODOS os ativos
  }, [authLoading, userData]); // <<< Dependência atualizada

  // --- Lógica para Devolver Cartão ---

  // 1. Abre o modal de confirmação
  const confirmReturnCard = useCallback((record: TerritoryRecordData) => {
    setRecordToReturn(record); // Guarda o registro a ser devolvido
    setIsConfirmReturnVisible(true); // Abre o modal
  }, []);

  // 2. Fecha o modal de confirmação
  const handleCloseConfirmReturn = useCallback(() => {
    setIsConfirmReturnVisible(false);
    setRecordToReturn(null); // Limpa o registro
  }, []);

  // 3. Executa a devolução (chamado pelo onConfirm do ConfirmationModal)
  const executeReturnCard = async () => {
      // Usa recordToReturn do estado
      if (!recordToReturn || !userData?.congregationId || !user) {
          showMessage({ message: "Erro", description: "Não foi possível identificar o registro ou usuário.", type: "danger" });
          handleCloseConfirmReturn();
          return;
      }
      const currentCongregationId = userData.congregationId;
      const record = recordToReturn;

      setIsProcessingReturn(true);
      try {
          const batch = writeBatch(db);
          const recordDocRef = doc(db, "congregations", currentCongregationId, "territoryRecords", record.id!);
          batch.update(recordDocRef, { status: 'Completo', endDate: serverTimestamp() });
          const cardDocRef = doc(db, "congregations", currentCongregationId, "territoryCards", record.cardId);
          batch.update(cardDocRef, { status: 'Disponível', lastReturnDate: serverTimestamp() });
          await batch.commit();
          showMessage({ message: "Sucesso", description: `Cartão ${record.cardNumber} devolvido.`, type: "success"});
          // A lista atualiza via listener
      } catch (error: any) {
          console.error("Erro ao devolver cartão:", error);
          showMessage({ message: "Erro", description: error.message || "Não foi possível registrar a devolução.", type: "danger" });
      } finally {
          setIsProcessingReturn(false);
          handleCloseConfirmReturn(); // Fecha o modal após a operação
      }
  };

  // Renderiza cada item de registro
  const renderRecordItem = ({ item }: { item: TerritoryRecordData }) => {
    const daysInProgress = calculateDaysInProgress(item.startDate);

    return (
        <View style={[styles.recordItem, { borderColor: colors.border }]}>
            <View style={styles.recordInfo}>
                <Text style={[styles.recordCardNumber, { color: colors.primary }]}>Cartão: {item.cardNumber}</Text>
                {/* Exibe quem está com o cartão */}
                <Text style={[styles.recordPerson, { color: colors.textPrimary }]}>Com: {item.personName}</Text>
                <Text style={[styles.recordDate, { color: colors.textSecondary }]}>
                    {daysInProgress} dia(s) (desde {item.startDate ? (item.startDate instanceof Timestamp ? item.startDate.toDate() : item.startDate).toLocaleDateString() : 'N/A'})
                </Text>
            </View>
            <TouchableOpacity
                style={[styles.returnButton, { backgroundColor: colors.secondary }]}
                onPress={() => confirmReturnCard(item)} // <<< Chama a função para abrir o modal
                disabled={isProcessingReturn} // <<< Desabilita durante o processamento da devolução
            >
                {/* Não precisa mais do ActivityIndicator aqui, o ConfirmationModal cuida disso */}
                <Text style={[styles.returnButtonText, { color: colors.textOnSecondary }]}>Devolver</Text>
            </TouchableOpacity>
        </View>
    );
  };

  const styles = createStyles(colors);

  // Não mostra nada se auth ainda estiver carregando ou se não houver congregationId
  if (authLoading || !userData?.congregationId) {
      return null; // Ou um indicador de loading menor
  }

  // Mostra loading específico do componente
  if (loading) {
    return <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />;
  }

  // Mostra mensagem se não houver registros ativos
  if (activeRecords.length === 0) {
    return <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum território em campo no momento.</Text>;
  }

  // Renderiza a lista e o modal de confirmação
  return (
    <>
        <FlatList
        data={activeRecords}
        renderItem={renderRecordItem}
        keyExtractor={(item) => item.id!}
        scrollEnabled={false} // Assume que está dentro de um ScrollView maior
        style={styles.list}
        contentContainerStyle={styles.listContent}
        />

        {/* <<< Renderiza o Modal de Confirmação >>> */}
        <ConfirmationModal
            isVisible={isConfirmReturnVisible}
            onClose={handleCloseConfirmReturn}
            onConfirm={executeReturnCard} // <<< Chama a função que executa a lógica
            title="Confirmar Devolução"
            message={`Tem certeza que deseja devolver o cartão "${recordToReturn?.cardNumber}" trabalhado por ${recordToReturn?.personName}?`} // <<< Mensagem mais informativa
            confirmText="Confirmar"
            cancelText="Cancelar"
            isConfirming={isProcessingReturn} // <<< Passa o estado de loading
            // confirmButtonStyle pode ser 'default' ou 'destructive'
        />
    </>
  );
};

// --- Estilos ---
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  loadingIndicator: { marginTop: 20, marginBottom: 20, },
  emptyText: { textAlign: 'center', marginTop: 10, fontSize: 15, paddingBottom: 10, },
  list: { width: '100%', },
  listContent: { /* paddingBottom: 10, */ },
  recordItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, },
  recordInfo: { flex: 1, marginRight: 10, },
  recordCardNumber: { fontSize: 15, fontWeight: 'bold', },
  recordPerson: { fontSize: 14, marginTop: 3, }, // <<< Adicionado estilo para nome
  recordDate: { fontSize: 12, marginTop: 4, },
  returnButton: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, minWidth: 80, alignItems: 'center', },
  returnButtonText: { fontSize: 13, fontWeight: 'bold', },
});

export default ActiveTerritoryRecords;
