// components/pregacao/AdicionarTerritorioModal.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ScrollView,
  Alert,
  Image,
  FlatList, // <<< Importa FlatList para sugestões
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { showMessage } from 'react-native-flash-message';
import {
    collection, addDoc, doc, getDoc, updateDoc,
    serverTimestamp, writeBatch, arrayUnion
} from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { TerritoryCardData, CongregationData } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface AdicionarTerritorioModalProps {
  isVisible: boolean;
  onClose: () => void;
  congregationId: any;
}

const AdicionarTerritorioModal: React.FC<AdicionarTerritorioModalProps> = ({
  isVisible,
  onClose,
  congregationId,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();

  // --- Estados do Formulário ---
  const [city, setCity] = useState('');
  const [section, setSection] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // --- Estados para Dados Existentes e Autocomplete ---
  const [existingCities, setExistingCities] = useState<string[]>([]);
  const [existingSectionsByCity, setExistingSectionsByCity] = useState<{ [city: string]: string[] }>({});
  const [dataLoading, setDataLoading] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [sectionSuggestions, setSectionSuggestions] = useState<string[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [showSectionSuggestions, setShowSectionSuggestions] = useState(false);

  // Busca cidades e seções existentes
  useEffect(() => {
    // ... (lógica de busca inalterada) ...
    if (isVisible && congregationId) {
      setDataLoading(true);
      const fetchExistingData = async () => {
        try {
          const congDocRef = doc(db, "congregations", congregationId);
          const docSnap = await getDoc(congDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as CongregationData;
            const cities = data.cities || [];
            const sectionsMap = data.sectionsByCity || {};
            setExistingCities(cities.sort()); // Ordena cidades
            // Ordena seções dentro de cada cidade
            Object.keys(sectionsMap).forEach(c => sectionsMap[c]?.sort());
            setExistingSectionsByCity(sectionsMap);
          } else { setExistingCities([]); setExistingSectionsByCity({}); }
        } catch (error) { console.error("Erro ao buscar cidades/seções:", error); }
        finally { setDataLoading(false); }
      };
      fetchExistingData();
    } else { setExistingCities([]); setExistingSectionsByCity({}); }
  }, [isVisible, congregationId]);


  // Limpa o formulário ao fechar
  useEffect(() => {
    if (!isVisible) {
      setCity(''); setSection(''); setCardNumber(''); setNotes('');
      setImageUri(null); setIsSaving(false); setUploadProgress(null);
      setShowCitySuggestions(false); setShowSectionSuggestions(false); // Esconde sugestões
    }
  }, [isVisible]);

  // --- Lógica de Autocomplete ---
  const handleCityChange = (text: string) => {
    setCity(text);
    if (text.length > 0) {
      const filtered = existingCities.filter(c =>
        c.toLowerCase().includes(text.toLowerCase())
      );
      setCitySuggestions(filtered);
      setShowCitySuggestions(true);
    } else {
      setShowCitySuggestions(false);
      setCitySuggestions([]); // Limpa sugestões se input vazio
    }
    // Limpa seção e sugestões de seção ao mudar cidade
    setSection('');
    setShowSectionSuggestions(false);
    setSectionSuggestions([]);
  };

  const handleSectionChange = (text: string) => {
    setSection(text);
    const currentCitySections = existingSectionsByCity[city.trim()] || []; // Pega seções da cidade atual
    if (text.length > 0 && currentCitySections.length > 0) {
      const filtered = currentCitySections.filter(s =>
        s.toLowerCase().includes(text.toLowerCase())
      );
      setSectionSuggestions(filtered);
      setShowSectionSuggestions(true);
    } else {
      setShowSectionSuggestions(false);
      setSectionSuggestions([]);
    }
  };

  const selectCitySuggestion = (selectedCity: string) => {
    setCity(selectedCity);
    setShowCitySuggestions(false);
    setSection(''); // Limpa seção ao selecionar cidade
    setShowSectionSuggestions(false);
  };

  const selectSectionSuggestion = (selectedSection: string) => {
    setSection(selectedSection);
    setShowSectionSuggestions(false);
  };

  // --- Lógica de Upload de Imagem ---
  const handlePickImage = async () => {
    // Solicita permissão (necessário no iOS e web)
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permissão para acessar a galeria é necessária!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, // Permite cortar/editar
      // aspect: [4, 3], // Proporção opcional
      quality: 0.7, // Qualidade da imagem (0 a 1)
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri); // Armazena o URI local
      console.log("Imagem selecionada:", result.assets[0].uri);
    }
  };

  // Função para fazer upload da imagem para o Firebase Storage
  const uploadImageAsync = async (uri: string): Promise<string> => {
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () { resolve(xhr.response); };
    xhr.onerror = function (e) { console.error(e); reject(new TypeError("Network request failed")); };
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });

  const fileExtension = uri.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
  const storageRef = ref(storage, `territoryCards/${congregationId}/${fileName}`);

  console.log("Iniciando upload para:", storageRef.fullPath);
  setUploadProgress(0); // Inicia progresso

  const uploadTask = uploadBytesResumable(storageRef, blob);

  return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
          (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log('Upload is ' + progress + '% done');
              setUploadProgress(progress); // Atualiza estado do progresso
          },
          (error) => {
              console.error("Erro no upload:", error);
              setUploadProgress(null); // Limpa progresso no erro
              reject(error);
          },
          async () => {
              // Upload concluído com sucesso
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('File available at', downloadURL);
              setUploadProgress(null); // Limpa progresso
              // @ts-ignore // Ignora erro de tipo do blob.close() que não existe no RN
              blob.close(); // Libera o blob da memória
              resolve(downloadURL); // Retorna a URL de download
          }
      );
  });
  };


  // --- Lógica para Salvar ---
  const handleSaveChanges = async () => {
  const trimmedCity = city.trim();
  const trimmedSection = section.trim();
  const trimmedCardNumber = cardNumber.trim();

  if (!trimmedCity || !trimmedSection || !trimmedCardNumber) { /* ... validação ... */ return; }
  if (!user) { /* ... validação ... */ return; }

  setIsSaving(true);
  let finalImageUrl: string | null = null;
  const isNewCity = !existingCities.includes(trimmedCity);
  const isNewSection = !existingSectionsByCity[trimmedCity]?.includes(trimmedSection);

  try {
      // 1. Faz upload da imagem SE uma foi selecionada
      if (imageUri) {
          finalImageUrl = await uploadImageAsync(imageUri);
      }

      // --- Batch para salvar tudo atomicamente ---
      const batch = writeBatch(db);

      // 2. Referência e dados do novo cartão
      const cardsRef = collection(db, "congregations", congregationId, "territoryCards");
      const newCardRef = doc(cardsRef);
      const newCardData: Omit<TerritoryCardData, 'id'> = {
          city: trimmedCity, section: trimmedSection, cardNumber: trimmedCardNumber,
          notes: notes.trim(), imageUrl: finalImageUrl, status: 'Disponível',
          lastWorkedBy: null, lastWorkedByName: null, lastReturnDate: null,
          createdAt: serverTimestamp(), createdBy: user.uid,
      };
      batch.set(newCardRef, newCardData);

      // 3. Atualiza documento da congregação se for nova cidade ou seção
      const congDocRef = doc(db, "congregations", congregationId);
      let updates: { [key: string]: any } = {}; // Usar any para FieldValue

      if (isNewCity) {
          updates[`cities`] = arrayUnion(trimmedCity); // Adiciona nova cidade ao array
          // Cria a entrada para a nova cidade com a nova seção no mapa
          updates[`sectionsByCity.${trimmedCity}`] = [trimmedSection];
          console.log("Batch: Nova cidade detectada:", trimmedCity);
      } else if (isNewSection) {
          // Adiciona nova seção ao array existente da cidade
          updates[`sectionsByCity.${trimmedCity}`] = arrayUnion(trimmedSection);
          console.log("Batch: Nova seção detectada:", trimmedSection, "para cidade:", trimmedCity);
      }

      // Adiciona a atualização ao batch APENAS se houver updates
      if (Object.keys(updates).length > 0) {
          batch.update(congDocRef, updates);
          console.log("Batch: Atualizando documento da congregação com:", updates);
      }

      // 4. Commita o batch
      await batch.commit();
      console.log("Batch de adição de território commitado.");

      showMessage({ message: "Sucesso", description: "Cartão de território adicionado.", type: "success" });
      onClose();

  } catch (error: any) {
      console.error("Erro ao adicionar cartão:", error);
      showMessage({ message: "Erro ao Salvar", description: error.message || "Não foi possível adicionar o cartão.", type: "danger" });
  } finally {
      setIsSaving(false);
      setUploadProgress(null); // Garante que o progresso seja limpo
  }
  };
  // --- Renderização ---
  const styles = createStyles(colors);
  const isNewCity = city.trim() && !existingCities.includes(city.trim());
  const isNewSection = section.trim() && city.trim() && !existingSectionsByCity[city.trim()]?.includes(section.trim());

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalKeyboardAvoidingView}
      >
        {/* Overlay para fechar ao tocar fora (exceto nas listas de sugestão) */}
        <TouchableWithoutFeedback onPress={() => {
             setShowCitySuggestions(false);
             setShowSectionSuggestions(false);
             onClose(); // Fecha o modal principal
        }}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={[styles.modalContentContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.modalHeader}>
            <View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} />
          </View>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Adicionar Território
          </Text>

          {dataLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{flex: 1, paddingVertical: 50}} />
          ) : (
            <ScrollView style={styles.formScrollView} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">

                {/* --- Input Cidade com Autocomplete --- */}
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Cidade</Text>
                <TextInput
                    style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                    placeholder="Nome da Cidade"
                    placeholderTextColor={colors.placeholder}
                    value={city}
                    onChangeText={handleCityChange} // <<< Usa nova função
                    onFocus={() => { // Mostra sugestões ao focar se houver texto
                        if (city.length > 0) setShowCitySuggestions(true);
                        setShowSectionSuggestions(false); // Esconde outras sugestões
                    }}
                    onBlur={() => setTimeout(() => setShowCitySuggestions(false), 150)} // <<< Esconde com delay para permitir clique na sugestão
                />
                {/* Lista de Sugestões de Cidade */}
                {showCitySuggestions && citySuggestions.length > 0 && (
                    <FlatList
                        data={citySuggestions}
                        keyExtractor={(item) => item}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                                onPress={() => selectCitySuggestion(item)}
                            >
                                <Text style={{ color: colors.textPrimary }}>{item}</Text>
                            </TouchableOpacity>
                        )}
                        style={[styles.suggestionsList, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                        keyboardShouldPersistTaps="always" // Permite clicar mesmo com teclado aberto
                    />
                )}
                {/* Tag (Nova) */}
                {!dataLoading && isNewCity && !showCitySuggestions && (
                    <Text style={styles.newTag}> (Nova)</Text>
                )}


                {/* --- Input Seção com Autocomplete --- */}
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Seção</Text>
                <TextInput
                    style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                    placeholder="Nome/Número da Seção"
                    placeholderTextColor={colors.placeholder}
                    value={section}
                    onChangeText={handleSectionChange} // <<< Usa nova função
                    onFocus={() => { // Mostra sugestões ao focar se houver texto e cidade selecionada
                        if (section.length > 0 && city.trim()) setShowSectionSuggestions(true);
                        setShowCitySuggestions(false); // Esconde outras sugestões
                    }}
                    onBlur={() => setTimeout(() => setShowSectionSuggestions(false), 150)} // <<< Esconde com delay
                    editable={!!city.trim()} // Só edita se uma cidade foi selecionada/digitada
                />
                 {/* Lista de Sugestões de Seção */}
                 {showSectionSuggestions && sectionSuggestions.length > 0 && (
                    <FlatList
                        data={sectionSuggestions}
                        keyExtractor={(item) => item}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                                onPress={() => selectSectionSuggestion(item)}
                            >
                                <Text style={{ color: colors.textPrimary }}>{item}</Text>
                            </TouchableOpacity>
                        )}
                        style={[styles.suggestionsList, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                        keyboardShouldPersistTaps="always"
                    />
                )}
                {/* Tag (Nova) */}
                 {!dataLoading && isNewSection && !showSectionSuggestions && (
                    <Text style={styles.newTag}> (Nova)</Text>
                )}

                {/* --- Outros Inputs (Número, Notas, Imagem) --- */}
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Número/Código do Cartão</Text>
                <TextInput style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Ex: 101, A-15" placeholderTextColor={colors.placeholder} value={cardNumber} onChangeText={setCardNumber} />

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Notas (Opcional)</Text>
                <TextInput style={[styles.modalInput, styles.textArea, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Limites, observações..." placeholderTextColor={colors.placeholder} value={notes} onChangeText={setNotes} multiline />

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Imagem do Cartão (Opcional)</Text>
                <TouchableOpacity style={[styles.imagePickerButton, { borderColor: colors.border }]} onPress={handlePickImage} disabled={isSaving}>
                     {imageUri ? ( <Image source={{ uri: imageUri }} style={styles.imagePreview} /> )
                     : ( <Ionicons name="camera-outline" size={24} color={colors.textSecondary} style={{marginRight: 10}}/> )}
                     <Text style={{ color: colors.textSecondary }}>{imageUri ? 'Trocar Imagem' : 'Selecionar Imagem'}</Text>
                </TouchableOpacity>
                {uploadProgress !== null && (
                    <View style={styles.progressContainer}>
                        <Text style={{ color: colors.textSecondary, marginBottom: 5 }}>Enviando imagem...</Text>
                        <View style={[styles.progressBarBackground, { backgroundColor: colors.border }]}>
                            <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${uploadProgress}%` }]} />
                        </View>
                        <Text style={{ color: colors.textSecondary, marginTop: 5 }}>{Math.round(uploadProgress)}%</Text>
                    </View>
                )}


                {/* --- Botão Salvar --- */}
                <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: isSaving ? colors.primaryLight : colors.primary, opacity: isSaving ? 0.7 : 1 }]}
                    onPress={handleSaveChanges}
                    disabled={isSaving}
                >
                {isSaving ? ( <ActivityIndicator size="small" color={colors.textOnPrimary} /> )
                : ( <Text style={[styles.modalButtonText, { color: colors.textOnPrimary }]}> Salvar Cartão </Text> )}
                </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// --- Estilos ---
const screenHeight = Dimensions.get('window').height;
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  // ... (estilos modalKeyboardAvoidingView, modalOverlay, modalContentContainer, etc. inalterados) ...
  modalKeyboardAvoidingView: { flex: 1, justifyContent: 'flex-end', },
  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', },
  modalContentContainer: { width: '100%', maxHeight: screenHeight * 0.85, borderTopRightRadius: 20, borderTopLeftRadius: 20, },
  modalHeader: { width: '100%', alignItems: 'center', paddingTop: 10, marginBottom: 5, },
  modalHandle: { width: 40, height: 5, borderRadius: 4, },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', paddingHorizontal: 24, },
  formScrollView: { width: '100%', },
  formContent: { paddingHorizontal: 24, paddingBottom: 30, },
  inputLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 6, alignSelf: 'flex-start', width: '100%', },
  inputRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 15, },
  inputFlex: { flex: 1, },
  suggestionButton: { paddingLeft: 10, },
  modalInput: { height: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, fontSize: 16, width: '100%', marginBottom: 5, }, // Reduzido marginBottom
  textArea: { height: 100, textAlignVertical: 'top', paddingTop: 15, marginBottom: 15, },
  newTag: { fontSize: 12, color: colors.primary, fontStyle: 'italic', alignSelf: 'flex-end', marginTop: -5, marginBottom: 10, },
  imagePickerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, paddingVertical: 20, marginBottom: 10, width: '100%', },
  imagePreview: { width: 60, height: 60, marginRight: 15, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  progressContainer: { width: '100%', alignItems: 'center', marginBottom: 15, },
  progressBarBackground: { height: 8, width: '90%', borderRadius: 4, overflow: 'hidden', },
  progressBarFill: { height: '100%', borderRadius: 4, },
  modalButton: { height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center', width: '100%', marginTop: 10, },
  modalButtonText: { fontSize: 16, fontWeight: 'bold', },
  // --- Estilos Autocomplete ---
  suggestionsList: {
    // position: 'absolute', // Pode causar problemas com scroll/keyboardavoidingview
    // top: '100%', // Posiciona abaixo do input (se absoluto)
    left: 0,
    right: 0,
    backgroundColor: colors.backgroundSecondary, // Fundo da lista
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    maxHeight: 150, // Limita altura da lista
    zIndex: 10, // Garante que fique acima de outros elementos
    marginTop: -5, // Sobrepõe um pouco a borda inferior do input
    marginBottom: 10, // Espaço antes do próximo elemento
    elevation: 3, // Sombra Android
    shadowColor: colors.shadow, // Sombra iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

export default AdicionarTerritorioModal;
