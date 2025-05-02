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
    Alert,
    Animated,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Geojson, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import type { FeatureCollection } from 'geojson';

interface FetchedMapData {
    name: string;
    geojsonData: string;
}

interface MapViewerBottomSheetProps {
    isVisible: boolean;
    onClose: () => void;
    congregationId: string | null;
    id: string | null;
}

const MapViewerBottomSheet: React.FC<MapViewerBottomSheetProps> = ({
    isVisible,
    onClose,
    congregationId,
    id,
}) => {
    const { colors } = useTheme();
    const styles = createStyles(colors);

    const [mapData, setMapData] = useState<FetchedMapData | null>(null);
    const [parsedGeoJson, setParsedGeoJson] = useState<FeatureCollection | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [selectedFeatureProps, setSelectedFeatureProps] = useState<any | null>(null);

    const slideAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isVisible && id && congregationId) {
            const fetchMapData = async () => {
                setIsLoading(true);
                setError(null);
                setParsedGeoJson(null);
                setMapData(null);

                try {
                    const mapDocRef = doc(db, "congregations", congregationId, "territoryCards", id);
                    const mapDocSnap = await getDoc(mapDocRef);

                    if (!mapDocSnap.exists()) throw new Error(`Mapa com ID ${id} não encontrado.`);

                    const fetchedMap = mapDocSnap.data() as FetchedMapData;
                    setMapData(fetchedMap);

                    try {
                        const parsed = JSON.parse(fetchedMap.geojsonData) as FeatureCollection;
                        setParsedGeoJson(parsed);
                    } catch {
                        throw new Error("Erro ao processar os dados do mapa (JSON inválido).");
                    }
                } catch (err: any) {
                    setError(err.message || "Erro ao carregar dados do mapa.");
                } finally {
                    setIsLoading(false);
                }
            };

            const fetchUserLocation = async () => {
                try {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== 'granted') {
                        Alert.alert("Permissão negada", "A permissão para acessar a localização foi negada.");
                        return;
                    }
                    const location = await Location.getCurrentPositionAsync({});
                    setUserLocation({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                    });
                } catch (locationError) {
                    console.error("Erro ao obter localização:", locationError);
                }
            };

            fetchMapData();
            fetchUserLocation();
        } else {
            setMapData(null);
            setParsedGeoJson(null);
            setError(null);
            setIsLoading(false);
            setShowDetails(false);
        }
    }, [isVisible, id, congregationId]);

    useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: showDetails ? 1 : 0,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [showDetails]);

    const interpolateHeight = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 100], // altura da área de detalhes
    });

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

    const handleFeaturePress = (event: any) => {
        const feature = event?.feature || event?.nativeEvent?.feature;
        if (feature?.properties) {
            setSelectedFeatureProps(feature.properties);
        }
    };

    const mapInitialRegion = calculateInitialRegion(parsedGeoJson);

    return (
        <Modal animationType="slide" transparent={true} visible={isVisible} onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.mapViewerKeyboardAvoidingView}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={styles.mapViewerOverlay} />
                </TouchableWithoutFeedback>

                <View style={[styles.mapViewerContentContainer, { backgroundColor: colors.backgroundSecondary }]}>
                    <View style={styles.modalHeader}>
                        <View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} />
                    </View>
                    <View style={styles.mapViewerHeader}>
                        <Text style={[styles.mapViewerTitle, { color: colors.textPrimary }]}>
                            Mapa: {mapData?.name || (isLoading ? 'Carregando...' : 'Indisponível')}
                        </Text>
                        <TouchableOpacity onPress={() => setShowDetails(prev => !prev)} style={styles.mapViewerToggleButton}>
                            <Ionicons name="chevron-down" size={28} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Animated.View style={[styles.detailsContainer, { height: interpolateHeight }]}>
                        {mapData && (
                            <Text style={[styles.mapDetailsText, { color: colors.textSecondary }]}>
                                Dados GeoJSON: {parsedGeoJson?.features.length} áreas
                            </Text>
                        )}
                    </Animated.View>

                    <View style={styles.mapContainer}>
                        {isLoading ? (
                            <ActivityIndicator size="large" color={colors.primary} />
                        ) : error ? (
                            <Text style={[styles.mapErrorText, { color: colors.error }]}>{error}</Text>
                        ) : parsedGeoJson ? (
                            <MapView
                                provider={PROVIDER_GOOGLE}
                                style={StyleSheet.absoluteFill}
                                initialRegion={mapInitialRegion}
                                showsUserLocation
                                showsMyLocationButton
                            >
                                <Geojson
                                    geojson={parsedGeoJson}
                                    strokeColor={colors.primary}
                                    fillColor={`${colors.primary}60`}
                                    strokeWidth={2}
                                    tappable={true}
                                    onPress={handleFeaturePress}
                                />
                                {userLocation && (
                                    <Marker
                                        coordinate={userLocation}
                                        title="Você está aqui"
                                        description="Sua localização atual"
                                        pinColor="blue"
                                    />
                                )}
                            </MapView>
                        ) : (
                            <Text style={[styles.mapErrorText, { color: colors.textSecondary }]}>Não foi possível exibir o mapa.</Text>
                        )}
                    </View>
                </View>

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


            </KeyboardAvoidingView>
        </Modal>
    );
};

const screenHeight = Dimensions.get('window').height;
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
    modalHeader: { width: '100%', alignItems: 'center', paddingTop: 10, marginBottom: 5 },
    modalHandle: { width: 40, height: 5, borderRadius: 4 },
    mapViewerKeyboardAvoidingView: { flex: 1, justifyContent: 'flex-end' },
    mapViewerOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'transparent' },
    mapViewerContentContainer: {
        width: '100%',
        height: screenHeight * 0.9,
        borderTopRightRadius: 20,
        borderTopLeftRadius: 20,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    mapViewerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingBottom: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    mapViewerTitle: {
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
    },
    mapViewerToggleButton: {
        padding: 5,
        zIndex: 1,
    },
    detailsContainer: {
        paddingHorizontal: 15,
        overflow: 'hidden',
        justifyContent: 'center',
    },
    mapDetailsText: {
        fontSize: 14,
    },
    mapContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.border,
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
