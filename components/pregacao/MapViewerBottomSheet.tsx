    // components/pregacao/MapViewerBottomSheet.tsx
    import React, { useState, useEffect, useRef } from 'react';
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
    } from 'react-native';
    import { useTheme } from '@/context/ThemeContext'; // Adjust path if needed
    import { doc, getDoc, deleteDoc, collection, query, where, writeBatch, getDocs, updateDoc } from 'firebase/firestore'; // Added necessary Firestore functions
    import { db } from '@/lib/firebase'; // Adjust path if needed
    import { Ionicons } from '@expo/vector-icons'; // Assuming Expo Vector Icons
    import MapView, { Geojson, Marker, PROVIDER_GOOGLE, MapPressEvent } from 'react-native-maps';
    import * as Location from 'expo-location';
    import { GeoJsonObject, FeatureCollection } from 'geojson'; // Use specific GeoJSON types
    import { FeatureProperties } from '@/types'; // Adjust path if needed
    import ConfirmationModal from '@/components/common/ConfirmationModal'; // Adjust path as needed
    import { showMessage } from 'react-native-flash-message';

    // Interface for the map data structure in Firestore (maps subcollection)
    interface FetchedMapData {
        name: string;
        geojsonData: string; // Stored as string
        // Add other potential fields like createdBy, createdAt if needed
    }

    // Props for the component
    interface MapViewerBottomSheetProps {
        isVisible: boolean;
        onClose: () => void;
        congregationId: string | null;
        mapId: string | null;          // <<< Changed from 'id' to 'mapId'
        canManageTerritories: boolean; // Permission to delete
    }

    const MapViewerBottomSheet: React.FC<MapViewerBottomSheetProps> = ({
        isVisible,
        onClose,
        congregationId,
        mapId, // <<< Use mapId prop
        canManageTerritories,
    }) => {
        const { colors } = useTheme();
        const styles = createStyles(colors);

        // Component State
        const [mapData, setMapData] = useState<FetchedMapData | null>(null);
        const [parsedGeoJson, setParsedGeoJson] = useState<FeatureCollection | null>(null);
        const [isLoading, setIsLoading] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

        const [selectedFeatureProps, setSelectedFeatureProps] = useState<any | null>(null);

        // State for delete confirmation
        const [isConfirmDeleteVisible, setIsConfirmDeleteVisible] = useState(false);
        const [isDeletingMap, setIsDeletingMap] = useState(false);

        // Fetch Map Data from Firestore 'maps' subcollection
        useEffect(() => {
            // Only fetch if visible and required IDs are present
            if (isVisible && mapId && congregationId) {
                const fetchMapData = async () => {
                    setIsLoading(true);
                    setError(null);
                    setParsedGeoJson(null);
                    setMapData(null);
                    console.log(`MapViewer: Fetching map congregations/${congregationId}/maps/${mapId}`);

                    try {
                        // <<< CORRECTED PATH: Fetch from 'maps' subcollection using mapId >>>
                        const mapDocRef = doc(db, "congregations", congregationId, "maps", mapId);
                        const mapDocSnap = await getDoc(mapDocRef);

                        if (!mapDocSnap.exists()) {
                            throw new Error(`Mapa com ID ${mapId} não encontrado.`);
                        }

                        const fetchedMap = mapDocSnap.data() as FetchedMapData;
                        setMapData(fetchedMap); // Store raw data (name, stringified geojson)

                        // Parse the GeoJSON string
                        try {
                            const parsed = JSON.parse(fetchedMap.geojsonData) as FeatureCollection; // Parse string
                            setParsedGeoJson(parsed); // Store parsed object for MapView
                            console.log("MapViewer: GeoJSON parsed successfully.");
                        } catch (parseError) {
                            console.error("MapViewer: Error parsing GeoJSON string:", parseError);
                            throw new Error("Erro ao processar os dados do mapa (JSON inválido).");
                        }
                    } catch (err: any) {
                        console.error("MapViewer: Error fetching map data:", err);
                        setError(err.message || "Erro ao carregar dados do mapa.");
                    } finally {
                        setIsLoading(false);
                    }
                };

                // Fetch user location (can run in parallel)
                const fetchUserLocation = async () => {
                    try {
                        const { status } = await Location.requestForegroundPermissionsAsync();
                        if (status !== 'granted') {
                            console.warn("MapViewer: Location permission denied.");
                            // Optionally inform user, but don't block map loading
                            // Alert.alert("Permissão negada", "A permissão para acessar a localização foi negada.");
                            return;
                        }
                        const location = await Location.getCurrentPositionAsync({});
                        setUserLocation({
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                        });
                        console.log("MapViewer: User location fetched.");
                    } catch (locationError) {
                        console.error("MapViewer: Error getting location:", locationError);
                        // Don't set main error state for location failure
                    }
                };

                fetchMapData();
                fetchUserLocation();

            } else {
                // Reset state if modal becomes invisible or IDs are missing
                setMapData(null);
                setParsedGeoJson(null);
                setError(null);
                setIsLoading(false);
                setUserLocation(null);
            }
        }, [isVisible, mapId, congregationId]); // Dependencies

        const calculateInitialRegion = (geoJson: FeatureCollection | null) => {
            let region = { latitude: -14.2350, longitude: -51.9253, latitudeDelta: 15, longitudeDelta: 15 };
            if (geoJson && geoJson.features.length > 0) {
                const feature = geoJson.features.find(f => f.geometry);
                if (feature?.geometry?.type === 'Polygon') {
                    const coords = feature.geometry.coordinates[0][0];
                    region = { latitude: coords[1], longitude: coords[0], latitudeDelta: 0.01, longitudeDelta: 0.01 };
                } else if (feature?.geometry?.type === 'Point') {
                    const coords = feature.geometry.coordinates;
                    region = { latitude: coords[1], longitude: coords[0], latitudeDelta: 0.01, longitudeDelta: 0.01 };
                }
            }
            return region;
        };

        // --- Handle Feature Press on Map ---
        const handleFeaturePress = (event: any) => {
            const feature = event?.feature || event?.nativeEvent?.feature; // Handle potential structure differences
            if (feature?.properties) {
                const props = feature.properties as FeatureProperties; // Use defined type
                const id = props.id ?? 'N/A';
                const details = props.details ?? 'Sem detalhes';
                const section = props.section ?? '';
                const color = props.color ?? '';

                let message = `ID: ${id}\nDetalhes: ${details}`;
                if (section) message += `\nSeção: ${section}`;
                if (color) message += `\nCor: ${color}`; // Include color if present

                // Use Alert for simplicity, could be replaced with a custom info display
                if (feature?.properties) {
                    setSelectedFeatureProps(feature.properties);
                }            
            }
        };

        // --- Delete Map Logic ---
        const triggerDeleteConfirmation = () => {
            if (!canManageTerritories || !mapData) return; // Check permission and if map data exists
            setIsConfirmDeleteVisible(true); // Show confirmation modal
        };

        const handleConfirmDeleteMap = async () => {
            if (!canManageTerritories || !mapId || !congregationId) {
                showMessage({ message: "Erro", description: "Não foi possível identificar o mapa ou congregação para exclusão.", type: "danger" });
                return;
            }
            setIsDeletingMap(true);
            console.log(`MapViewer: Attempting to delete map ${mapId} and update cards...`);
            try {
                const batch = writeBatch(db);

                // 1. Reference to the map document to delete
                const mapDocRef = doc(db, "congregations", congregationId, "maps", mapId);
                batch.delete(mapDocRef); // Add delete operation for the map
                console.log(`MapViewer Batch: Added delete operation for map ${mapId}`);

                // 2. Find all territory cards referencing this mapId
                const cardsRef = collection(db, "congregations", congregationId, "territoryCards");
                const q = query(cardsRef, where("mapId", "==", mapId));
                // Execute query outside transaction if possible, otherwise needs to be inside if reads depend on writes
                const cardsSnapshot = await getDocs(q);

                // 3. Add update operations for each referencing card to the batch
                cardsSnapshot.forEach((cardDoc) => {
                    console.log(`MapViewer Batch: Adding update for card ${cardDoc.id} to remove mapId ${mapId}`);
                    batch.update(cardDoc.ref, { mapId: null }); // Set mapId to null
                });
                console.log(`MapViewer Batch: Found ${cardsSnapshot.size} cards to update.`);

                // 4. Commit the batch
                await batch.commit();
                console.log("MapViewer: Batch delete map and update cards successful.");

                showMessage({ message: "Sucesso", description: `Mapa "${mapData?.name || mapId}" excluído.`, type: "success" });
                setIsConfirmDeleteVisible(false); // Close confirmation modal
                onClose(); // Close the map viewer bottom sheet

            } catch (error: any) {
                console.error("MapViewer: Error deleting map:", error);
                showMessage({ message: "Erro ao Excluir", description: error.message || "Não foi possível excluir o mapa e atualizar os cartões.", type: "danger" });
            } finally {
                setIsDeletingMap(false); // Reset loading state
            }
        };

        // --- Render ---
        const mapInitialRegion = calculateInitialRegion(parsedGeoJson);

        return (
            <>
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={isVisible}
                    onRequestClose={onClose} // Allow closing via back button etc.
                >
                    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.mapViewerKeyboardAvoidingView}>
                        {/* Overlay allows closing by tapping outside */}
                        <TouchableWithoutFeedback onPress={onClose}>
                            <View style={styles.mapViewerOverlay} />
                        </TouchableWithoutFeedback>

                        {/* Bottom Sheet Content */}
                        <View style={[styles.mapViewerContentContainer, { backgroundColor: colors.backgroundSecondary }]}>
                            {/* Handle */}
                            <View style={styles.modalHeader}>
                                <View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} />
                            </View>
                            {/* Header with Title, Delete (optional), and Close */}
                            <View style={styles.mapViewerHeader}>
                                {canManageTerritories && (
                                    <TouchableOpacity onPress={triggerDeleteConfirmation} style={styles.mapViewerDeleteButton} disabled={isLoading || isDeletingMap}>
                                        <Ionicons name="trash-outline" size={24} color={isLoading || isDeletingMap ? colors.textMuted : colors.error} />
                                    </TouchableOpacity>
                                )}
                                <Text style={[styles.mapViewerTitle, { color: colors.textPrimary }, !canManageTerritories && styles.mapViewerTitleNoDelete ]} numberOfLines={1}>
                                    {mapData?.name || (isLoading ? 'Carregando...' : 'Mapa')}
                                </Text>
                                <TouchableOpacity onPress={onClose} style={styles.mapViewerCloseButton}>
                                     <Ionicons name="close" size={28} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            {/* Map Area */}
                            <View style={styles.mapContainer}>
                                {isLoading ? (
                                    <ActivityIndicator size="large" color={colors.primary} style={styles.mapLoading} />
                                ) : error ? (
                                    <Text style={[styles.mapErrorText, { color: colors.error }]}>{error}</Text>
                                ) : parsedGeoJson ? (
                                    <MapView
                                        provider={PROVIDER_GOOGLE} // Use Google Maps
                                        style={StyleSheet.absoluteFill} // Map fills container
                                        initialRegion={mapInitialRegion} // Set initial view
                                        showsUserLocation // Show user's location blue dot
                                        showsMyLocationButton // Show button to center on user
                                    >
                                        <Geojson
                                            geojson={parsedGeoJson} // Display the parsed GeoJSON data
                                            strokeColor={colors.primary} // Example styling
                                            fillColor={`${colors.primary}60`} // Example styling with transparency
                                            strokeWidth={2}
                                            tappable={true}
                                            onPress={handleFeaturePress}
                                        />
                                        {/* Optional: Marker for user's current location */}
                                        {userLocation && (
                                            <Marker
                                                coordinate={userLocation}
                                                title="Você está aqui"
                                                pinColor="blue" // Or use a custom marker image
                                            />
                                        )}
                                    </MapView>
                                ) : (
                                    // Handle case where parsing might have failed after fetch
                                    <Text style={[styles.mapErrorText, { color: colors.textSecondary }]}>Não foi possível exibir o mapa.</Text>
                                )}
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                {/* Delete Confirmation Modal */}
                <ConfirmationModal
                    isVisible={isConfirmDeleteVisible}
                    onClose={() => setIsConfirmDeleteVisible(false)}
                    onConfirm={handleConfirmDeleteMap}
                    title="Excluir Mapa"
                    message={`Tem certeza que deseja excluir o mapa "${mapData?.name || mapId}"? Os cartões que usam este mapa perderão a referência.`}
                    confirmText="Excluir Mapa"
                    confirmButtonStyle="destructive"
                    isConfirming={isDeletingMap}
                />

<Modal
                    visible={!!selectedFeatureProps}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setSelectedFeatureProps(null)}
                >
                    <TouchableWithoutFeedback onPress={() => setSelectedFeatureProps(null)}>
                        <View style={styles.modalOverlay} />
                    </TouchableWithoutFeedback>
                    <View style={[styles.bottomSheetModal, { backgroundColor: colors.backgroundSecondary }]}>
                        <View style={styles.modalHeaderFeature}>
                            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Detalhes da Área</Text>
                            <TouchableOpacity onPress={() => setSelectedFeatureProps(null)}>
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalContent}>
                            <Text style={[styles.modalText, { color: colors.textPrimary }]}>ID: {selectedFeatureProps?.id ?? 'N/A'}</Text>
                            {selectedFeatureProps?.section && (
                                <Text style={[styles.modalText, { color: colors.textPrimary }]}>
                                    Seção: {selectedFeatureProps.section}
                                </Text>
                            )}
                            {selectedFeatureProps?.details && (
                                <Text style={[styles.modalText, { color: colors.textPrimary }]}>
                                    Detalhes: {selectedFeatureProps.details}
                                </Text>
                            )}
                            {selectedFeatureProps?.color && (
                                <Text style={[styles.modalText, { color: colors.textPrimary }]}>
                                    Cor: {selectedFeatureProps.color}
                                </Text>
                            )}
                        </View>
                    </View>
                </Modal>
            </>
        );
    };

    // --- Styles ---
    const screenHeight = Dimensions.get('window').height;
    const screenWidth = Dimensions.get('window').width;
    const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
         modalHeader: { width: '100%', alignItems: 'center', paddingTop: 10, marginBottom: 5 },
         modalHandle: { width: 40, height: 5, borderRadius: 4 },
         mapViewerKeyboardAvoidingView: { flex: 1, justifyContent: 'flex-end' },
         mapViewerOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'transparent' },
         mapViewerContentContainer: {
            width: '100%',
            height: screenHeight * 0.75, // Adjusted height slightly
            borderTopRightRadius: 20,
            borderTopLeftRadius: 20,
            overflow: 'hidden',
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            backgroundColor: colors.backgroundSecondary,
         },
         mapViewerHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 15,
            paddingVertical: 8, // Reduced vertical padding
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
         },
         mapViewerTitle: {
            fontSize: 18,
            fontWeight: '600',
            flex: 1,
            textAlign: 'center',
            marginHorizontal: 35, // Space for buttons on both sides
         },
         mapViewerTitleNoDelete: { // Style when delete button is hidden
             marginLeft: 0, // Only need space for close button
             marginRight: 35,
         },
         mapViewerCloseButton: {
             position: 'absolute',
             right: 10,
             top: 4, // Adjust top position relative to header padding
             padding: 5,
             zIndex: 1,
         },
         mapViewerDeleteButton: {
             position: 'absolute',
             left: 10,
             top: 4, // Adjust top position relative to header padding
             padding: 5,
             zIndex: 1,
         },
        mapContainer: {
            flex: 1, // Map takes remaining space
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.border, // Background while loading/error
        },
        mapLoading: {
            // Styles for loading indicator if needed
        },
        mapErrorText: {
            textAlign: 'center',
            padding: 20,
            fontSize: 16,
        },
        modalOverlay: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        bottomSheetModal: {
            padding: 20,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '50%',
        },
        modalHeaderFeature: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
        },
        modalTitle: {
            fontSize: 18,
            fontWeight: '600',
        },
        modalContent: {
            gap: 6,
        },
        modalText: {
            fontSize: 16,
            lineHeight: 22,
        },
    });

    export default MapViewerBottomSheet;