    // components/pregacao/SectionDetailModal.tsx
    // Displays details of a territory section, listing cards.
    // Allows viewing/editing attached images or maps for each card.
    import React, { useState, useEffect, useCallback } from 'react';
    import {
        View,
        Text,
        StyleSheet,
        TouchableOpacity,
        ActivityIndicator,
        Modal,
        TouchableWithoutFeedback,
        KeyboardAvoidingView,
        Platform,
        Dimensions,
        FlatList,
        Alert,
        Image,
        Share,
    } from 'react-native';
    import { useTheme } from '@/context/ThemeContext'; // Adjust path as needed
    import { useAuth } from '@/context/AuthContext'; // Adjust path as needed
    import { showMessage } from 'react-native-flash-message';
    import {
        collection,
        query,
        where,
        onSnapshot,
        Unsubscribe,
        doc,
        deleteDoc,
        updateDoc,
        Timestamp, // Keep Timestamp if used in types
        runTransaction,
        getDoc,
        writeBatch,
        getDocs,
        serverTimestamp, // Import serverTimestamp
        FieldValue, // Import FieldValue
    } from 'firebase/firestore';
    import { db, storage } from '@/lib/firebase'; // Adjust path as needed
    // Ensure TerritoryCardData allows both imageUrl and mapId
    import { TerritoryCardData, TERRITORY_SERVANT_CATEGORY, CongregationData, FeatureProperties } from '@/types'; // Adjust path as needed
    import { Ionicons } from '@expo/vector-icons'; // Assuming Expo Vector Icons are installed
    import ConfirmationModal from '@/components/common/ConfirmationModal'; // Adjust path as needed
    import RenameModal from '@/components/common/RenameModal'; // Adjust path as needed
    import MapViewerBottomSheet from './MapViewerBottomSheet'; // Adjust path as needed
    // --- Imports for editing ---
    import * as ImagePicker from 'expo-image-picker';
    import * as DocumentPicker from 'expo-document-picker';
    import * as FileSystem from 'expo-file-system';
    import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'; // Added deleteObject
    import { GeoJsonObject } from 'geojson';

    // --- Firestore Map Data Type ---
    // Structure for storing map data in Firestore
    interface MapDataFirestore {
        name: string;
        geojsonData: string; // Stored as string
        createdAt: FieldValue;
        createdBy: string;
    }

    // --- Props interface for the component ---
    interface SectionDetailModalProps {
        isVisible: boolean;
        onClose: () => void;
        congregationId: string;
        city: string;
        section: string;
        onDeleteSection: (city: string, section: string) => void; // Callback when section delete is triggered
        onSectionRenamed?: (city: string, oldSection: string, newSection: string) => void; // Optional callback after rename
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
    const SectionDetailModal: React.FC<SectionDetailModalProps> = ({
        isVisible,
        onClose,
        congregationId,
        city,
        section,
        onDeleteSection,
        onSectionRenamed,
    }) => {
        // --- Hooks ---
        const { colors } = useTheme(); // Get theme colors
        const { isAdmin, userCategories, user } = useAuth(); // Get user roles/permissions and user object
        const styles = createStyles(colors); // Create styles based on theme

        // --- State ---
        const [cards, setCards] = useState<TerritoryCardData[]>([]); // List of cards in the section
        const [loading, setLoading] = useState(true); // Loading state for fetching cards
        const [currentSectionName, setCurrentSectionName] = useState(section); // Track current section name

        // Internal Modals State
        const [isConfirmDeleteCardVisible, setIsConfirmDeleteCardVisible] = useState(false);
        const [cardToDelete, setCardToDelete] = useState<TerritoryCardData | null>(null);
        const [isRenameCardModalVisible, setIsRenameCardModalVisible] = useState(false);
        const [cardToRename, setCardToRename] = useState<TerritoryCardData | null>(null);
        const [isRenameSectionModalVisible, setIsRenameSectionModalVisible] = useState(false);
        const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
        const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
        const [isMapViewerVisible, setIsMapViewerVisible] = useState(false);
        const [viewingMapId, setViewingMapId] = useState<string | null>(null);

        // Action Loading State
        const [isDeletingCard, setIsDeletingCard] = useState(false);
        const [isRenamingCard, setIsRenamingCard] = useState(false);
        const [isRenamingSection, setIsRenamingSection] = useState(false);
        const [updatingCardId, setUpdatingCardId] = useState<string | null>(null); // State to track which card is being updated (image/map)
        const [isPickingFile, setIsPickingFile] = useState(false); // Prevent opening multiple pickers

        // Permissions
        const canManageTerritories = isAdmin || (userCategories?.includes(TERRITORY_SERVANT_CATEGORY) ?? false);

        // --- Effects ---

        // Reset section name and close viewers when modal visibility or initial section changes
        useEffect(() => {
            if (isVisible) {
                setCurrentSectionName(section); // Update local state if prop changes
            } else {
                // Reset internal state when modal closes to avoid stale data
                setIsMapViewerVisible(false);
                setViewingMapId(null);
                setIsImageViewerVisible(false);
                setViewingImageUrl(null);
                setIsConfirmDeleteCardVisible(false);
                setCardToDelete(null);
                setIsRenameCardModalVisible(false);
                setCardToRename(null);
                setIsRenameSectionModalVisible(false);
                setUpdatingCardId(null); // Clear card update indicator
                setIsPickingFile(false); // Reset picker lock
            }
        }, [isVisible, section]); // Rerun when modal visibility or initial section changes

        // Fetch territory cards for the current section
        useEffect(() => {
            let unsubscribe: Unsubscribe | null = null;
            // Only fetch if modal is visible and required IDs are present
            if (isVisible && congregationId && city && currentSectionName) {
                setLoading(true);
                setCards([]); // Clear previous cards
                console.log(`SectionDetailModal: Fetching cards for ${city} - ${currentSectionName}`);
                const cardsRef = collection(db, "congregations", congregationId, "territoryCards");
                const q = query(cardsRef, where("city", "==", city), where("section", "==", currentSectionName));

                // Set up Firestore listener
                unsubscribe = onSnapshot(q, (snapshot) => {
                    const fetchedCards: TerritoryCardData[] = [];
                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        // Basic validation: ensure essential fields exist
                        if (data.cardNumber && data.city && data.section) {
                            fetchedCards.push({ id: doc.id, ...data } as TerritoryCardData);
                        } else {
                            console.warn(`Card document ${doc.id} is missing essential fields (cardNumber, city, or section)`);
                        }
                    });
                    // Sort cards numerically by card number
                    setCards(fetchedCards.sort((a, b) =>
                        a.cardNumber.localeCompare(b.cardNumber, undefined, { numeric: true, sensitivity: 'base' })
                    ));
                    setLoading(false);
                }, (error) => {
                    // Handle listener errors
                    console.error("Error fetching section cards:", error);
                    showMessage({ message: "Erro", description: "Não foi possível carregar os cartões.", type: "danger" });
                    setLoading(false);
                });

            } else {
                // Clear cards if modal is not visible or IDs are missing
                setCards([]);
                setLoading(false);
            }
            // Cleanup listener on unmount or when dependencies change
            return () => { if (unsubscribe) unsubscribe(); };
        }, [isVisible, congregationId, city, currentSectionName]); // Dependencies for fetching

        // --- Action Handlers ---

        // Close the main modal
        const handleClose = () => onClose();

        // --- Card Deletion ---
        const confirmDeleteCard = (card: TerritoryCardData) => {
            if (!canManageTerritories) return; // Permission check
            setCardToDelete(card);
            setIsConfirmDeleteCardVisible(true); // Show confirmation modal
        };
        const deleteCard = async () => {
            if (!cardToDelete?.id || !congregationId || !canManageTerritories) return;
            setIsDeletingCard(true); // Set loading state
            try {
                const cardDocRef = doc(db, "congregations", congregationId, "territoryCards", cardToDelete.id);
                await deleteDoc(cardDocRef); // Delete the document
                showMessage({ message: "Sucesso", description: `Cartão "${cardToDelete.cardNumber}" excluído.`, type: "success"});
                // TODO: Optionally delete associated image/map document here or via cloud function
                if (cardToDelete.imageUrl) { try { const imageRef = ref(storage, cardToDelete.imageUrl); await deleteObject(imageRef); } catch(e){ console.error("Failed to delete old image", e);}}
                if (cardToDelete.mapId) { try { const mapRef = doc(db, "congregations", congregationId, "maps", cardToDelete.mapId); await deleteDoc(mapRef); } catch(e){ console.error("Failed to delete old map", e);}}
            } catch (error: any) {
                console.error("Error deleting card:", error);
                showMessage({ message: "Erro", description: error.message || "Não foi possível excluir o cartão.", type: "danger"});
            } finally {
                // Reset state regardless of success/failure
                setIsDeletingCard(false);
                setIsConfirmDeleteCardVisible(false);
                setCardToDelete(null);
            }
        };

        // --- Card Renaming ---
        const handlePresentRenameCardModal = (card: TerritoryCardData) => {
            if (!canManageTerritories || !card.id) return;
            setCardToRename(card);
            setIsRenameCardModalVisible(true); // Show rename modal
        };
        const handleDismissRenameCardModal = () => {
            setIsRenameCardModalVisible(false);
            setCardToRename(null);
        };
        const handleSaveCardRename = async (newCardNumber: string) => {
            if (!cardToRename || !cardToRename.id || !congregationId || !canManageTerritories) return;
            const trimmedNewNumber = newCardNumber.trim();
            if (!trimmedNewNumber || trimmedNewNumber === cardToRename.cardNumber) {
                handleDismissRenameCardModal(); // Close if no change or empty
                return;
            }
            setIsRenamingCard(true);
            try {
                const cardDocRef = doc(db, "congregations", congregationId, "territoryCards", cardToRename.id);
                await updateDoc(cardDocRef, { cardNumber: trimmedNewNumber }); // Update the field
                showMessage({ message: "Sucesso", description: "Número do cartão atualizado.", type: "success" });
                handleDismissRenameCardModal(); // Close modal on success
            } catch (error: any) {
                console.error("Error renaming card:", error);
                showMessage({ message: "Erro", description: error.message || "Não foi possível renomear o cartão.", type: "danger"});
            } finally {
                setIsRenamingCard(false);
            }
        };

        // --- Section Renaming ---
        const handlePresentRenameSectionModal = () => {
            if (!canManageTerritories) return;
            setIsRenameSectionModalVisible(true); // Show rename modal
        };
        const handleDismissRenameSectionModal = () => {
            setIsRenameSectionModalVisible(false);
        };
        const handleSaveSectionRename = async (newSectionName: string) => {
            if (!congregationId || !canManageTerritories) return;
            const trimmedNewName = newSectionName.trim();
            if (!trimmedNewName || trimmedNewName === currentSectionName) {
                handleDismissRenameSectionModal(); // Close if no change or empty
                return;
            }

            setIsRenamingSection(true);
            const oldSectionName = currentSectionName; // Store old name for query
            const cityName = city;
            const congDocRef = doc(db, "congregations", congregationId);

            try {
                // Use a transaction to ensure atomicity
                await runTransaction(db, async (transaction) => {
                    // 1. Read congregation data within transaction
                    const congDocSnap = await transaction.get(congDocRef);
                    if (!congDocSnap.exists()) throw new Error("Congregação não encontrada.");
                    const congData = congDocSnap.data() as CongregationData;
                    const sectionsMap = congData.sectionsByCity || {};
                    const sectionsInCity = sectionsMap[cityName] || [];

                    // 2. Validate names
                    if (!sectionsInCity.includes(oldSectionName)) throw new Error(`Seção "${oldSectionName}" não encontrada na cidade "${cityName}".`);
                    if (sectionsInCity.includes(trimmedNewName)) throw new Error(`Seção "${trimmedNewName}" já existe nesta cidade.`);

                    // 3. Update congregation metadata (remove old, add new, sort)
                    const updatedSectionsInCity = sectionsInCity
                        .filter(s => s !== oldSectionName)
                        .concat(trimmedNewName)
                        .sort(); // Keep sorted
                    const updatedSectionsMap = { ...sectionsMap, [cityName]: updatedSectionsInCity };
                    transaction.update(congDocRef, { sectionsByCity: updatedSectionsMap });

                    // 4. Find and update all cards in the old section (outside transaction for read, inside for write)
                    const cardsRef = collection(db, "congregations", congregationId, "territoryCards");
                    const q = query(cardsRef, where("city", "==", cityName), where("section", "==", oldSectionName));
                    // IMPORTANT: getDocs must be outside the transaction for reads after writes
                    const cardsSnapshot = await getDocs(q);
                    cardsSnapshot.forEach(cardDoc => {
                        // Add update operations to the transaction
                        transaction.update(cardDoc.ref, { section: trimmedNewName });
                    });
                    console.log(`Transaction: Renaming section in ${cardsSnapshot.size} cards.`);
                });

                // If transaction succeeds:
                showMessage({ message: "Sucesso", description: `Seção renomeada para "${trimmedNewName}".`, type: "success" });
                setCurrentSectionName(trimmedNewName); // Update local state to reflect change
                handleDismissRenameSectionModal(); // Close rename modal
                onSectionRenamed?.(cityName, oldSectionName, trimmedNewName); // Notify parent if needed

            } catch (error: any) {
                console.error("Error renaming section:", error);
                showMessage({ message: "Erro ao Renomear", description: error.message || "Não foi possível renomear a seção.", type: "danger" });
            } finally {
                setIsRenamingSection(false);
            }
        };

        // --- Section Deletion ---
        const handleDeleteSection = () => {
            if (!canManageTerritories) return;
            // Delegate confirmation and actual deletion logic to the parent component
            onDeleteSection(city, currentSectionName);
            // Close this detail modal immediately as the section will be gone
            onClose();
        };

        // --- Image Viewing ---
        const handleViewImage = (imageUrl: string | null | undefined) => {
            if (imageUrl) {
                setViewingImageUrl(imageUrl);
                setIsImageViewerVisible(true); // Show image viewer modal
            } else {
                showMessage({ message: "Imagem não disponível", type: "info" });
            }
        };
        const handleCloseImageViewer = () => {
            setIsImageViewerVisible(false);
            setViewingImageUrl(null);
        };

        // --- Map Viewing ---
        const handleViewMap = (mapId: string | null | undefined) => {
            if (mapId) {
                setViewingMapId(mapId); // Set the ID for the bottom sheet
                setIsMapViewerVisible(true); // Open the bottom sheet
            } else {
                showMessage({ message: "Mapa não disponível", type: "info" });
            }
        };
        const handleCloseMapView = () => {
            setIsMapViewerVisible(false); // Close the bottom sheet
            setViewingMapId(null);      // Clear the ID
        };

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
        
                    const uploadTask = uploadBytesResumable(storageRef, blob);
        
                    // Return promise that resolves with download URL or rejects on error
                    return new Promise((resolve, reject) => {
                        uploadTask.on('state_changed',
                            (snapshot) => { // Progress updates
                                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            },
                            (error) => { // Error handler
                                console.error("Image upload error:", error);
                                reject(error);
                            },
                            async () => { // Success handler
                                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                                // @ts-ignore - blob.close() might not exist in RN environment
                                if (blob.close) blob.close(); // Release blob memory if possible
                                resolve(downloadURL);
                            }
                        );
                    });
                };
        

        // --- Update Card Image ---
        const handleUpdateCardImage = async (card: TerritoryCardData) => {
            if (!canManageTerritories || !card.id || isPickingFile || updatingCardId) return;
            setIsPickingFile(true);
            setUpdatingCardId(card.id); // Set loading specific to this card
            try {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') { throw new Error('Permissão para acessar a galeria é necessária!'); }

                let result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.7,
                });

                if (!result.canceled && result.assets && result.assets.length > 0) {
                    const newImageUri = result.assets[0].uri;
                    console.log(`Uploading new image for card ${card.id}...`);

                    // --- Optional: Delete old image ---
                    if (card.imageUrl) {
                        try {
                            const oldImageRef = ref(storage, card.imageUrl); // Get ref from URL
                            await deleteObject(oldImageRef);
                            console.log("Old image deleted successfully.");
                        } catch (deleteError: any) {
                            // Log error but continue upload
                            if (deleteError.code !== 'storage/object-not-found') {
                                console.error("Failed to delete old image, continuing upload:", deleteError);
                            }
                        }
                    }
                    // --- End Optional Delete ---

                    const newImageUrl = await uploadImageAsync(newImageUri); // Upload new image
                    const cardDocRef = doc(db, "congregations", congregationId, "territoryCards", card.id);
                    await updateDoc(cardDocRef, { imageUrl: newImageUrl }); // Update Firestore link
                    console.log(`Card ${card.id} updated with new image.`);
                    showMessage({ message: "Sucesso", description: "Imagem do cartão atualizada.", type: "success" });
                } else {
                     console.log("Image selection cancelled.");
                }
            } catch (error: any) {
                console.error(`Error updating image for card ${card.id}:`, error);
                showMessage({ message: "Erro", description: error.message || "Não foi possível atualizar a imagem.", type: "danger" });
            } finally {
                setIsPickingFile(false);
                setUpdatingCardId(null); // Clear loading state for this card
            }
        };

        // --- Update Card Map ---
        const handleUpdateCardMap = async (card: TerritoryCardData) => {
             if (!canManageTerritories || !card.id || isPickingFile || updatingCardId || !user) return;
             setIsPickingFile(true);
             setUpdatingCardId(card.id); // Set loading specific to this card
             try {
                 const result = await DocumentPicker.getDocumentAsync({
                     type: ['application/json', 'application/geojson', '*/*'], copyToCacheDirectory: true,
                 });

                 if (!result.canceled && result.assets && result.assets.length > 0) {
                     const file = result.assets[0];
                     const fileNameLower = file.name?.toLowerCase();
                     if (!fileNameLower?.endsWith('.json') && !fileNameLower?.endsWith('.geojson')) {
                         throw new Error('Por favor, selecione um arquivo .json ou .geojson.');
                     }
                     console.log(`Processing new GeoJSON for card ${card.id}...`);
                     const fileContent = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
                     let parsedGeoJson: GeoJsonObject;
                     try { parsedGeoJson = JSON.parse(fileContent); } catch (e: any) { throw new Error(`Arquivo GeoJSON inválido: ${e.message}`); }
                     if (!isValidGeoJson(parsedGeoJson)) { throw new Error('Arquivo não parece ser GeoJSON válido.'); }

                     // --- Optional: Delete old map document ---
                     const oldMapId = card.mapId; // Store old ID before updating
                     // --- End Optional Delete ---

                     // Save new map data to Firestore 'maps' collection
                     const mapName = `${card.city} - ${card.section} - ${card.cardNumber} (Mapa)`; // Generate name
                     const mapDataToSave: MapDataFirestore = {
                         name: mapName,
                         geojsonData: JSON.stringify(parsedGeoJson), // Store as string
                         createdAt: serverTimestamp(),
                         createdBy: user.uid,
                     };
                     const mapsCollectionRef = collection(db, "congregations", congregationId, "maps");
                     const newMapRef = doc(mapsCollectionRef); // Create new map doc ref

                     // Use a batch JUST for this update (map + card link)
                     const updateBatch = writeBatch(db);
                     updateBatch.set(newMapRef, mapDataToSave); // Save new map doc

                     // Update the card document to link to the new mapId
                     const cardDocRef = doc(db, "congregations", congregationId, "territoryCards", card.id);
                     updateBatch.update(cardDocRef, { mapId: newMapRef.id }); // Link card to new map

                     await updateBatch.commit(); // Commit map save and card update together

                     console.log(`Card ${card.id} updated with new mapId: ${newMapRef.id}`);
                     showMessage({ message: "Sucesso", description: "Mapa do cartão atualizado.", type: "success" });

                     // --- Optional: Attempt to delete old map doc AFTER successful update ---
                     if (oldMapId) {
                         try {
                             // Basic check: See if any OTHER card still uses the old mapId (can be slow/costly)
                             // A better approach might be cloud functions or scheduled cleanup.
                             // For simplicity, we'll just delete it here if no longer referenced by THIS card.
                             // WARNING: This might delete a map still used by another card if not careful.
                             const oldMapRef = doc(db, "congregations", congregationId, "maps", oldMapId);
                             await deleteDoc(oldMapRef);
                             console.log(`Old map document ${oldMapId} deleted.`);
                         } catch (deleteMapError) {
                             console.error(`Failed to delete old map document ${oldMapId}:`, deleteMapError);
                             // Don't block user, just log error.
                         }
                     }
                     // --- End Optional Delete ---

                 } else {
                      console.log("GeoJSON selection cancelled.");
                 }
             } catch (error: any) {
                 console.error(`Error updating map for card ${card.id}:`, error);
                 showMessage({ message: "Erro", description: error.message || "Não foi possível atualizar o mapa.", type: "danger" });
             } finally {
                 setIsPickingFile(false);
                 setUpdatingCardId(null); // Clear loading state for this card
             }
        };

        const [isSharing, setIsSharing] = useState(false); // State to prevent multiple share attempts

        const handleShareCard = async (card: TerritoryCardData) => {
            if (!card || isSharing || updatingCardId || isPickingFile) return;
            setIsSharing(true);
          
            try {
              const hasImage = Boolean(card.imageUrl);
              const hasMap   = Boolean(card.mapId);
              const dialogTitle = `Compartilhar Cartão ${card.cardNumber}`;
              const title       = `Cartão Território ${card.cardNumber}`;
              
              // message é sempre obrigatório, url é opcional
              let message: string;
              let url: string | undefined;
          
              if (hasImage && hasMap) {
                // aqui card.imageUrl! é seguro porque hasImage === true
                message = `Imagem do cartão e mapa disponíveis.\nImagem: ${card.imageUrl!}\n(Mapa disponível no app)`;
                url     = card.imageUrl!;
              } 
              else if (hasImage) {
                message = `Imagem do cartão território ${card.cardNumber}.`;
                url     = card.imageUrl!;
              } 
              else if (hasMap) {
                message = `Mapa para o cartão território ${card.cardNumber} disponível no aplicativo.`;
                url     = undefined;
              } 
              else {
                showMessage({
                  message: "Conteúdo não disponível",
                  description: "Nada para compartilhar para este cartão.",
                  type: "info"
                });
                return;
              }
          
              // Share.share infere o tipo { message: string; url?: string; title?: string }
              await Share.share(
                { title, message, url },
                { dialogTitle }
              );
            } 
            catch (error: any) {
              console.error("Error sharing card:", error);
              showMessage({
                message:    "Erro ao Compartilhar",
                description: error.message ?? "Não foi possível compartilhar o cartão.",
                type:       "danger"
              });
            } 
            finally {
              setIsSharing(false);
            }
          };
        
        // --- Render Card Item ---
        const renderCardItem = ({ item }: { item: TerritoryCardData }) => {
            const isLoadingThisCard = updatingCardId === item.id; // Check if this specific card is being updated
            return (
                <View style={[styles.cardItem, { backgroundColor: colors.backgroundPrimary, borderColor: colors.border }]}>
                    {/* Image Area */}
                    <TouchableOpacity onPress={() => handleViewImage(item.imageUrl)} disabled={!item.imageUrl || isLoadingThisCard} style={styles.imageContainer} >
                        {item.imageUrl ? ( <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" /> )
                        : ( <View style={[styles.cardImagePlaceholder, { backgroundColor: colors.border }]}><Ionicons name="image-outline" size={24} color={colors.textMuted} /></View> )}
                    </TouchableOpacity>

                    {/* Info */}
                    <View style={styles.cardInfo}>
                        <Text style={[styles.cardNumber, { color: colors.textPrimary }]}>{item.cardNumber}</Text>
                        {item.notes && <Text style={[styles.cardNotes, { color: colors.textSecondary }]} numberOfLines={1}>{item.notes}</Text>}
                        <Text style={[styles.cardStatus, { color: item.status === 'Disponível' ? colors.success : (item.status === 'Em uso' ? colors.warning : colors.error) }]}> {item.status} </Text>
                    </View>

                    {/* Actions */}
                    <View style={styles.cardActions}>
                    {!isLoadingThisCard && !isPickingFile && !isSharing && (
                                <TouchableOpacity style={styles.actionButton} onPress={() => handleShareCard(item)} >
                                     <Ionicons name="share-social-outline" size={22} color={colors.textSecondary} /> {/* Using muted color for share */}
                                </TouchableOpacity>
                            )}

                         {/* Loading Indicator for this card */}
                         {isLoadingThisCard && <ActivityIndicator size="small" color={colors.primary} style={styles.cardLoadingIndicator} />}
                         {canManageTerritories && !isLoadingThisCard && (
                             <TouchableOpacity style={styles.actionButton} onPress={() => item.mapId ? handleViewMap(item.mapId) : handleUpdateCardMap(item)} >
                                 <Ionicons name={item.mapId ? "map" : "map-outline"} size={22} color={colors.primary || colors.secondary} />
                                 {/* Optional Text: <Text style={styles.actionButtonText}>{item.mapId ? "Ver Mapa" : "Add Mapa"}</Text> */}
                             </TouchableOpacity>
                         )}

                         {/* Image Button (Add/Change) - Only if can manage */}
                         {canManageTerritories && !isLoadingThisCard && (
                            <TouchableOpacity style={styles.actionButton} onPress={() => handleUpdateCardImage(item)} >
                                <Ionicons name={item.imageUrl ? "image" : "image-outline"} size={22} color={colors.primary || colors.secondary} />
                                {/* Optional Text: <Text style={styles.actionButtonText}>{item.imageUrl ? "Trocar Img" : "Add Img"}</Text> */}
                            </TouchableOpacity>
                         )}

                        {/* Edit/Delete Buttons */}
                        {canManageTerritories && !isLoadingThisCard && (
                            <>
                                <TouchableOpacity style={styles.actionButton} onPress={() => handlePresentRenameCardModal(item)} disabled={isRenamingCard || isDeletingCard}>
                                    <Ionicons name="pencil-outline" size={20} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionButton} onPress={() => confirmDeleteCard(item)} disabled={isRenamingCard || isDeletingCard}>
                                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            );
        };

        return (
            <>
                {/* Main Modal for Section Details */}
                <Modal animationType="slide" transparent={true} visible={isVisible} onRequestClose={handleClose} >
                    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalKeyboardAvoidingView} >
                        <TouchableWithoutFeedback onPress={handleClose}>
                            <View style={styles.modalOverlay} />
                        </TouchableWithoutFeedback>
                        <View style={[styles.modalContentContainer, { backgroundColor: colors.backgroundSecondary }]}>
                            {/* Header & Section Actions */}
                            <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} /></View>
                            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}> Seção: {currentSectionName} </Text>
                            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}> Cidade: {city} </Text>
                            {canManageTerritories && (
                                <View style={styles.sectionActionsContainer}>
                                    <TouchableOpacity style={styles.sectionActionButton} onPress={handlePresentRenameSectionModal} disabled={isRenamingCard || isDeletingCard || isRenamingSection}>
                                        <Ionicons name="pencil" size={16} color={(isRenamingCard || isDeletingCard || isRenamingSection) ? colors.textMuted : colors.primary} />
                                        <Text style={[styles.sectionActionText, { color: (isRenamingCard || isDeletingCard || isRenamingSection) ? colors.textMuted : colors.primary }]}> Renomear Seção</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.sectionActionButton} onPress={handleDeleteSection} disabled={isRenamingCard || isDeletingCard || isRenamingSection}>
                                        <Ionicons name="trash" size={16} color={(isRenamingCard || isDeletingCard || isRenamingSection) ? colors.textMuted : colors.error} />
                                        <Text style={[styles.sectionActionText, { color: (isRenamingCard || isDeletingCard || isRenamingSection) ? colors.textMuted : colors.error }]}> Excluir Seção</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            {/* Card List */}
                            {loading ? ( <ActivityIndicator size="large" color={colors.primary} style={styles.loading} /> )
                            : ( <FlatList data={cards} renderItem={renderCardItem} keyExtractor={(item) => item.id!} style={styles.cardList} contentContainerStyle={styles.cardListContent} ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum cartão nesta seção.</Text>} /> )}
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                {/* --- Other Modals Rendered Outside Main Modal --- */}
                <ConfirmationModal isVisible={isConfirmDeleteCardVisible} onClose={() => setIsConfirmDeleteCardVisible(false)} onConfirm={deleteCard} title="Excluir Cartão" message={`Excluir o cartão "${cardToDelete?.cardNumber}"?`} confirmText="Excluir" confirmButtonStyle="destructive" isConfirming={isDeletingCard} />
                {cardToRename && ( <RenameModal isVisible={isRenameCardModalVisible} onClose={handleDismissRenameCardModal} onSave={handleSaveCardRename} title="Renomear Cartão" label="Novo número/código para" itemNameToRename={cardToRename.cardNumber} initialValue={cardToRename.cardNumber} placeholder="Número/Código do Cartão" isSaving={isRenamingCard} /> )}
                <RenameModal isVisible={isRenameSectionModalVisible} onClose={handleDismissRenameSectionModal} onSave={handleSaveSectionRename} title="Renomear Seção" label={`Novo nome para seção em "${city}"`} itemNameToRename={currentSectionName} initialValue={currentSectionName} placeholder="Nome da Seção" isSaving={isRenamingSection} />
                <Modal animationType="fade" transparent={true} visible={isImageViewerVisible} onRequestClose={handleCloseImageViewer}>
                    <View style={styles.imageViewerContainer}>
                        <TouchableOpacity style={styles.closeButton} onPress={handleCloseImageViewer}>
                            <Ionicons name="close-circle" size={35} color={colors.white} />
                        </TouchableOpacity>
                        {viewingImageUrl && ( <Image source={{ uri: viewingImageUrl }} style={styles.fullScreenImage} resizeMode="contain" /> )}
                    </View>
                </Modal>

                {/* --- Map Viewer Bottom Sheet Component --- */}
                <MapViewerBottomSheet
                    isVisible={isMapViewerVisible}
                    onClose={handleCloseMapView}
                    congregationId={congregationId}
                    mapId={viewingMapId}
                    canManageTerritories={canManageTerritories} // Pass permission down
                />
            </>
        );
    };

    // --- Styles ---
    const screenHeight = Dimensions.get('window').height;
    const screenWidth = Dimensions.get('window').width;
    const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
        modalKeyboardAvoidingView: { flex: 1, justifyContent: 'flex-end' },
        modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
        modalContentContainer: { width: '100%', maxHeight: screenHeight * 0.8, borderTopRightRadius: 20, borderTopLeftRadius: 20, paddingBottom: 20, overflow: 'hidden', backgroundColor: colors.backgroundSecondary },
        modalHeader: { width: '100%', alignItems: 'center', paddingTop: 10, marginBottom: 5 },
        modalHandle: { width: 40, height: 5, borderRadius: 4, backgroundColor: colors.textMuted },
        modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 2, textAlign: 'center', paddingHorizontal: 24, color: colors.textPrimary },
        modalSubtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 15, paddingHorizontal: 24 },
        sectionActionsContainer: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 20, marginBottom: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: 15, },
        sectionActionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 15, marginHorizontal: 10, },
        sectionActionText: { fontSize: 14, fontWeight: '500', marginLeft: 5, },
        loading: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
        cardList: { width: '100%', paddingHorizontal: 20, },
        cardListContent: { paddingBottom: 20, },
        emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16, color: colors.textSecondary },
        cardItem: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 10, borderRadius: 8, borderWidth: 1, backgroundColor: colors.backgroundPrimary, borderColor: colors.border },
        imageContainer: { width: 50, height: 50, marginRight: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border, },
        cardImage: { width: '100%', height: '100%' },
        cardImagePlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', },
        cardInfo: { flex: 1, marginRight: 5, },
        cardNumber: { fontSize: 15, fontWeight: 'bold', marginBottom: 2, color: colors.textPrimary },
        cardNotes: { fontSize: 13, marginBottom: 3, color: colors.textSecondary },
        cardStatus: { fontSize: 12, fontWeight: '500', },
        cardActions: { flexDirection: 'row', alignItems: 'center' },
        actionButton: { padding: 6, marginLeft: 4, }, // Adjusted padding/margin for more buttons
        cardLoadingIndicator: { marginHorizontal: 10, }, // Style for the small loading indicator on the card
        imageViewerContainer: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', alignItems: 'center', },
        closeButton: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, right: 20, zIndex: 1, },
        fullScreenImage: { width: screenWidth * 0.95, height: screenHeight * 0.8, },
        // Optional: Add text labels to action buttons if needed
        // actionButtonText: { fontSize: 10, color: colors.primary, marginTop: 2 },
    });

    export default SectionDetailModal;
