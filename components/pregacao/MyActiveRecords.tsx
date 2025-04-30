// components/pregacao/MyActiveRecords.tsx
import React, { useState, useEffect, useCallback } from 'react'; // <<< Adiciona useCallback
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native'; // <<< Remove Alert
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { TerritoryRecordData } from '@/types';
import { showMessage } from 'react-native-flash-message';
import ConfirmationModal from '@/components/common/ConfirmationModal';

const MyActiveRecords = () => {
  const { colors } = useTheme();
  const { user, userData, loading: authLoading } = useAuth();
  const [myActiveRecords, setMyActiveRecords] = useState<TerritoryRecordData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);

  const [isConfirmReturnVisible, setIsConfirmReturnVisible] = useState(false);
  const [recordToReturn, setRecordToReturn] = useState<TerritoryRecordData | null>(null);

  useEffect(() => {
    const congregationId = userData?.congregationId;
    const userId = user?.uid;

    if (authLoading || !congregationId || !userId) {
      setLoading(false);
      setMyActiveRecords([]);
      return;
    }

    setLoading(true);
    console.log(`MyActiveRecords: Buscando registros ativos para ${userId} em ${congregationId}`);
    const recordsRef = collection(db, "congregations", congregationId, "territoryRecords");
    const q = query(recordsRef,
        where("status", "==", "Ativo"),
        where("personId", "==", userId),
        orderBy("startDate", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: TerritoryRecordData[] = [];
      snapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() } as TerritoryRecordData);
      });
      setMyActiveRecords(records);
      setLoading(false);
      console.log(`MyActiveRecords: ${records.length} registros ativos encontrados para ${userId}.`);
    }, (error) => {
      console.error("Erro ao buscar meus registros ativos:", error);
      showMessage({ message: "Erro", description: "Não foi possível carregar seus registros.", type: "danger" });
      setLoading(false);
    });

    // Limpa o listener
    return () => {
        console.log("MyActiveRecords: Limpando listener.");
        unsubscribe();
    };
  }, [authLoading, userData]);
  
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
      if (!recordToReturn || !userData?.congregationId || !user) {
          showMessage({ message: "Erro", description: "Não foi possível identificar o registro ou usuário.", type: "danger" });
          handleCloseConfirmReturn(); // Fecha o modal mesmo em caso de erro inicial
          return;
      }
      const currentCongregationId = userData.congregationId;
      const record = recordToReturn; // Usa o registro guardado no estado

      setIsProcessingReturn(true);
      try {
          const batch = writeBatch(db);
          const recordDocRef = doc(db, "congregations", currentCongregationId, "territoryRecords", record.id!);
          batch.update(recordDocRef, { status: 'Completo', endDate: serverTimestamp() });
          const cardDocRef = doc(db, "congregations", currentCongregationId, "territoryCards", record.cardId);
          batch.update(cardDocRef, { status: 'Disponível', lastReturnDate: serverTimestamp() });
          await batch.commit();
          showMessage({ message: "Sucesso", description: `Cartão ${record.cardNumber} devolvido.`, type: "success"});
      } catch (error: any) {
          console.error("Erro ao devolver cartão:", error);
          showMessage({ message: "Erro", description: error.message || "Não foi possível registrar a devolução.", type: "danger" });
      } finally {
          setIsProcessingReturn(false);
          handleCloseConfirmReturn(); // Fecha o modal após a operação
      }
  };

    const renderRecordItem = ({ item }: { item: TerritoryRecordData }) => {
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
    const daysInProgress = calculateDaysInProgress(item.startDate);

    return (
        <View style={[styles.recordItem, { borderColor: colors.border }]}>
            <View style={styles.recordInfo}>
                <Text style={[styles.recordCardNumber, { color: colors.primary }]}>Cartão: {item.cardNumber}</Text>
                <Text style={[styles.recordDate, { color: colors.textSecondary }]}>
                    {daysInProgress} dia(s) desde {item.startDate ? (item.startDate instanceof Timestamp ? item.startDate.toDate() : item.startDate).toLocaleDateString() : 'N/A'}
                </Text>
            </View>
            <TouchableOpacity
                style={[styles.returnButton, { backgroundColor: colors.secondary }]}
                onPress={() => confirmReturnCard(item)}
                disabled={isProcessingReturn}
            >
                <Text style={[styles.returnButtonText, { color: colors.textOnSecondary }]}>Devolver</Text>
            </TouchableOpacity>
        </View>
    );
  };

  const styles = createStyles(colors);

  if (authLoading || !userData?.congregationId || !user?.uid) { return null; }
  if (loading) { return <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />; }
  if (myActiveRecords.length === 0) { return (
    <>
      <Text style={[styles.subtitle, { color: colors.textPrimary }]}>
        Seus territórios ativos
      </Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Você não tem territórios em campo.</Text>
    </>
    )}

  return (
    <>  
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Seus territórios ativos
        </Text>
        <FlatList
        data={myActiveRecords}
        renderItem={renderRecordItem}
        keyExtractor={(item) => item.id!}
        scrollEnabled={false}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        />

        <ConfirmationModal
            isVisible={isConfirmReturnVisible}
            onClose={handleCloseConfirmReturn}
            onConfirm={executeReturnCard}
            title="Confirmar Devolução"
            message={`Tem certeza que deseja devolver o cartão "${recordToReturn?.cardNumber}"?`}
            confirmText="Confirmar"
            cancelText="Cancelar"
            isConfirming={isProcessingReturn}
        />
    </>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  loadingIndicator: { marginTop: 20, marginBottom: 20, },
  subtitle: {
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 15,
    fontWeight: 'bold'
  },
  emptyText: { textAlign: 'center', marginTop: 10, fontSize: 15, paddingBottom: 15, marginBottom: 20 },
  list: { width: '100%', },
  listContent: { paddingBottom: 10 },
  recordItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, },
  recordInfo: { flex: 1, marginRight: 10, },
  recordCardNumber: { fontSize: 15, fontWeight: 'bold', },
  recordDate: { fontSize: 12, marginTop: 4, },
  returnButton: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, minWidth: 80, alignItems: 'center', },
  returnButtonText: { fontSize: 13, fontWeight: 'bold', },
});

export default MyActiveRecords;
