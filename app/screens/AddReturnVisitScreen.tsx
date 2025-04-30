// screens/AddReturnVisitScreen.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ActivityIndicator,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import {
    collection,
    addDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import TopBar from '@/components/Components/TopBar';
import { showMessage } from 'react-native-flash-message';

export default function AddReturnVisitScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { user } = useAuth();
    const navigation = useNavigation();

    const [name, setName] = useState('');
    const [initialNotes, setInitialNotes] = useState(''); // Can be contact info, location, first topic, etc.
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveVisit = async () => {
        if (!user?.uid) {
            showMessage({ message: "Erro", description: "Você precisa estar logado para adicionar revisitas.", type: "danger"});
            return;
        }
        if (!name.trim()) {
            showMessage({ message: "Campo Obrigatório", description: "Por favor, insira o nome da pessoa.", type: "danger"});

            return;
        }

        setIsSaving(true);
        try {
            const visitsRef = collection(db, 'users', user.uid, 'returnVisits');
            await addDoc(visitsRef, {
                name: name.trim(),
                initialNotes: initialNotes.trim(),
                createdAt: serverTimestamp(),
                lastVisitDate: null, // Initialize as null, update when first note is added
                // Add other initial fields if needed, e.g., address, phone
            });

            showMessage({ message: "Sucesso", description: "Revisita adicionada!", type: "success"});
            navigation.goBack(); // Go back to the list screen

        } catch (error) {
            console.error("Erro ao adicionar revisita:", error);
            showMessage({ message: "Erro", description: "Não foi possível salvar a revisita. Tente novamente.", type: "danger"});

        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <TopBar title='Adicionar Revisita' showBackButton={true}/>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoiding}
            >
                <ScrollView contentContainerStyle={styles.container}>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Nome *</Text>
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="Nome da pessoa"
                                placeholderTextColor={colors.textSecondary}
                                autoCapitalize="words"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Notas Iniciais / Contato</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={initialNotes}
                                onChangeText={setInitialNotes}
                                placeholder="Ex: Endereço, telefone, assunto inicial..."
                                placeholderTextColor={colors.textSecondary}
                                multiline
                                numberOfLines={4}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.button, styles.saveButton]}
                            onPress={handleSaveVisit}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <Text style={styles.buttonText}>Salvar Revisita</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.backgroundPrimary,
    },
    keyboardAvoiding: {
        flex: 1,
    },
    container: {
        flexGrow: 1,
        paddingVertical: 28
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 25,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: 5,
        marginRight: 10, // Give some space between button and title
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
        textAlign: 'center',
        flex: 1, // Allow title to take available space
    },
    form: {
        padding: 15,
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 10,
        margin: 12
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: colors.backgroundPrimary,
        color: colors.textPrimary,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 16,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top', // Align text to the top for multiline
        paddingTop: 12,
    },
    button: {
        paddingVertical: 15,
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10, // Space above the button
    },
    saveButton: {
        backgroundColor: colors.primary,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.white,
        textAlign: 'center',
    },
});