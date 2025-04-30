// components/pregacao/SectionCardViewerModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Modal, TouchableWithoutFeedback, FlatList, Dimensions, Platform, Image,
  KeyboardAvoidingView
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { collection, query, where, onSnapshot, Unsubscribe, orderBy, Timestamp } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { TerritoryCardData } from '@/types';
import { showMessage } from 'react-native-flash-message';
import { Ionicons } from '@expo/vector-icons';

interface SectionCardViewerModalProps {
  isVisible: boolean;
  onClose: () => void;
  congregationId: string;
  city: string;
  section: string;
}

const SectionCardViewerModal: React.FC<SectionCardViewerModalProps> = ({
  isVisible,
  onClose,
  congregationId,
  city,
  section,
}) => {
  const { colors } = useTheme();
  const [cards, setCards] = useState<TerritoryCardData[]>([]);
  const [loading, setLoading] = useState(true);

  // Busca os cartões da seção específica
  useEffect(() => {
    let unsubscribe: Unsubscribe | null = null;
    if (isVisible && congregationId && city && section) {
      setLoading(true);
      setCards([]); // Limpa antes de buscar
      console.log(`SectionCardViewerModal: Buscando cartões para ${city} - ${section}`);
      const cardsRef = collection(db, "congregations", congregationId, "territoryCards");
      const q = query(cardsRef, where("city", "==", city), where("section", "==", section));

      unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedCards: TerritoryCardData[] = [];
        snapshot.forEach((doc) => {
          fetchedCards.push({ id: doc.id, ...doc.data() } as TerritoryCardData);
        });
        setCards(fetchedCards.sort((a, b) =>
            a.cardNumber.localeCompare(b.cardNumber, undefined, { numeric: true, sensitivity: 'base' })
        ));
        setLoading(false);
      }, (error) => {
        console.error("Erro ao buscar cartões da seção:", error);
        showMessage({ message: "Erro", description: "Não foi possível carregar os cartões.", type: "danger" });
        setLoading(false);
      });

    } else {
      setCards([]);
      setLoading(false);
    }
    return () => { if (unsubscribe) unsubscribe(); };
  }, [isVisible, congregationId, city, section]);

  // Função para formatar data
  const formatDate = (date: Timestamp | Date | undefined | null): string => {
      if (!date) return 'N/A';
      const jsDate = (date instanceof Timestamp) ? date.toDate() : date;
      return jsDate.toLocaleDateString();
  };

  // Renderiza cada item de cartão na lista
  const renderCardItem = ({ item }: { item: TerritoryCardData }) => (
    <View style={[styles.cardItem, { backgroundColor: colors.backgroundPrimary, borderColor: colors.border }]}>
       {/* Imagem ou Placeholder */}
        <View style={[styles.cardImagePlaceholder, { backgroundColor: colors.border }]}>
            {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
            ) : (
                <Ionicons name="image-outline" size={24} color={colors.textMuted} />
            )}
        </View>
       {/* Informações */}
       <View style={styles.cardInfo}>
            <Text style={[styles.cardNumber, { color: colors.textPrimary }]}>{item.cardNumber}</Text>
            {/* Status */}
            <Text style={[styles.cardDetail, { color: item.status === 'Disponível' ? colors.success : (item.status === 'Em campo' ? colors.warning : colors.error) }]}>
                Status: {item.status}
            </Text>
            {/* Última vez trabalhado */}
            {item.lastReturnDate && (
                 <Text style={[styles.cardDetail, { color: colors.textSecondary }]}>
                    Últ. Devolução: {formatDate(item.lastReturnDate)}
                 </Text>
            )}
             {/* Por quem (se disponível) */}
             {item.lastWorkedByName && (
                 <Text style={[styles.cardDetail, { color: colors.textSecondary }]}>
                    Por: {item.lastWorkedByName}
                 </Text>
            )}
       </View>
       {/* Adicionar botão para ver histórico completo do cartão aqui se desejar */}
    </View>
  );

  const styles = createStyles(colors);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      {/* KeyboardAvoidingView não é essencial aqui, mas mantém consistência */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalKeyboardAvoidingView} >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={[styles.modalContentContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} /></View>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Cartões - {section}</Text>
          <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>{city}</Text>

          {/* Lista de Cartões */}
          <View style={styles.listContainer}>
            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={styles.loading} />
            ) : (
                <FlatList
                    data={cards}
                    renderItem={renderCardItem}
                    keyExtractor={(item) => item.id!}
                    style={styles.cardList}
                    contentContainerStyle={styles.cardListContent}
                    ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum cartão encontrado.</Text>}
                />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// --- Estilos ---
const screenHeight = Dimensions.get('window').height;
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  modalKeyboardAvoidingView: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContentContainer: {
      width: '100%', maxHeight: screenHeight * 0.75, // Altura ajustada
      borderTopRightRadius: 20, borderTopLeftRadius: 20, paddingBottom: 20,
  },
  modalHeader: { width: '100%', alignItems: 'center', paddingTop: 10, marginBottom: 5, backgroundColor: colors.backgroundSecondary, borderTopRightRadius: 20, borderTopLeftRadius: 20, },
  modalHandle: { width: 40, height: 5, borderRadius: 4, },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 2, textAlign: 'center', paddingHorizontal: 24, backgroundColor: colors.backgroundSecondary },
  modalSubtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 15, paddingHorizontal: 24, backgroundColor: colors.backgroundSecondary },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
  listContainer: { width: '100%', backgroundColor: colors.backgroundSecondary }, // Container da lista
  cardList: { width: '100%', paddingHorizontal: 20, },
  cardListContent: { paddingBottom: 20, flexGrow: 1 },
  emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16 },
  cardItem: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14,
      marginBottom: 10, borderRadius: 8, borderWidth: 1,
  },
  cardImagePlaceholder: { width: 45, height: 45, borderRadius: 4, marginRight: 12, justifyContent: 'center', alignItems: 'center', },
  cardImage: { width: 45, height: 45, borderRadius: 4, },
  cardInfo: { flex: 1, },
  cardNumber: { fontSize: 15, fontWeight: 'bold', marginBottom: 3, },
  cardDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 2, }, // Estilo genérico para detalhes
});

export default SectionCardViewerModal;

