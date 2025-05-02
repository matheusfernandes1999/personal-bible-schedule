   // components/pregacao/AdicionarTerritorioModal.tsx
   import React, { useState, useEffect, useCallback } from 'react';
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
       FlatList,
   } from 'react-native';
   import { useTheme } from '@/context/ThemeContext';
   import { useAuth } from '@/context/AuthContext';
   import { showMessage } from 'react-native-flash-message';
   import {
       collection,
       doc,
       getDoc,
       updateDoc,
       serverTimestamp,
       writeBatch,
       arrayUnion,
       FieldValue // Import FieldValue for serverTimestamp type
   } from 'firebase/firestore';
   import { db, storage } from '@/lib/firebase';
   // Assuming types are in '@/types' - adjust path if needed
   import { TerritoryCardData, CongregationData } from '@/types';
   import { Ionicons } from '@expo/vector-icons';
   import * as ImagePicker from 'expo-image-picker';
   import * as DocumentPicker from 'expo-document-picker';
   import * as FileSystem from 'expo-file-system';
   import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
   import { GeoJsonObject } from 'geojson';

   // --- Firestore Map Data Type ---
   // Define the structure for storing map data in Firestore
   interface MapDataFirestore {
       name: string;
       geojsonData: string; // <<< CHANGED: Store GeoJSON as a string
       createdAt: FieldValue;
       createdBy: string;
   }

   // --- Interfaces & Types ---
   interface AdicionarTerritorioModalProps {
       isVisible: boolean;
       onClose: () => void;
       congregationId: string;
   }

   type UploadType = 'image' | 'geojson';

   // --- Helper: Validate GeoJSON ---
   const isValidGeoJson = (data: any): data is GeoJsonObject => {
       if (typeof data !== 'object' || data === null) return false;
       const validTypes = [
           'Point', 'MultiPoint', 'LineString', 'MultiLineString',
           'Polygon', 'MultiPolygon', 'GeometryCollection',
           'Feature', 'FeatureCollection'
       ];
       return typeof data.type === 'string' && validTypes.includes(data.type);
   };


   // --- Component ---
   const AdicionarTerritorioModal: React.FC<AdicionarTerritorioModalProps> = ({
       isVisible,
       onClose,
       congregationId,
   }) => {
       const { colors } = useTheme();
       const { user } = useAuth();
       const styles = createStyles(colors);

       // --- Form States ---
       const [city, setCity] = useState('');
       const [section, setSection] = useState('');
       const [cardNumber, setCardNumber] = useState('');
       const [notes, setNotes] = useState('');
       const [imageUri, setImageUri] = useState<string | null>(null);
       const [isSaving, setIsSaving] = useState(false);
       const [uploadProgress, setUploadProgress] = useState<number | null>(null);

       // --- Map States ---
       const [uploadType, setUploadType] = useState<UploadType>('image');
       const [geoJsonFile, setGeoJsonFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
       const [isPickingFile, setIsPickingFile] = useState(false);

       // --- Autocomplete States ---
       const [existingCities, setExistingCities] = useState<string[]>([]);
       const [existingSectionsByCity, setExistingSectionsByCity] = useState<{ [city: string]: string[] }>({});
       const [dataLoading, setDataLoading] = useState(false);
       const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
       const [sectionSuggestions, setSectionSuggestions] = useState<string[]>([]);
       const [showCitySuggestions, setShowCitySuggestions] = useState(false);
       const [showSectionSuggestions, setShowSectionSuggestions] = useState(false);

       // --- Fetch Existing Data (Cities/Sections) ---
       useEffect(() => {
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
                     setExistingCities(cities.sort());
                     Object.keys(sectionsMap).forEach(c => sectionsMap[c]?.sort());
                     setExistingSectionsByCity(sectionsMap);
                   } else { setExistingCities([]); setExistingSectionsByCity({}); }
                 } catch (error) { console.error("Erro ao buscar cidades/seções:", error); }
                 finally { setDataLoading(false); }
               };
               fetchExistingData();
             } else { setExistingCities([]); setExistingSectionsByCity({}); }
       }, [isVisible, congregationId]);

       // --- Clear Form on Close ---
       useEffect(() => {
           if (!isVisible) {
               setCity(''); setSection(''); setCardNumber(''); setNotes('');
               setImageUri(null); setGeoJsonFile(null);
               setIsSaving(false); setUploadProgress(null);
               setUploadType('image');
               setShowCitySuggestions(false); setShowSectionSuggestions(false);
           }
       }, [isVisible]);

       // --- Autocomplete Handlers ---
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
             setCitySuggestions([]);
           }
           setSection('');
           setShowSectionSuggestions(false);
           setSectionSuggestions([]);
         };

         const handleSectionChange = (text: string) => {
           setSection(text);
           const currentCitySections = existingSectionsByCity[city.trim()] || [];
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
           setSection('');
           setShowSectionSuggestions(false);
         };

         const selectSectionSuggestion = (selectedSection: string) => {
           setSection(selectedSection);
           setShowSectionSuggestions(false);
         };

       // --- Image Picking Logic ---
       const handlePickImage = async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              alert('Permissão para acessar a galeria é necessária!');
              return;
            }
            let result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 0.7,
            });
            if (!result.canceled) {
              setImageUri(result.assets[0].uri);
              setGeoJsonFile(null); // Clear GeoJSON
              console.log("Imagem selecionada:", result.assets[0].uri);
            }
       };

       // --- GeoJSON File Picking Logic ---
       const handlePickGeoJson = useCallback(async () => {
           if (isPickingFile) return;
           setIsPickingFile(true);
           try {
               const result = await DocumentPicker.getDocumentAsync({
                   type: ['application/json', 'application/geo+json'],
                   copyToCacheDirectory: true,
               });
               if (!result.canceled && result.assets && result.assets.length > 0) {
                   const file = result.assets[0];
                   const fileNameLower = file.name?.toLowerCase();
                   if (!fileNameLower?.endsWith('.json') && !fileNameLower?.endsWith('.geojson')) {
                       Alert.alert('Arquivo Inválido', 'Por favor, selecione um arquivo .json ou .geojson.');
                       setGeoJsonFile(null);
                   } else {
                       setGeoJsonFile(file);
                       setImageUri(null); // Clear image
                       console.log("Arquivo GeoJSON selecionado:", file.name);
                   }
               } else {
                   console.log("Seleção de GeoJSON cancelada ou sem assets.");
               }
           } catch (err: any) {
               console.error("Erro ao selecionar GeoJSON:", err);
               Alert.alert("Erro", `Não foi possível selecionar o arquivo: ${err.message}`);
               setGeoJsonFile(null);
           } finally {
               setIsPickingFile(false);
           }
       }, [isPickingFile]);

       // --- Image Upload to Storage ---
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
           setUploadProgress(0);
           const uploadTask = uploadBytesResumable(storageRef, blob);
           return new Promise((resolve, reject) => {
               uploadTask.on('state_changed',
                   (snapshot) => {
                       const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                       setUploadProgress(progress);
                   },
                   (error) => { setUploadProgress(null); reject(error); },
                   async () => {
                       const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                       setUploadProgress(null);
                       // @ts-ignore
                       if (blob.close) blob.close();
                       resolve(downloadURL);
                   }
               );
           });
       };

       const handleSaveChanges = async () => {
        const trimmedCity = city.trim();
        const trimmedSection = section.trim();
        const trimmedCardNumber = cardNumber.trim();
    
        if (!trimmedCity || !trimmedSection || !trimmedCardNumber) {
            Alert.alert("Campos Obrigatórios", "Cidade, Seção e Número do Cartão são obrigatórios.");
            return;
        }
        if (!user) {
            Alert.alert("Erro", "Usuário não autenticado.");
            return;
        }
        if (uploadType === 'image' && !imageUri) {
            Alert.alert("Arquivo Faltando", "Por favor, selecione uma imagem para o cartão.");
            return;
        }
        if (uploadType === 'geojson' && !geoJsonFile) {
            Alert.alert("Arquivo Faltando", "Por favor, selecione um arquivo GeoJSON para o mapa.");
            return;
        }
    
        setIsSaving(true);
        let finalImageUrl: string | null = null;
        let finalMapId: string | null = null; // To store the map ID if GeoJSON is used
        let parsedGeoJson: GeoJsonObject | null = null; // Declare GeoJSON data here
        const isNewCity = !existingCities.includes(trimmedCity);
        const isNewSection = !existingSectionsByCity[trimmedCity]?.includes(trimmedSection);
    
        try {
            // --- Start Batch Write ---
            const batch = writeBatch(db);
    
            // --- Handle File Processing Based on Type ---
            if (uploadType === 'image' && imageUri) {
                console.log("Processing image upload...");
                finalImageUrl = await uploadImageAsync(imageUri);
                console.log("Image upload complete:", finalImageUrl);
            } else if (uploadType === 'geojson' && geoJsonFile) {
                console.log("Processing GeoJSON file...");
                // 1. Read File
                const fileContent = await FileSystem.readAsStringAsync(geoJsonFile.uri, {
                    encoding: FileSystem.EncodingType.UTF8,
                });
                // 2. Parse JSON
                try {
                    parsedGeoJson = JSON.parse(fileContent);
                } catch (parseError: any) {
                    throw new Error(`Arquivo GeoJSON inválido: ${parseError.message}`);
                }
                // 3. Validate GeoJSON
                if (!isValidGeoJson(parsedGeoJson)) {
                    throw new Error('O conteúdo do arquivo não parece ser um GeoJSON válido.');
                }
                console.log("GeoJSON parsed and validated.");
    
                // 4. Generate a unique mapId for this GeoJSON data
                finalMapId = `${Date.now()}`; // Unique mapId using the current timestamp
                console.log(`Generated mapId for GeoJSON: ${finalMapId}`);
            }
    
            // --- Prepare Territory Card Data ---
            const cardsCollectionRef = collection(db, "congregations", congregationId, "territoryCards");
            const newCardRef = doc(cardsCollectionRef); // Generate new ID for the card doc
    
            const newCardData: Omit<TerritoryCardData, 'id'> = {
                city: trimmedCity,
                section: trimmedSection,
                cardNumber: trimmedCardNumber,
                notes: notes.trim(),
                imageUrl: finalImageUrl, // Null if geoJsonData is set
                mapId: finalMapId, // Store mapId for GeoJSON
                status: 'Disponível',
                lastWorkedBy: null, lastWorkedByName: null, lastReturnDate: null,
                createdAt: serverTimestamp(),
                createdBy: user.uid,
                geojsonData: JSON.stringify(parsedGeoJson) // Store GeoJSON data directly
            };
            batch.set(newCardRef, newCardData); // Add card save operation to batch
            console.log(`Batch: Added territory card data with geojsonData and mapId.`);
    
            // --- Update Congregation Doc (if new city/section) ---
            const congDocRef = doc(db, "congregations", congregationId);
            let updates: { [key: string]: any } = {};
            if (isNewCity) {
                updates[`cities`] = arrayUnion(trimmedCity);
                updates[`sectionsByCity.${trimmedCity}`] = [trimmedSection];
                console.log("Batch: Nova cidade detectada:", trimmedCity);
            } else if (isNewSection) {
                updates[`sectionsByCity.${trimmedCity}`] = arrayUnion(trimmedSection);
                console.log("Batch: Nova seção detectada:", trimmedSection, "para cidade:", trimmedCity);
            }
            if (Object.keys(updates).length > 0) {
                batch.update(congDocRef, updates);
                console.log("Batch: Updating congregation document.");
            }
    
            // --- Commit Batch ---
            await batch.commit();
            console.log("Batch commit successful.");
    
            showMessage({ message: "Sucesso", description: "Cartão de território adicionado.", type: "success" });
            onClose();
    
        } catch (error: any) {
            console.error("Erro ao adicionar cartão:", error);
            showMessage({ message: "Erro ao Salvar", description: error.message || "Não foi possível adicionar o cartão.", type: "danger" });
        } finally {
            setIsSaving(false);
            setUploadProgress(null);
        }
    };
    

       // --- Render Component ---
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
                   {/* Overlay */}
                   <TouchableWithoutFeedback onPress={() => {
                       setShowCitySuggestions(false);
                       setShowSectionSuggestions(false);
                       onClose();
                   }}>
                       <View style={styles.modalOverlay} />
                   </TouchableWithoutFeedback>

                   {/* Content */}
                   <View style={[styles.modalContentContainer, { backgroundColor: colors.backgroundSecondary }]}>
                       <View style={styles.modalHeader}>
                           <View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} />
                       </View>
                       <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                           Adicionar Território
                       </Text>

                       {dataLoading ? (
                           <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1, paddingVertical: 50 }} />
                       ) : (
                           <ScrollView style={styles.formScrollView} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">

                               {/* City Input & Suggestions */}
                               <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Cidade</Text>
                               <TextInput /* ... props ... */
                                   style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                                   placeholder="Nome da Cidade" placeholderTextColor={colors.placeholder} value={city} onChangeText={handleCityChange}
                                   onFocus={() => { if (city.length > 0) setShowCitySuggestions(true); setShowSectionSuggestions(false); }}
                                   onBlur={() => setTimeout(() => setShowCitySuggestions(false), 150)}
                               />
                               {showCitySuggestions && citySuggestions.length > 0 && (
                                   <FlatList data={citySuggestions} keyExtractor={(item) => item}
                                       renderItem={({ item }) => ( <TouchableOpacity style={[styles.suggestionItem, { borderBottomColor: colors.border }]} onPress={() => selectCitySuggestion(item)}> <Text style={{ color: colors.textPrimary }}>{item}</Text> </TouchableOpacity> )}
                                       style={[styles.suggestionsList, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} keyboardShouldPersistTaps="always" />
                               )}
                               {!dataLoading && isNewCity && !showCitySuggestions && ( <Text style={styles.newTag}> (Nova)</Text> )}

                               {/* Section Input & Suggestions */}
                               <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Seção</Text>
                               <TextInput /* ... props ... */
                                   style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                                   placeholder="Nome/Número da Seção" placeholderTextColor={colors.placeholder} value={section} onChangeText={handleSectionChange}
                                   onFocus={() => { if (section.length > 0 && city.trim()) setShowSectionSuggestions(true); setShowCitySuggestions(false); }}
                                   onBlur={() => setTimeout(() => setShowSectionSuggestions(false), 150)} editable={!!city.trim()}
                               />
                                {showSectionSuggestions && sectionSuggestions.length > 0 && (
                                    <FlatList data={sectionSuggestions} keyExtractor={(item) => item}
                                        renderItem={({ item }) => ( <TouchableOpacity style={[styles.suggestionItem, { borderBottomColor: colors.border }]} onPress={() => selectSectionSuggestion(item)}> <Text style={{ color: colors.textPrimary }}>{item}</Text> </TouchableOpacity> )}
                                        style={[styles.suggestionsList, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} keyboardShouldPersistTaps="always" />
                               )}
                               {!dataLoading && isNewSection && !showSectionSuggestions && ( <Text style={styles.newTag}> (Nova)</Text> )}

                               {/* Card Number Input */}
                               <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Número/Código do Cartão</Text>
                               <TextInput style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Ex: 101, A-15" placeholderTextColor={colors.placeholder} value={cardNumber} onChangeText={setCardNumber} />

                               {/* Notes Input */}
                               <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Notas (Opcional)</Text>
                               <TextInput style={[styles.modalInput, styles.textArea, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Limites, observações..." placeholderTextColor={colors.placeholder} value={notes} onChangeText={setNotes} multiline />

                               {/* Upload Type Selection */}
                               <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Tipo de Mapa/Arquivo</Text>
                               <View style={styles.uploadTypeContainer}>
                                   <TouchableOpacity style={[styles.uploadTypeButton, uploadType === 'image' && styles.uploadTypeButtonActive, { borderColor: colors.primary }]} onPress={() => setUploadType('image')} disabled={isSaving}>
                                       <Ionicons name="image-outline" size={20} color={uploadType === 'image' ? colors.white : colors.primary} style={styles.uploadTypeIcon} />
                                       <Text style={[styles.uploadTypeButtonText, { color: uploadType === 'image' ? colors.white : colors.primary }]}>Imagem</Text>
                                   </TouchableOpacity>
                                   <TouchableOpacity style={[styles.uploadTypeButton, uploadType === 'geojson' && styles.uploadTypeButtonActive, { borderColor: colors.primary }]} onPress={() => setUploadType('geojson')} disabled={isSaving}>
                                       <Ionicons name="map-outline" size={20} color={uploadType === 'geojson' ? colors.white : colors.primary} style={styles.uploadTypeIcon} />
                                       <Text style={[styles.uploadTypeButtonText, { color: uploadType === 'geojson' ? colors.white : colors.primary }]}>GeoJSON</Text>
                                   </TouchableOpacity>
                               </View>

                               {/* Conditional File Picker */}
                               {uploadType === 'image' ? (
                                   <>
                                       <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Imagem do Cartão*</Text>
                                       <TouchableOpacity style={[styles.filePickerButton, { borderColor: colors.border }]} onPress={handlePickImage} disabled={isSaving || isPickingFile}>
                                           {imageUri ? (<Image source={{ uri: imageUri }} style={styles.imagePreview} />)
                                               : (<Ionicons name="camera-outline" size={24} color={colors.textSecondary} style={{ marginRight: 10 }} />)}
                                           <Text style={{ color: colors.textSecondary }}>{imageUri ? 'Trocar Imagem' : 'Selecionar Imagem'}</Text>
                                       </TouchableOpacity>
                                       {uploadProgress !== null && imageUri && ( /* Image Upload Progress */
                                           <View style={styles.progressContainer}>
                                               <Text style={{ color: colors.textSecondary, marginBottom: 5 }}>Enviando imagem...</Text>
                                               <View style={[styles.progressBarBackground, { backgroundColor: colors.border }]}>
                                                   <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${uploadProgress}%` }]} />
                                               </View>
                                               <Text style={{ color: colors.textSecondary, marginTop: 5 }}>{Math.round(uploadProgress)}%</Text>
                                           </View>
                                       )}
                                   </>
                               ) : (
                                   <>
                                       <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Arquivo GeoJSON do Mapa*</Text>
                                       <TouchableOpacity style={[styles.filePickerButton, { borderColor: colors.border }]} onPress={handlePickGeoJson} disabled={isSaving || isPickingFile}>
                                           <Ionicons name="document-attach-outline" size={24} color={colors.textSecondary} style={{ marginRight: 10 }} />
                                           <Text style={styles.fileNameText} numberOfLines={1} ellipsizeMode='middle'>
                                               {geoJsonFile ? geoJsonFile.name : 'Selecionar Arquivo (.json/.geojson)'}
                                           </Text>
                                           {geoJsonFile && (
                                                <TouchableOpacity onPress={() => setGeoJsonFile(null)} style={styles.clearFileButton}>
                                                    <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                                                </TouchableOpacity>
                                            )}
                                       </TouchableOpacity>
                                   </>
                               )}

                               {/* Save Button */}
                               <TouchableOpacity
                                    style={[
                                        styles.modalButton,
                                        {
                                            backgroundColor: isSaving ? colors.primaryLight : colors.primary,
                                            // Disable button visually if saving OR if the required file type is not selected
                                            opacity: (isSaving || (uploadType === 'image' && !imageUri) || (uploadType === 'geojson' && !geoJsonFile)) ? 0.7 : 1
                                        }
                                    ]}
                                   onPress={handleSaveChanges}
                                   // Disable button logically if saving OR if the required file type is not selected
                                   disabled={isSaving || (uploadType === 'image' && !imageUri) || (uploadType === 'geojson' && !geoJsonFile)}
                               >
                                   {isSaving ? (<ActivityIndicator size="small" color={colors.textOnPrimary} />)
                                       : (<Text style={[styles.modalButtonText, { color: colors.textPrimary }]}> Salvar Cartão </Text>)}
                               </TouchableOpacity>
                           </ScrollView>
                       )}
                   </View>
               </KeyboardAvoidingView>
           </Modal>
       );
   };

   // --- Styles ---
   // Styles remain largely the same, ensure they are defined as before
   const screenHeight = Dimensions.get('window').height;
   const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
       modalKeyboardAvoidingView: { flex: 1, justifyContent: 'flex-end', },
       modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', },
       modalContentContainer: { width: '100%', maxHeight: screenHeight * 0.85, borderTopRightRadius: 20, borderTopLeftRadius: 20, overflow: 'hidden' },
       modalHeader: { width: '100%', alignItems: 'center', paddingTop: 10, marginBottom: 5, backgroundColor: colors.backgroundSecondary },
       modalHandle: { width: 40, height: 5, borderRadius: 4, backgroundColor: colors.textMuted },
       modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', paddingHorizontal: 24, backgroundColor: colors.backgroundSecondary, paddingTop: 10 },
       formScrollView: { width: '100%', backgroundColor: colors.backgroundSecondary },
       formContent: { paddingHorizontal: 24, paddingBottom: 40, },
       inputLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 6, alignSelf: 'flex-start', width: '100%', },
       modalInput: { height: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, fontSize: 16, width: '100%', marginBottom: 5, backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.textPrimary }, // Added theme colors
       textArea: { height: 100, textAlignVertical: 'top', paddingTop: 15, marginBottom: 15, },
       newTag: { fontSize: 12, color: colors.primary, fontStyle: 'italic', alignSelf: 'flex-end', marginTop: -5, marginBottom: 10, },
       uploadTypeContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, marginTop: 5, },
       uploadTypeButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 15, borderWidth: 1, borderRadius: 20, flex: 1, justifyContent: 'center', marginHorizontal: 5, },
       uploadTypeButtonActive: { backgroundColor: colors.primary, },
       uploadTypeButtonText: { fontSize: 14, fontWeight: '500', },
       uploadTypeIcon: { marginRight: 8, },
       filePickerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, paddingVertical: 15, paddingHorizontal: 15, marginBottom: 15, width: '100%', minHeight: 60, backgroundColor: colors.backgroundPrimary }, // Added background
       imagePreview: { width: 60, height: 60, marginRight: 15, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
       fileNameText: { color: colors.textSecondary, flex: 1, marginLeft: 10, textAlign: 'center', },
       clearFileButton: { paddingLeft: 10, },
       progressContainer: { width: '100%', alignItems: 'center', marginBottom: 15, },
       progressBarBackground: { height: 8, width: '90%', borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border },
       progressBarFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
       modalButton: { height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center', width: '100%', marginTop: 10, },
       modalButtonText: { fontSize: 16, fontWeight: 'bold', },
       suggestionsList: { left: 0, right: 0, maxHeight: 150, zIndex: 10, marginTop: -5, marginBottom: 10, borderWidth: 1, borderRadius: 6, elevation: 3, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, backgroundColor: colors.backgroundSecondary, borderColor: colors.border }, // Added theme colors
       suggestionItem: { paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, // Added theme color
   });

   export default AdicionarTerritorioModal;