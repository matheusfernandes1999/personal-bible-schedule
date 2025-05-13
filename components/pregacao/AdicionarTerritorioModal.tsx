    // components/pregacao/AdicionarTerritorioModal.tsx
    // Allows adding a territory card with optional Image and optional GeoJSON map
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
    import { useTheme } from '@/context/ThemeContext'; // Adjust path as needed
    import { useAuth } from '@/context/AuthContext'; // Adjust path as needed
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
    import { db, storage } from '@/lib/firebase'; // Adjust path as needed
    // Assuming types are in '@/types' - adjust path if needed
    // Ensure TerritoryCardData allows both imageUrl and mapId to be potentially non-null
    import { TerritoryCardData, CongregationData } from '@/types';
    import { Ionicons } from '@expo/vector-icons'; // Assuming Expo Vector Icons are installed
    import * as ImagePicker from 'expo-image-picker';
    import * as DocumentPicker from 'expo-document-picker';
    import * as FileSystem from 'expo-file-system';
    import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
    import { GeoJsonObject } from 'geojson';

    // --- Firestore Map Data Type ---
    // Structure for storing map data in Firestore
    interface MapDataFirestore {
        name: string;
        geojsonData: string; // Stored as string
        createdAt: FieldValue;
        createdBy: string;
    }

    // --- Interfaces & Types ---
    interface AdicionarTerritorioModalProps {
        isVisible: boolean;
        onClose: () => void;
        congregationId: string;
    }

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
        const { colors } = useTheme(); // Using theme context for colors
        const { user } = useAuth(); // Get authenticated user
        const styles = createStyles(colors); // Create styles based on theme

        // --- Form States ---
        const [city, setCity] = useState('');
        const [section, setSection] = useState('');
        const [cardNumber, setCardNumber] = useState('');
        const [notes, setNotes] = useState('');
        const [imageUri, setImageUri] = useState<string | null>(null); // Local URI for selected image
        const [geoJsonFile, setGeoJsonFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null); // Selected GeoJSON file info
        const [isSaving, setIsSaving] = useState(false); // Loading state for save operation
        const [uploadProgress, setUploadProgress] = useState<number | null>(null); // Image upload progress (0-100)
        const [isPickingFile, setIsPickingFile] = useState(false); // Prevent opening multiple pickers

        // --- Autocomplete States ---
        const [existingCities, setExistingCities] = useState<string[]>([]);
        const [existingSectionsByCity, setExistingSectionsByCity] = useState<{ [city: string]: string[] }>({});
        const [dataLoading, setDataLoading] = useState(false); // Loading state for existing data
        const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
        const [sectionSuggestions, setSectionSuggestions] = useState<string[]>([]);
        const [showCitySuggestions, setShowCitySuggestions] = useState(false);
        const [showSectionSuggestions, setShowSectionSuggestions] = useState(false);

        // --- Fetch Existing Cities/Sections for Autocomplete ---
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
                            setExistingCities(cities.sort()); // Sort cities alphabetically
                            // Sort sections within each city
                            Object.keys(sectionsMap).forEach(c => sectionsMap[c]?.sort());
                            setExistingSectionsByCity(sectionsMap);
                        } else {
                            // Handle case where congregation document doesn't exist
                            setExistingCities([]);
                            setExistingSectionsByCity({});
                            console.warn(`Congregation document ${congregationId} not found.`);
                        }
                    } catch (error) {
                        console.error("Error fetching existing cities/sections:", error);
                        // Optionally show feedback to the user
                    } finally {
                        setDataLoading(false);
                    }
                };
                fetchExistingData();
            } else {
                // Clear data if modal is not visible or congregationId is missing
                setExistingCities([]);
                setExistingSectionsByCity({});
            }
        }, [isVisible, congregationId]); // Rerun when modal visibility or congregationId changes

        // --- Clear Form State on Modal Close ---
        useEffect(() => {
            if (!isVisible) {
                setCity('');
                setSection('');
                setCardNumber('');
                setNotes('');
                setImageUri(null);
                setGeoJsonFile(null);
                setIsSaving(false);
                setUploadProgress(null);
                setShowCitySuggestions(false);
                setShowSectionSuggestions(false);
                setIsPickingFile(false); // Reset picker lock
            }
        }, [isVisible]); // Rerun only when modal visibility changes

        // --- Autocomplete Input Handlers ---
        const handleCityChange = (text: string) => {
            setCity(text);
            if (text.length > 0) {
                const filtered = existingCities.filter(c =>
                    c.toLowerCase().includes(text.toLowerCase())
                );
                setCitySuggestions(filtered);
                setShowCitySuggestions(true); // Show suggestions when typing
            } else {
                setShowCitySuggestions(false); // Hide if input is empty
                setCitySuggestions([]);
            }
            // Clear section when city changes
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
                setShowSectionSuggestions(true); // Show suggestions when typing
            } else {
                setShowSectionSuggestions(false); // Hide if input is empty
                setSectionSuggestions([]);
            }
        };

        // --- Autocomplete Selection Handlers ---
        const selectCitySuggestion = (selectedCity: string) => {
            setCity(selectedCity);
            setShowCitySuggestions(false); // Hide suggestions after selection
            setSection(''); // Clear section field
            setShowSectionSuggestions(false);
        };

        const selectSectionSuggestion = (selectedSection: string) => {
            setSection(selectedSection);
            setShowSectionSuggestions(false); // Hide suggestions after selection
        };

        // --- Image Picking Logic ---
        const handlePickImage = async () => {
            if (isPickingFile) return; // Prevent simultaneous picking
            setIsPickingFile(true);
            try {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permissão Necessária', 'Permissão para acessar a galeria é necessária!');
                    return;
                }
                let result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    quality: 0.7, // Compress image slightly
                });
                if (!result.canceled && result.assets && result.assets.length > 0) {
                    setImageUri(result.assets[0].uri); // Store local URI
                    console.log("Image selected:", result.assets[0].uri);
                }
            } catch (error) {
                 console.error("Error picking image:", error);
                 Alert.alert("Erro", "Não foi possível selecionar a imagem.");
            } finally {
                setIsPickingFile(false);
            }
        };

        // --- GeoJSON File Picking Logic ---
        const handlePickGeoJson = useCallback(async () => {
            if (isPickingFile) return; // Prevent simultaneous picking
            setIsPickingFile(true);
            try {
                const result = await DocumentPicker.getDocumentAsync({
                    type: ['application/json', 'application/geojson', '*/*'], // Specific MIME types
                    copyToCacheDirectory: true, // Needed to read file content
                });
                if (!result.canceled && result.assets && result.assets.length > 0) {
                    const file = result.assets[0];
                    const fileNameLower = file.name?.toLowerCase();
                    // Basic validation for file extension
                    if (!fileNameLower?.endsWith('.json') && !fileNameLower?.endsWith('.geojson')) {
                        Alert.alert('Arquivo Inválido', 'Por favor, selecione um arquivo .json ou .geojson.');
                        setGeoJsonFile(null);
                    } else {
                        setGeoJsonFile(file); // Store file asset info
                        console.log("GeoJSON file selected:", file.name);
                    }
                } else {
                    console.log("GeoJSON selection cancelled or no assets.");
                }
            } catch (err: any) {
                console.error("Error selecting GeoJSON:", err);
                Alert.alert("Erro", `Não foi possível selecionar o arquivo: ${err.message}`);
                setGeoJsonFile(null);
            } finally {
                setIsPickingFile(false);
            }
        }, [isPickingFile]); // Dependency ensures function stability

        // --- Image Upload to Firebase Storage ---
        const uploadImageAsync = async (uri: string): Promise<string> => {
            // Convert local URI to Blob
            const blob = await new Promise<Blob>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.onload = function () { resolve(xhr.response); };
                xhr.onerror = function (e) { console.error(e); reject(new TypeError("Network request failed")); };
                xhr.responseType = "blob";
                xhr.open("GET", uri, true);
                xhr.send(null);
            });

            // Create unique filename
            const fileExtension = uri.split('.').pop() || 'jpg'; // Default extension
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
            // Define storage path
            const storageRef = ref(storage, `territoryCards/${congregationId}/${fileName}`);

            setUploadProgress(0); // Reset progress
            const uploadTask = uploadBytesResumable(storageRef, blob);

            // Return promise that resolves with download URL or rejects on error
            return new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => { // Progress updates
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setUploadProgress(progress);
                    },
                    (error) => { // Error handler
                        setUploadProgress(null);
                        console.error("Image upload error:", error);
                        reject(error);
                    },
                    async () => { // Success handler
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        setUploadProgress(null);
                        // @ts-ignore - blob.close() might not exist in RN environment
                        if (blob.close) blob.close(); // Release blob memory if possible
                        resolve(downloadURL);
                    }
                );
            });
        };

        // --- Save Territory Card Logic ---
        const handleSaveChanges = async () => {
            const trimmedCity = city.trim();
            const trimmedSection = section.trim();
            const trimmedCardNumber = cardNumber.trim();

            // --- Input Validation ---
            if (!trimmedCity || !trimmedSection || !trimmedCardNumber) {
                Alert.alert("Campos Obrigatórios", "Cidade, Seção e Número do Cartão são obrigatórios.");
                return;
            }
            if (!user) {
                Alert.alert("Erro", "Usuário não autenticado. Faça login novamente.");
                return;
            }
            // No longer require a specific file type, both are optional

            setIsSaving(true);
            let finalImageUrl: string | null = null;
            let finalMapId: string | null = null;
            const isNewCity = !existingCities.includes(trimmedCity);
            const isNewSection = !existingSectionsByCity[trimmedCity]?.includes(trimmedSection);

            try {
                // --- Create Firestore Batch ---
                const batch = writeBatch(db);

                // --- Process Image (if selected) ---
                if (imageUri) {
                    console.log("Uploading image...");
                    finalImageUrl = await uploadImageAsync(imageUri);
                    console.log("Image uploaded:", finalImageUrl);
                }

                // --- Process GeoJSON (if selected) ---
                if (geoJsonFile) {
                    console.log("Processing GeoJSON...");
                    // Read file content
                    const fileContent = await FileSystem.readAsStringAsync(geoJsonFile.uri, { encoding: FileSystem.EncodingType.UTF8 });
                    // Parse and validate
                    let parsedGeoJson: GeoJsonObject;
                    try { parsedGeoJson = JSON.parse(fileContent); } catch (e: any) { throw new Error(`Arquivo GeoJSON inválido: ${e.message}`); }
                    if (!isValidGeoJson(parsedGeoJson)) { throw new Error('Arquivo não parece ser GeoJSON válido.'); }
                    console.log("GeoJSON validated.");

                    // Prepare data for Firestore map document
                    const mapName = `${trimmedCity} - ${trimmedSection} - ${trimmedCardNumber}`;
                    const mapDataToSave: MapDataFirestore = {
                        name: mapName,
                        geojsonData: JSON.stringify(parsedGeoJson), // Store as string
                        createdAt: serverTimestamp(),
                        createdBy: user.uid,
                    };
                    // Create reference and add to batch
                    const mapsCollectionRef = collection(db, "congregations", congregationId, "maps");
                    const newMapRef = doc(mapsCollectionRef); // Firestore generates ID
                    batch.set(newMapRef, mapDataToSave);
                    finalMapId = newMapRef.id; // Get the generated ID
                    console.log(`Batch: Added map data with ID: ${finalMapId}`);
                }

                // --- Prepare Territory Card Document ---
                const cardsCollectionRef = collection(db, "congregations", congregationId, "territoryCards");
                const newCardRef = doc(cardsCollectionRef); // Firestore generates ID
                const newCardData: Omit<TerritoryCardData, 'id'> = {
                    city: trimmedCity,
                    section: trimmedSection,
                    cardNumber: trimmedCardNumber,
                    notes: notes.trim() || null, // Store null if empty
                    imageUrl: finalImageUrl, // Can be null or URL
                    mapId: finalMapId,       // Can be null or Firestore ID
                    status: 'Disponível',
                    lastWorkedBy: null,
                    lastWorkedByName: null,
                    lastReturnDate: null,
                    createdAt: serverTimestamp(),
                    createdBy: user.uid,
                };
                batch.set(newCardRef, newCardData); // Add card save to batch
                console.log(`Batch: Added territory card (Image: ${!!finalImageUrl}, Map: ${!!finalMapId})`);

                // --- Update Congregation Metadata (if needed) ---
                const congDocRef = doc(db, "congregations", congregationId);
                let updates: { [key: string]: any } = {};
                if (isNewCity) {
                    updates[`cities`] = arrayUnion(trimmedCity);
                    updates[`sectionsByCity.${trimmedCity}`] = [trimmedSection]; // Initialize array for new city
                } else if (isNewSection) {
                    updates[`sectionsByCity.${trimmedCity}`] = arrayUnion(trimmedSection); // Add to existing city's array
                }
                if (Object.keys(updates).length > 0) {
                    batch.update(congDocRef, updates); // Add congregation update to batch
                    console.log("Batch: Updating congregation metadata.");
                }

                // --- Commit All Operations ---
                await batch.commit();
                console.log("Batch commit successful.");
                showMessage({ message: "Sucesso", description: "Cartão de território adicionado.", type: "success" });
                onClose(); // Close modal on success

            } catch (error: any) {
                console.error("Error adding territory card:", error);
                showMessage({ message: "Erro ao Salvar", description: error.message || "Não foi possível adicionar o cartão.", type: "danger" });
            } finally {
                setIsSaving(false);
                setUploadProgress(null); // Clear progress indicator
            }
        };


        // --- Render Component ---
        const isNewCity = city.trim() && !existingCities.includes(city.trim());
        const isNewSection = section.trim() && city.trim() && !existingSectionsByCity[city.trim()]?.includes(section.trim());

        return (
            <Modal animationType="slide" transparent={true} visible={isVisible} onRequestClose={onClose} >
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalKeyboardAvoidingView} >
                    {/* Overlay */}
                    <TouchableWithoutFeedback onPress={() => { setShowCitySuggestions(false); setShowSectionSuggestions(false); onClose(); }}>
                        <View style={styles.modalOverlay} />
                    </TouchableWithoutFeedback>
                    {/* Content */}
                    <View style={[styles.modalContentContainer, { backgroundColor: colors.backgroundSecondary }]}>
                        {/* Header */}
                        <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} /></View>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}> Adicionar Território </Text>
                        {/* Form Area */}
                        {dataLoading ? ( <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1, paddingVertical: 50 }} /> )
                        : (
                            <ScrollView style={styles.formScrollView} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
                                {/* City Input & Suggestions */}
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Cidade*</Text>
                                <TextInput style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Nome da Cidade" placeholderTextColor={colors.placeholder} value={city} onChangeText={handleCityChange} onFocus={() => { if (city.length > 0) setShowCitySuggestions(true); setShowSectionSuggestions(false); }} onBlur={() => setTimeout(() => setShowCitySuggestions(false), 150)} />
                                {showCitySuggestions && citySuggestions.length > 0 && ( <FlatList data={citySuggestions} keyExtractor={(item) => item} renderItem={({ item }) => ( <TouchableOpacity style={[styles.suggestionItem, { borderBottomColor: colors.border }]} onPress={() => selectCitySuggestion(item)}> <Text style={{ color: colors.textPrimary }}>{item}</Text> </TouchableOpacity> )} style={[styles.suggestionsList, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} keyboardShouldPersistTaps="always" /> )}
                                {!dataLoading && isNewCity && !showCitySuggestions && ( <Text style={styles.newTag}> (Nova)</Text> )}

                                {/* Section Input & Suggestions */}
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Seção*</Text>
                                <TextInput style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Nome/Número da Seção" placeholderTextColor={colors.placeholder} value={section} onChangeText={handleSectionChange} onFocus={() => { if (section.length > 0 && city.trim()) setShowSectionSuggestions(true); setShowCitySuggestions(false); }} onBlur={() => setTimeout(() => setShowSectionSuggestions(false), 150)} editable={!!city.trim()} />
                                 {showSectionSuggestions && sectionSuggestions.length > 0 && ( <FlatList data={sectionSuggestions} keyExtractor={(item) => item} renderItem={({ item }) => ( <TouchableOpacity style={[styles.suggestionItem, { borderBottomColor: colors.border }]} onPress={() => selectSectionSuggestion(item)}> <Text style={{ color: colors.textPrimary }}>{item}</Text> </TouchableOpacity> )} style={[styles.suggestionsList, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} keyboardShouldPersistTaps="always" /> )}
                                {!dataLoading && isNewSection && !showSectionSuggestions && ( <Text style={styles.newTag}> (Nova)</Text> )}

                                {/* Card Number Input */}
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Número/Código do Cartão*</Text>
                                <TextInput style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Ex: 101, A-15" placeholderTextColor={colors.placeholder} value={cardNumber} onChangeText={setCardNumber} />

                                {/* Notes Input */}
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Notas (Opcional)</Text>
                                <TextInput style={[styles.modalInput, styles.textArea, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Limites, observações..." placeholderTextColor={colors.placeholder} value={notes} onChangeText={setNotes} multiline />

                                {/* --- Image Picker (Optional) --- */}
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Imagem do Cartão (Opcional)</Text>
                                <TouchableOpacity style={[styles.filePickerButton, { borderColor: colors.border }]} onPress={handlePickImage} disabled={isSaving || isPickingFile}>
                                    {imageUri ? (<Image source={{ uri: imageUri }} style={styles.imagePreview} />)
                                        : (<Ionicons name="camera-outline" size={24} color={colors.textSecondary} style={{ marginRight: 10 }} />)}
                                    <Text style={{ color: colors.textSecondary }}>{imageUri ? 'Trocar Imagem' : 'Selecionar Imagem'}</Text>
                                </TouchableOpacity>
                                {uploadProgress !== null && imageUri && ( /* Image Upload Progress */
                                    <View style={styles.progressContainer}>
                                        <Text style={{ color: colors.textSecondary, marginBottom: 5 }}>Enviando imagem...</Text>
                                        <View style={[styles.progressBarBackground, { backgroundColor: colors.border }]}><View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${uploadProgress}%` }]} /></View>
                                        <Text style={{ color: colors.textSecondary, marginTop: 5 }}>{Math.round(uploadProgress)}%</Text>
                                    </View>
                                )}

                                {/* --- GeoJSON Picker (Optional) --- */}
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Arquivo GeoJSON do Mapa (Opcional)</Text>
                                <TouchableOpacity style={[styles.filePickerButton, { borderColor: colors.border }]} onPress={handlePickGeoJson} disabled={isSaving || isPickingFile}>
                                    <Ionicons name="document-attach-outline" size={24} color={colors.textSecondary} style={{ marginRight: 10 }} />
                                    <Text style={styles.fileNameText} numberOfLines={1} ellipsizeMode='middle'>
                                        {geoJsonFile ? geoJsonFile.name : 'Selecionar Arquivo (.json/.geojson)'}
                                    </Text>
                                    {geoJsonFile && ( <TouchableOpacity onPress={() => setGeoJsonFile(null)} style={styles.clearFileButton}><Ionicons name="close-circle" size={20} color={colors.textMuted} /></TouchableOpacity> )}
                                </TouchableOpacity>

                                {/* Save Button */}
                                <TouchableOpacity
                                     style={[ styles.modalButton, { backgroundColor: isSaving ? colors.primaryLight : colors.primary, opacity: isSaving ? 0.7 : 1 } ]}
                                    onPress={handleSaveChanges}
                                    disabled={isSaving} // Only disable while saving
                                >
                                    {isSaving ? (<ActivityIndicator size="small" color={colors.white} />)
                                        : (<Text style={[styles.modalButtonText, { color: colors.white }]}> Salvar Cartão </Text>)}
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        );
    };

    // --- Styles ---
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
        modalInput: { height: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, fontSize: 16, width: '100%', marginBottom: 15, backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.textPrimary },
        textArea: { height: 100, textAlignVertical: 'top', paddingTop: 15, marginBottom: 15, },
        newTag: { fontSize: 12, color: colors.primary, fontStyle: 'italic', alignSelf: 'flex-end', marginTop: -15, marginBottom: 10, },
        filePickerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, paddingVertical: 15, paddingHorizontal: 15, marginBottom: 20, width: '100%', minHeight: 60, backgroundColor: colors.backgroundPrimary },
        imagePreview: { width: 60, height: 60, marginRight: 15, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
        fileNameText: { color: colors.textSecondary, flex: 1, marginLeft: 10, textAlign: 'center', },
        clearFileButton: { paddingLeft: 10, },
        progressContainer: { width: '100%', alignItems: 'center', marginBottom: 15, marginTop: -10 },
        progressBarBackground: { height: 8, width: '90%', borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border },
        progressBarFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
        modalButton: { height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center', width: '100%', marginTop: 10, },
        modalButtonText: { fontSize: 16, fontWeight: 'bold', color: colors.white }, // Ensure text color is set
        suggestionsList: { left: 0, right: 0, maxHeight: 150, zIndex: 10, marginTop: -15, marginBottom: 10, borderWidth: 1, borderRadius: 6, elevation: 3, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
        suggestionItem: { paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    });

    export default AdicionarTerritorioModal;