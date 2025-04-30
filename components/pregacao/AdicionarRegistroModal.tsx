// components/pregacao/AdicionarRegistroModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal,
  TextInput, TouchableWithoutFeedback, KeyboardAvoidingView, Platform,
  Dimensions, ScrollView, FlatList, Alert, Image // <<< Importa Image
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { showMessage } from 'react-native-flash-message';
import { collection, query, where, onSnapshot, Unsubscribe, doc, writeBatch, serverTimestamp, Timestamp, getDoc, orderBy } from 'firebase/firestore'; // <<< Importa Timestamp
import { db, storage } from '@/lib/firebase'; // <<< Importa storage
import { TerritoryCardData, PersonData, TerritoryRecordData } from '@/types';
import { Ionicons } from '@expo/vector-icons';

interface AdicionarRegistroModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSaveSuccess: () => void; // Callback para sucesso
  congregationId: string;
}

// Tipos locais para seleção
type CardListItem = Pick<TerritoryCardData, 'id' | 'city' | 'section' | 'cardNumber'>;
type PersonListItem = Pick<PersonData, 'id' | 'name' | 'linkedUserId'>;

const AdicionarRegistroModal: React.FC<AdicionarRegistroModalProps> = ({
  isVisible,
  onClose,
  onSaveSuccess,
  congregationId,
}) => {
  const { colors } = useTheme();
  const { user, userData } = useAuth(); // Pega usuário logado

  // --- Estados do Formulário ---
  const [selectedCard, setSelectedCard] = useState<CardListItem | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<PersonListItem | null>(null);
  // Estados para data manual
  const [startDay, setStartDay] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endDay, setEndDay] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [endYear, setEndYear] = useState('');

  // Estados para Seletores e Busca
  const [availableCards, setAvailableCards] = useState<CardListItem[]>([]);
  const [people, setPeople] = useState<PersonListItem[]>([]);
  const [cardSearchTerm, setCardSearchTerm] = useState('');
  const [personSearchTerm, setPersonSearchTerm] = useState('');
  const [isCardListVisible, setIsCardListVisible] = useState(false);
  const [isPersonListVisible, setIsPersonListVisible] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  // Estados de Ação
  const [isSaving, setIsSaving] = useState(false);
  // Busca Cartões Disponíveis e Pessoas quando o modal abre
  useEffect(() => {
    let unsubCards: Unsubscribe | null = null;
    let unsubPeople: Unsubscribe | null = null;

    if (isVisible && congregationId) {
      setDataLoading(true);
      console.log("AdicionarRegistroModal: Buscando dados...");

      // Busca Cartões Disponíveis
      const cardsRef = collection(db, "congregations", congregationId, "territoryCards");
      const qCards = query(cardsRef, where("status", "==", "Disponível"));
      unsubCards = onSnapshot(qCards, (snapshot) => {
        const cardsData: CardListItem[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          cardsData.push({
            id: doc.id,
            city: data.city,
            section: data.section,
            cardNumber: data.cardNumber,
          });
        });
        setAvailableCards(cardsData.sort((a,b) => a.cardNumber.localeCompare(b.cardNumber, undefined, {numeric: true})));
        console.log("AdicionarRegistroModal: Cartões disponíveis carregados:", cardsData.length);
        // Verifica se o outro listener já terminou antes de parar o loading
        if (!unsubPeople || people.length > 0) setDataLoading(false);
      }, (error) => {
        console.error("Erro ao buscar cartões disponíveis:", error);
        showMessage({ message: "Erro", description: "Não foi possível carregar cartões.", type: "danger"});
        setDataLoading(false);
      });

      // Busca Pessoas
      const peopleRef = collection(db, "congregations", congregationId, "people");
      const qPeople = query(
        peopleRef,
        where("categories", "array-contains", "Dirigente"), // <<< Use array-contains
        orderBy("name") // <<< Ordena pelo nome
      );      unsubPeople = onSnapshot(qPeople, (snapshot) => {
        const peopleData: PersonListItem[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          peopleData.push({ id: doc.id, name: data.name, linkedUserId: data.linkedUserId });
        });
        setPeople(peopleData);
        console.log("AdicionarRegistroModal: Pessoas carregadas:", peopleData.length);
        // Verifica se o outro listener já terminou antes de parar o loading
        setDataLoading(false);
      }, (error) => {
        console.error("Erro ao buscar pessoas:", error);
        showMessage({ message: "Erro", description: "Não foi possível carregar pessoas.", type: "danger"});
        setDataLoading(false);
      });

    } else {
      // Limpa dados e para loading se modal fecha ou falta ID
      setAvailableCards([]);
      setPeople([]);
      setDataLoading(false);
    }

    // Limpa listeners ao desmontar ou quando props mudam
    return () => {
      if (unsubCards) unsubCards();
      if (unsubPeople) unsubPeople();
    };
  }, [isVisible, congregationId]); // Dependências corretas

  // Limpa formulário ao fechar
  useEffect(() => {
    if (!isVisible) {
      setSelectedCard(null); setSelectedPerson(null);
      setStartDay(''); setStartMonth(''); setStartYear('');
      setEndDay(''); setEndMonth(''); setEndYear('');
      setCardSearchTerm(''); setPersonSearchTerm('');
      setIsCardListVisible(false); setIsPersonListVisible(false);
      setIsSaving(false);
    }
  }, [isVisible]);

  // --- Lógica de Filtro/Busca ---
  const filteredCards = useMemo(() => {
    if (!cardSearchTerm) return availableCards;
    const lowerCaseTerm = cardSearchTerm.toLowerCase();
    return availableCards.filter(card =>
      card.city?.toLowerCase().includes(lowerCaseTerm) ||
      card.section?.toLowerCase().includes(lowerCaseTerm) ||
      card.cardNumber?.toLowerCase().includes(lowerCaseTerm)
    );
  }, [cardSearchTerm, availableCards]);

  const filteredPeople = useMemo(() => {
    if (!personSearchTerm) return people;
    const lowerCaseTerm = personSearchTerm.toLowerCase();
    return people.filter(person =>
      person.name?.toLowerCase().includes(lowerCaseTerm)
    );
  }, [personSearchTerm, people]);

  // --- Funções de Seleção ---
  const selectCard = (card: CardListItem) => {
    setSelectedCard(card);
    setCardSearchTerm(''); // Limpa busca
    setIsCardListVisible(false); // Fecha lista
  };

  const selectPerson = (person: PersonListItem) => {
    setSelectedPerson(person);
    setPersonSearchTerm('');
    setIsPersonListVisible(false);
  };

  // --- Função para validar e criar objeto Date ---
  const createDateFromInputs = (dayStr: string, monthStr: string, yearStr: string): Date | null => {
      const day = parseInt(dayStr, 10);
      const month = parseInt(monthStr, 10); // Mês é 1-12
      const year = parseInt(yearStr, 10);

      if (isNaN(day) || isNaN(month) || isNaN(year) ||
          day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
          return null; // Validação básica de intervalo
      }

      // Cria o objeto Date (mês no construtor Date é 0-11)
      const date = new Date(year, month - 1, day);

      // Validação extra: verifica se o objeto Date criado corresponde aos inputs
      // Isso pega dias inválidos para o mês (ex: 31 de Fev)
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
          return null;
      }
      return date;
  };


  // --- Lógica para Salvar Registro ---
  const handleSaveRecord = async () => {
    if (!selectedCard || !selectedPerson) {
      showMessage({ message: "Campos Obrigatórios", description: "Selecione o Cartão e a Pessoa.", type: "warning" });
      return;
    }
    if (!user) { showMessage({ message: "Erro", description: "Usuário não autenticado.", type: "danger"}); return; }

    // Valida e cria Data de Início
    const startDateObj = createDateFromInputs(startDay, startMonth, startYear);
    if (!startDateObj) {
        showMessage({ message: "Data Inválida", description: "Verifique a Data de Início (DD/MM/AAAA).", type: "warning" });
        return;
    }

    // Valida e cria Data Final (se preenchida)
    let endDateObj: Date | null = null;
    const hasEndDateInput = endDay.trim() || endMonth.trim() || endYear.trim();
    if (hasEndDateInput) {
        endDateObj = createDateFromInputs(endDay, endMonth, endYear);
        if (!endDateObj) {
            showMessage({ message: "Data Inválida", description: "Verifique a Data de Fim (DD/MM/AAAA).", type: "warning" });
            return;
        }
        // Valida se data final é posterior ou igual à inicial
        if (endDateObj < startDateObj) {
             showMessage({ message: "Data Inválida", description: "A Data de Fim deve ser igual ou posterior à Data de Início.", type: "warning" });
             return;
        }
    }

    setIsSaving(true);
    const recordStatus = endDateObj ? 'Completo' : 'Ativo';

    try {
      const batch = writeBatch(db);
      const recordsRef = collection(db, "congregations", congregationId, "territoryRecords");
      const newRecordRef = doc(recordsRef); // Gera ID
      const newRecordData: Omit<TerritoryRecordData, 'id'> = {
        cardId: selectedCard.id!,
        cardNumber: selectedCard.cardNumber,
        personId: selectedPerson.linkedUserId!, // ID do documento da pessoa
        personName: selectedPerson.name!,
        startDate: Timestamp.fromDate(startDateObj), // Converte para Timestamp
        endDate: endDateObj ? Timestamp.fromDate(endDateObj) : null, // Converte se existir
        status: recordStatus,
      };
      batch.set(newRecordRef, newRecordData);
      console.log("Batch: Adicionando novo registro de território.");

      // Atualiza status do cartão para 'Em campo'
      const cardDocRef = doc(db, "congregations", congregationId, "territoryCards", selectedCard.id!);
      batch.update(cardDocRef, {
          status: 'Em campo',
          lastWorkedBy: selectedPerson.id,
          lastWorkedByName: selectedPerson.name,
          // lastReturnDate não é atualizado aqui
      });
      console.log("Batch: Atualizando status do cartão para 'Em campo'.");

      // Commita o Batch
      await batch.commit();
      console.log("Batch de registro de território commitado.");

      showMessage({ message: "Sucesso", description: `Território ${selectedCard.cardNumber} registrado para ${selectedPerson.name}.`, type: "success" });
      onSaveSuccess(); // Chama callback do pai
      onClose(); // Fecha o modal

    } catch (error: any) {
      console.error("Erro ao salvar registro:", error);
      showMessage({ message: "Erro ao Salvar", description: error.message || "Não foi possível salvar o registro.", type: "danger" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Renderização ---
  const styles = createStyles(colors);

  return (
    <Modal animationType="slide" transparent={true} visible={isVisible} onRequestClose={onClose} >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalKeyboardAvoidingView} >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.modalOverlay} />
            </TouchableWithoutFeedback>

            {/* // ****************************************************** */}
            {/* // FIX: Apply padding here, removed ScrollView wrapper */}
            {/* // ****************************************************** */}
            <View style={[styles.modalContentContainer, { backgroundColor: colors.backgroundSecondary }]}>
                <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} /></View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}> Registrar Trabalho </Text>

                {dataLoading ? ( <ActivityIndicator size="large" color={colors.primary} style={styles.loadingIndicator} /> )
                : (
                    // ******************************************************
                    // FIX: No ScrollView here. Content flows vertically.
                    // FlatLists below will handle their own scrolling.
                    // KeyboardAvoidingView + Modal maxHeight handle overflow.
                    // ******************************************************
                    <View style={styles.formContent}>

                        {/* Seletor de Cartão */}
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Cartão de Território*</Text>
                        <TouchableOpacity
                            style={[styles.selectorButton, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}
                            onPress={() => { setIsCardListVisible(!isCardListVisible); setIsPersonListVisible(false); }}
                        >
                            <Text style={[styles.selectorText, { color: selectedCard ? colors.textPrimary : colors.placeholder }]} numberOfLines={1} ellipsizeMode="tail">
                                {selectedCard ? `${selectedCard.cardNumber} (${selectedCard.city} / ${selectedCard.section})` : 'Selecione um cartão disponível...'}
                            </Text>
                            <Ionicons name={isCardListVisible ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
                        </TouchableOpacity>

                        {/* Lista/Busca de Cartões */}
                        {isCardListVisible && (
                            <View style={[styles.listContainer, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}>
                                <TextInput
                                    style={[styles.searchInput, { borderColor: colors.border, color: colors.textPrimary }]}
                                    placeholder="Buscar por nº, cidade ou seção..."
                                    placeholderTextColor={colors.placeholder}
                                    value={cardSearchTerm}
                                    onChangeText={setCardSearchTerm}
                                />
                                <FlatList // This FlatList is fine now, not inside a ScrollView
                                    data={filteredCards}
                                    keyExtractor={(item) => item.id!}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity style={styles.listItem} onPress={() => selectCard(item)}>
                                            <Text style={{ color: colors.textPrimary, fontWeight: '500' }}>{item.cardNumber}</Text>
                                            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.city} / {item.section}</Text>
                                        </TouchableOpacity>
                                    )}
                                    ListEmptyComponent={<Text style={styles.emptyListText}>Nenhum cartão disponível encontrado.</Text>}
                                    style={styles.flatListMaxHeight} // Keeps the list from taking too much space
                                    keyboardShouldPersistTaps="handled" // Changed from always to handled
                                    nestedScrollEnabled={true} // Explicitly enable nested scroll for FlatList
                                />
                            </View>
                        )}

                        {/* Seletor de Pessoa */}
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Designado Para*</Text>
                           <TouchableOpacity
                            style={[styles.selectorButton, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}
                            onPress={() => { setIsPersonListVisible(!isPersonListVisible); setIsCardListVisible(false); }}
                        >
                            <Text style={[styles.selectorText, { color: selectedPerson ? colors.textPrimary : colors.placeholder }]} numberOfLines={1} ellipsizeMode="tail">
                                {selectedPerson ? selectedPerson.name : 'Selecione uma pessoa...'}
                            </Text>
                            <Ionicons name={isPersonListVisible ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
                        </TouchableOpacity>

                        {/* Lista/Busca de Pessoas */}
                        {isPersonListVisible && (
                             <View style={[styles.listContainer, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}>
                                <TextInput
                                    style={[styles.searchInput, { borderColor: colors.border, color: colors.textPrimary }]}
                                    placeholder="Buscar pessoa..."
                                    placeholderTextColor={colors.placeholder}
                                    value={personSearchTerm}
                                    onChangeText={setPersonSearchTerm}
                                />
                                <FlatList // This FlatList is fine now, not inside a ScrollView
                                    data={filteredPeople}
                                    keyExtractor={(item) => item.id!}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity style={styles.listItem} onPress={() => selectPerson(item)}>
                                            <Text style={{ color: colors.textPrimary }}>{item.name}</Text>
                                        </TouchableOpacity>
                                    )}
                                     ListEmptyComponent={<Text style={styles.emptyListText}>Nenhuma pessoa encontrada.</Text>}
                                     style={styles.flatListMaxHeight} // Keeps the list from taking too much space
                                     keyboardShouldPersistTaps="handled" // Changed from always to handled
                                     nestedScrollEnabled={true} // Explicitly enable nested scroll for FlatList
                                />
                            </View>
                        )}

                        {/* Inputs de Data Manual */}
                        {/* Data Início */}
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Data de Início*</Text>
                        <View style={styles.dateInputRow}>
                             <TextInput
                                 style={[styles.dateInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                                 placeholder="DD" placeholderTextColor={colors.placeholder} value={startDay}
                                 onChangeText={(text) => setStartDay(text.replace(/[^0-9]/g, ''))}
                                 keyboardType="number-pad" maxLength={2} returnKeyType="next"
                             />
                             <Text style={styles.dateSeparator}>/</Text>
                             <TextInput
                                 style={[styles.dateInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                                 placeholder="MM" placeholderTextColor={colors.placeholder} value={startMonth}
                                 onChangeText={(text) => setStartMonth(text.replace(/[^0-9]/g, ''))}
                                 keyboardType="number-pad" maxLength={2} returnKeyType="next"
                             />
                              <Text style={styles.dateSeparator}>/</Text>
                             <TextInput
                                 style={[styles.dateInput, styles.yearInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                                 placeholder="AAAA" placeholderTextColor={colors.placeholder} value={startYear}
                                 onChangeText={(text) => setStartYear(text.replace(/[^0-9]/g, ''))}
                                 keyboardType="number-pad" maxLength={4} returnKeyType="next" // Can change to 'done' if it's the last input before optional ones
                             />
                        </View>

                         {/* Data Fim */}
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Data de Fim (Opcional)</Text>
                        <View style={styles.dateInputRow}>
                             <TextInput style={[styles.dateInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="DD" placeholderTextColor={colors.placeholder} value={endDay} onChangeText={(t)=>setEndDay(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={2} returnKeyType="next"/>
                             <Text style={styles.dateSeparator}>/</Text>
                             <TextInput style={[styles.dateInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="MM" placeholderTextColor={colors.placeholder} value={endMonth} onChangeText={(t)=>setEndMonth(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={2} returnKeyType="next"/>
                             <Text style={styles.dateSeparator}>/</Text>
                             <TextInput style={[styles.dateInput, styles.yearInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="AAAA" placeholderTextColor={colors.placeholder} value={endYear} onChangeText={(t)=>setEndYear(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={4} returnKeyType="done"/>
                        </View>

                        {/* Botão Salvar */}
                        <TouchableOpacity
                            style={[styles.modalButton, { backgroundColor: isSaving ? colors.primaryLight : colors.primary, opacity: isSaving ? 0.7 : 1 }]}
                            onPress={handleSaveRecord}
                            disabled={isSaving || dataLoading} // Disable if saving or still loading initial data
                        >
                            {isSaving ? ( <ActivityIndicator size="small" color={colors.textOnPrimary} /> )
                            : ( <Text style={[styles.modalButtonText, { color: colors.textOnPrimary }]}> Salvar Registro </Text> )}
                        </TouchableOpacity>
                    </View> // End formContent View
                )}
            </View>
        </KeyboardAvoidingView>
    </Modal>
);
};

// --- Estilos ---
const screenHeight = Dimensions.get('window').height;
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
modalKeyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end', // Keep modal at the bottom
},
modalOverlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
},
modalContentContainer: { // This View now holds the form content directly
    width: '100%',
    maxHeight: screenHeight * 0.85, // Max height constraint
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    // Removed paddingHorizontal, will be added in formContent
},
modalHeader: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 10,
    marginBottom: 5,
    // backgroundColor: colors.backgroundSecondary, // Already set on parent
    borderTopRightRadius: 20, // Keep for visual separation if needed
    borderTopLeftRadius: 20,
},
modalHandle: {
    width: 40, height: 5, borderRadius: 4,
    // backgroundColor defined inline
},
modalTitle: {
    fontSize: 20, fontWeight: 'bold',
    marginBottom: 15, // Reduced margin slightly
    textAlign: 'center',
    paddingHorizontal: 24, // Keep horizontal padding for title
    // backgroundColor: colors.backgroundSecondary, // Already set on parent
    paddingTop: 10
},
// FIX: Removed formScrollView style definition

formContent: { // Style applied to the View wrapping form elements
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 30 : 40, // Add more padding for Android bottom spacing/nav bar
    flexGrow: 1, // Allows content to take space but FlatLists handle internal scroll
},
inputLabel: {
    fontSize: 14,
    // color: colors.textSecondary, // Defined inline
    marginBottom: 6,
    alignSelf: 'flex-start',
    width: '100%',
    marginTop: 10,
},
selectorButton: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    height: 50,
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 15,
    width: '100%',
    marginBottom: 5, // Keep margin below selector
},
selectorText: {
    fontSize: 16,
    flex: 1, // Allow text to take available space
    marginRight: 10,
    // color defined inline
},
listContainer: { // Container for search input and flatlist
    width: '100%',
    // maxHeight: 180, // Max height for the whole container (input + list)
    borderWidth: 1, borderRadius: 6,
    marginBottom: 15, // Space below the list block
    overflow: 'hidden', // Clip children to rounded border
    // borderColor, backgroundColor defined inline
},
searchInput: {
    height: 40,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    // borderColor and color definidos inline
    borderBottomColor: colors.border, // Explicitly set border color
},
listItem: {
    paddingVertical: 12, paddingHorizontal: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border, // Use theme color
},
emptyListText: {
    textAlign: 'center', padding: 15, fontSize: 14,
    color: colors.textMuted,
},
flatListMaxHeight: { // Max height specifically for the list area
    maxHeight: 130, // Adjust as needed (180 total - 40 input - 10 padding approx)
},
dateInputRow: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%',
    marginBottom: 15,
},
dateInput: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 12,
    fontSize: 16, textAlign: 'center',
    flex: 1, height: 50,
    // borderColor, color, backgroundColor definidos inline
},
yearInput: {
    flex: 1.5, // Give year input slightly more space
},
dateSeparator: {
    fontSize: 18, marginHorizontal: 5,
    color: colors.textSecondary,
},
modalButton: {
    height: 50, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    width: '100%',
    marginTop: 20, // Space above button
    // backgroundColor definido inline
},
modalButtonText: {
    fontSize: 16, fontWeight: 'bold',
    // color definido inline
},
loadingIndicator: {
    // Changed: Make it take space and center within the content area
    // flex: 1, // Remove flex: 1 if formContent has padding
    justifyContent: 'center', alignItems: 'center',
    paddingVertical: 50, // Ensure space around indicator
    minHeight: 200, // Give it some minimum height
},
});

export default AdicionarRegistroModal;
