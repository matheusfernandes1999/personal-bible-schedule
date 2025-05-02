// components/pregacao/SectionDetailModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal, // Importa Modal para o visualizador de imagem também
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  FlatList,
  Alert,
  Image, // Mantém importação da Image
  // TextInput, // Removido se não usado diretamente
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { showMessage } from 'react-native-flash-message';
import { collection, query, where, onSnapshot, Unsubscribe, doc, deleteDoc, updateDoc, Timestamp, runTransaction, getDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TerritoryCardData, TERRITORY_SERVANT_CATEGORY, CongregationData } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import RenameModal from '@/components/common/RenameModal';
import MapViewerBottomSheet from './MapViewerBottomSheet';
// Opcional: Para zoom na imagem (instalar 'react-native-image-zoom-viewer')
// import ImageViewer from 'react-native-image-zoom-viewer';

// Define a Interface de Props para este componente
interface SectionDetailModalProps {
  isVisible: boolean;
  onClose: () => void;
  congregationId: string;
  city: string;
  section: string;
  onDeleteSection: (city: string, section: string) => void;
  onSectionRenamed?: (city: string, oldSection: string, newSection: string) => void;
}

const SectionDetailModal: React.FC<SectionDetailModalProps> = ({
  isVisible,
  onClose,
  congregationId,
  city,
  section,
  onDeleteSection,
  onSectionRenamed,
}) => {
  const { colors } = useTheme();
  const { isAdmin, userCategories } = useAuth();
  const [cards, setCards] = useState<TerritoryCardData[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para Modais Internos
  const [isConfirmDeleteCardVisible, setIsConfirmDeleteCardVisible] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<TerritoryCardData | null>(null);
  const [isRenameCardModalVisible, setIsRenameCardModalVisible] = useState(false);
  const [cardToRename, setCardToRename] = useState<TerritoryCardData | null>(null);
  const [isRenameSectionModalVisible, setIsRenameSectionModalVisible] = useState(false);
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false); // <<< Estado para modal da imagem
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);

  // --- Estados para controlar o Map Viewer ---
  const [isMapViewerVisible, setIsMapViewerVisible] = useState(false);
  const [viewingMapId, setViewingMapId] = useState<string | null>(null);

  // Estados de Loading para Ações
  const [isDeletingCard, setIsDeletingCard] = useState(false);
  const [isRenamingCard, setIsRenamingCard] = useState(false);
  const [isRenamingSection, setIsRenamingSection] = useState(false);

  const canManageTerritories = isAdmin || (userCategories?.includes(TERRITORY_SERVANT_CATEGORY) ?? false);

  const [currentSectionName, setCurrentSectionName] = useState(section);
  useEffect(() => {
      if(isVisible) {
          setCurrentSectionName(section);
      } else {
          // Reset map viewer state when main modal closes
          setIsMapViewerVisible(false); // <<< Ensure map viewer also closes
          setViewingMapId(null);
      }
  }, [isVisible, section]);

useEffect(() => {
  let unsubscribe: Unsubscribe | null = null;
  if (isVisible && congregationId && city && currentSectionName) { // Usa currentSectionName
    setLoading(true);
    setCards([]);
    const cardsRef = collection(db, "congregations", congregationId, "territoryCards");
    // Busca usando o nome atual da seção
    const q = query(cardsRef, where("city", "==", city), where("section", "==", currentSectionName));

    unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedCards: TerritoryCardData[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.cardNumber) fetchedCards.push({ id: doc.id, ...data } as TerritoryCardData);
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
}, [isVisible, congregationId, city, currentSectionName]); // Depende do nome atual da seção

// --- Funções de Ação ---
const handleClose = () => onClose();

// --- Exclusão de Cartão ---
const confirmDeleteCard = (card: TerritoryCardData) => {
    if (!canManageTerritories) return;
    setCardToDelete(card);
    setIsConfirmDeleteCardVisible(true);
};
const deleteCard = async () => {
    if (!cardToDelete?.id || !congregationId || !canManageTerritories) { /* ... */ return; }
    setIsDeletingCard(true);
    try {
        const cardDocRef = doc(db, "congregations", congregationId, "territoryCards", cardToDelete.id);
        await deleteDoc(cardDocRef);
        showMessage({ message: "Sucesso", description: `Cartão "${cardToDelete.cardNumber}" excluído.`, type: "success"});
    } catch (error: any) { /* ... */ }
    finally { setIsDeletingCard(false); setIsConfirmDeleteCardVisible(false); setCardToDelete(null); }
};

// --- Edição de Cartão (Número/Código) ---
const handlePresentRenameCardModal = (card: TerritoryCardData) => {
    if (!canManageTerritories || !card.id) return;
    setCardToRename(card);
    setIsRenameCardModalVisible(true);
};
const handleDismissRenameCardModal = () => {
    setIsRenameCardModalVisible(false);
    setCardToRename(null);
};
const handleSaveCardRename = async (newCardNumber: string) => {
    if (!cardToRename || !cardToRename.id || !congregationId || !canManageTerritories) { /* ... */ return; }
    if (newCardNumber === cardToRename.cardNumber) { handleDismissRenameCardModal(); return; }
    setIsRenamingCard(true);
    try {
        const cardDocRef = doc(db, "congregations", congregationId, "territoryCards", cardToRename.id);
        await updateDoc(cardDocRef, { cardNumber: newCardNumber });
        showMessage({ message: "Sucesso", description: "Número do cartão atualizado.", type: "success" });
        handleDismissRenameCardModal();
    } catch (error: any) { /* ... */ }
    finally { setIsRenamingCard(false); }
};

// --- Edição de Seção (Renomear) ---
const handlePresentRenameSectionModal = () => {
    if (!canManageTerritories) return;
    setIsRenameSectionModalVisible(true);
};
const handleDismissRenameSectionModal = () => {
    setIsRenameSectionModalVisible(false);
};
const handleSaveSectionRename = async (newSectionName: string) => {
     if (!congregationId || !canManageTerritories) { /* ... */ return; }
     if (newSectionName === currentSectionName) { handleDismissRenameSectionModal(); return; }

     setIsRenamingSection(true);
     const oldSectionName = currentSectionName; // Usa o nome atual do estado
     const cityName = city;
     const congDocRef = doc(db, "congregations", congregationId);

     try {
         await runTransaction(db, async (transaction) => {
             const congDocSnap = await transaction.get(congDocRef);
             if (!congDocSnap.exists()) throw new Error("Congregação não encontrada.");
             const congData = congDocSnap.data() as CongregationData;
             const sectionsMap = congData.sectionsByCity || {};
             const sectionsInCity = sectionsMap[cityName] || [];

             if (!sectionsInCity.includes(oldSectionName)) throw new Error(`Seção "${oldSectionName}" não encontrada.`);
             if (sectionsInCity.includes(newSectionName)) throw new Error(`Seção "${newSectionName}" já existe.`);

             const updatedSectionsInCity = sectionsInCity.map(s => s === oldSectionName ? newSectionName : s).sort();
             const updatedSectionsMap = { ...sectionsMap, [cityName]: updatedSectionsInCity };
             transaction.update(congDocRef, { sectionsByCity: updatedSectionsMap });

             const cardsRef = collection(db, "congregations", congregationId, "territoryCards");
             const q = query(cardsRef, where("city", "==", cityName), where("section", "==", oldSectionName));
             const cardsSnapshot = await getDocs(q); // Fora da transação

             cardsSnapshot.forEach(cardDoc => { transaction.update(cardDoc.ref, { section: newSectionName }); });
             console.log(`Renomeando seção em ${cardsSnapshot.size} cartões.`);
         });

         showMessage({ message: "Sucesso", description: `Seção renomeada para "${newSectionName}".`, type: "success" });
         setCurrentSectionName(newSectionName); // <<< Atualiza o nome da seção no estado local
         handleDismissRenameSectionModal(); // Fecha modal de renomear
         onSectionRenamed?.(cityName, oldSectionName, newSectionName); // Chama callback opcional do pai

     } catch (error: any) {
         console.error("Erro ao renomear seção:", error);
         showMessage({ message: "Erro ao Renomear", description: error.message || "Não foi possível renomear a seção.", type: "danger" });
     } finally {
         setIsRenamingSection(false);
     }
 };

 // --- Exclusão de Seção (Chama callback do pai) ---
 const handleDeleteSection = () => {
     if (!canManageTerritories) return;
     // Chama a função passada pelo pai, que abrirá o modal de confirmação lá
     onDeleteSection(city, currentSectionName);
     // Fecha este modal de detalhes, pois a seção será excluída
     onClose();
 };

   // --- Visualização de Imagem ---
   const handleViewImage = (imageUrl: string | null | undefined) => {
       if (imageUrl) {
           setViewingImageUrl(imageUrl);
           setIsImageViewerVisible(true);
       } else {
            showMessage({ message: "Imagem não disponível", type: "info" });
       }
   };
   const handleCloseImageViewer = () => {
       setIsImageViewerVisible(false);
       setViewingImageUrl(null);
   };


   const handleViewMap = (id: string | null | undefined) => {
    if (id) {
        setViewingMapId(id); // Set the mapId to view
        setIsMapViewerVisible(true); // Open the bottom sheet
    } else {
        showMessage({ message: "Mapa não disponível", type: "info" });
    }
};
const handleCloseMapView = () => {
    setIsMapViewerVisible(false); // Close the bottom sheet
    setViewingMapId(null);      // Clear the mapId
};

// --- Render Card Item (Unchanged from previous version) ---
const renderCardItem = ({ item }: { item: TerritoryCardData }) => (
    <View style={[styles.cardItem, { backgroundColor: colors.backgroundPrimary, borderColor: colors.border }]}>
        {/* Image / Map Icon / Placeholder */}
        <TouchableOpacity
            onPress={() => {
                if (item.id) { handleViewMap(item.id); }
                else if (item.imageUrl) { handleViewImage(item.imageUrl); }
            }}
            disabled={!item.imageUrl && !item.mapId}
        >
            {item.mapId ? (
                <View style={[styles.cardImagePlaceholder, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="map-outline" size={28} color={colors.primary} />
                </View>
            ) : item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
            ) : (
                <View style={[styles.cardImagePlaceholder, { backgroundColor: colors.border }]}>
                    <Ionicons name="image-outline" size={24} color={colors.textMuted} />
                </View>
            )}
        </TouchableOpacity>
        {/* Info */}
        <View style={styles.cardInfo}>
            <Text style={[styles.cardNumber, { color: colors.textPrimary }]}>{item.cardNumber}</Text>
            {item.notes && <Text style={[styles.cardNotes, { color: colors.textSecondary }]} numberOfLines={1}>{item.notes}</Text>}
            <Text style={[styles.cardStatus, { color: item.status === 'Disponível' ? colors.success : (item.status === 'Em campo' ? colors.warning : colors.error) }]}> {item.status} </Text>
        </View>
        {/* Actions */}
        {canManageTerritories && (
            <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionButton} onPress={() => handlePresentRenameCardModal(item)} disabled={isRenamingCard || isDeletingCard}>
                    <Ionicons name="pencil-outline" size={20} color={(isRenamingCard || isDeletingCard) ? colors.textMuted : colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => confirmDeleteCard(item)} disabled={isRenamingCard || isDeletingCard}>
                    <Ionicons name="trash-outline" size={20} color={(isRenamingCard || isDeletingCard) ? colors.textMuted : colors.error} />
                </TouchableOpacity>
            </View>
        )}
    </View>
);

  // --- Renderização do Modal ---
  const styles = createStyles(colors);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalKeyboardAvoidingView} >
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={[styles.modalContentContainer, { backgroundColor: colors.backgroundSecondary }]}>
          {/* ... Header, Título, Subtítulo, Botões de Ação da Seção ... */}
           <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} /></View>
           <Text style={[styles.modalTitle, { color: colors.textPrimary }]}> Seção: {currentSectionName} </Text>
           <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}> Cidade: {city} </Text>
           {canManageTerritories && (
            <View style={styles.sectionActionsContainer}>
                <TouchableOpacity
                      style={styles.sectionActionButton}
                      onPress={handlePresentRenameSectionModal} // <<< Abre modal de renomear seção
                      disabled={isRenamingCard || isDeletingCard || isRenamingSection}
                  >
                    <Ionicons name="pencil" size={16} color={(isRenamingCard || isDeletingCard || isRenamingSection) ? colors.textMuted : colors.primary} />
                    <Text style={[styles.sectionActionText, { color: (isRenamingCard || isDeletingCard || isRenamingSection) ? colors.textMuted : colors.primary }]}> Renomear Seção</Text>
                </TouchableOpacity>
                <TouchableOpacity
                      style={styles.sectionActionButton}
                      onPress={handleDeleteSection} // <<< Chama função local que chama callback do pai
                      disabled={isRenamingCard || isDeletingCard || isRenamingSection}
                  >
                    <Ionicons name="trash" size={16} color={(isRenamingCard || isDeletingCard || isRenamingSection) ? colors.textMuted : colors.error} />
                    <Text style={[styles.sectionActionText, { color: (isRenamingCard || isDeletingCard || isRenamingSection) ? colors.textMuted : colors.error }]}> Excluir Seção</Text>
                </TouchableOpacity>
            </View>
        )}

          {/* Lista de Cartões */}
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loading} />
          ) : (
            <FlatList
              data={cards}
              renderItem={renderCardItem}
              keyExtractor={(item) => item.id!}
              style={styles.cardList}
              contentContainerStyle={styles.cardListContent}
              ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum cartão nesta seção.</Text>}
            />
          )}

          {/* --- Modais Internos --- */}

          {/* Modal de Confirmação para Excluir Cartão */}
          <ConfirmationModal isVisible={isConfirmDeleteCardVisible} onClose={() => setIsConfirmDeleteCardVisible(false)} onConfirm={deleteCard} title="Excluir Cartão" message={`Excluir o cartão "${cardToDelete?.cardNumber}"?`} confirmText="Excluir" confirmButtonStyle="destructive" isConfirming={isDeletingCard} />

          {/* Modal para Renomear Cartão */}
          {cardToRename && ( <RenameModal isVisible={isRenameCardModalVisible} onClose={handleDismissRenameCardModal} onSave={handleSaveCardRename} title="Renomear Cartão" label="Novo número/código para" itemNameToRename={cardToRename.cardNumber} initialValue={cardToRename.cardNumber} placeholder="Número/Código do Cartão" isSaving={isRenamingCard} /> )}

          {/* Modal para Renomear Seção */}
          <RenameModal isVisible={isRenameSectionModalVisible} onClose={handleDismissRenameSectionModal} onSave={handleSaveSectionRename} title="Renomear Seção" label={`Novo nome para seção em "${city}"`} itemNameToRename={currentSectionName} initialValue={currentSectionName} placeholder="Nome da Seção" isSaving={isRenamingSection} />

          {/* Modal Visualizador de Imagem <<< NOVO */}
          <Modal
              animationType="fade" // Ou 'slide'
              transparent={true}
              visible={isImageViewerVisible}
              onRequestClose={handleCloseImageViewer}
          >
              <View style={styles.imageViewerContainer}>
                  {/* Botão Fechar */}
                  <TouchableOpacity style={styles.closeButton} onPress={handleCloseImageViewer}>
                      <Ionicons name="close-circle" size={35} color={colors.white} />
                  </TouchableOpacity>
                  {/* Imagem Ampliada (usando Image padrão por enquanto) */}
                  {viewingImageUrl && (
                      <Image
                          source={{ uri: viewingImageUrl }}
                          style={styles.fullScreenImage}
                          resizeMode="contain" // Garante que a imagem caiba na tela
                      />
                  )}
              </View>
          </Modal>

          {/* --- Map Viewer Bottom Sheet Component --- */}
          <MapViewerBottomSheet
              isVisible={isMapViewerVisible}
              onClose={handleCloseMapView}
              congregationId={congregationId}
              id={viewingMapId}
          />

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// --- Estilos ---
const screenHeight = Dimensions.get('window').height;
const screenWidth = Dimensions.get('window').width; // Para o visualizador de imagem
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  modalKeyboardAvoidingView: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContentContainer: { width: '100%', maxHeight: screenHeight * 0.8, borderTopRightRadius: 20, borderTopLeftRadius: 20, paddingBottom: 20, },
  modalHeader: { width: '100%', alignItems: 'center', paddingTop: 10, marginBottom: 5 },
  modalHandle: { width: 40, height: 5, borderRadius: 4 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 2, textAlign: 'center', paddingHorizontal: 24 },
  modalSubtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 15, paddingHorizontal: 24 },
  sectionActionsContainer: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 20, marginBottom: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: 15, },
  sectionActionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 15, marginHorizontal: 10, },
  sectionActionText: { fontSize: 14, fontWeight: '500', marginLeft: 5, },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
  cardList: {  width: '100%', paddingHorizontal: 20, }, // Garante que a lista tenha padding
  cardListContent: { paddingBottom: 20, },
  emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16 },
  cardItem: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 10, borderRadius: 8, borderWidth: 1, },
  cardImage: { width: 50, height: 50, borderRadius: 4, marginRight: 10, },
  cardImagePlaceholder: { width: 50, height: 50, borderRadius: 4, marginRight: 10, justifyContent: 'center', alignItems: 'center', },
  cardInfo: { flex: 1, marginRight: 5, },
  cardNumber: { fontSize: 15, fontWeight: 'bold', marginBottom: 2, },
  cardNotes: { fontSize: 13, marginBottom: 3, },
  cardStatus: { fontSize: 12, fontWeight: '500', },
  cardActions: { flexDirection: 'row', },
  actionButton: { padding: 8, marginLeft: 5, },

  // --- Estilos Visualizador de Imagem ---
  imageViewerContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.85)', // Fundo escuro semi-transparente
      justifyContent: 'center',
      alignItems: 'center',
  },
  closeButton: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 50 : 20, // Ajuste para barra de status
      right: 20,
      zIndex: 1, // Garante que fique sobre a imagem
  },
  fullScreenImage: {
      width: screenWidth * 0.95, // Quase largura total
      height: screenHeight * 0.8, // Quase altura total
  },
});

export default SectionDetailModal;
