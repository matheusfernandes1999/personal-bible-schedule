// screens/RegisterStudySessionScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { DatePickerModal } from '@/components/shared/DatePickerModal'; // Importar o modal de data
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigation } from '@react-navigation/native';
import TopBar from '@/components/Components/TopBar';
import { showMessage } from 'react-native-flash-message';

export default function RegisterStudySessionScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { user } = useAuth();
    const navigation = useNavigation();

    const [studentName, setStudentName] = useState('');
    const [studyDate, setStudyDate] = useState<Date>(new Date()); // Inicia com data atual
    const [subject, setSubject] = useState('');
    const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!user?.uid || !studentName.trim() || !subject.trim()) {
            showMessage({ message: "Campos Vazios", description: "Por favor, preencha o nome do estudante e o assunto estudado.", type: "info"});
            
            return;
        }
        setIsSaving(true);
        try {
            const sessionsRef = collection(db, 'users', user.uid, 'studySessions');
            await addDoc(sessionsRef, {
                name: studentName.trim(),
                date: Timestamp.fromDate(studyDate), // Converte Date para Timestamp
                subject: subject.trim(),
            });
            showMessage({ message: "Sucesso", description: "Sessão de estudo registrada!", type: "success"});
            
            // @ts-ignore
            navigation.goBack(); // Volta para a tela anterior
        } catch (error) {
            console.error("Erro ao registrar sessão de estudo:", error);
            showMessage({ message: "Erro", description: "Não foi possível registrar a sessão.", type: "danger"});
            
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            <TopBar title='Registrar estudo' showBackButton={true} />

            <View style={{padding: 20 }}>
            {/* Input Nome */}
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome do Estudante</Text>
                <TextInput
                    style={styles.input}
                    value={studentName}
                    onChangeText={setStudentName}
                    placeholder="Digite o nome"
                    placeholderTextColor={colors.textSecondary}
                />
            </View>

            {/* Seletor de Data */}
             <View style={styles.inputGroup}>
                <Text style={styles.label}>Data do Estudo</Text>
                <TouchableOpacity onPress={() => setIsDatePickerVisible(true)} style={styles.dateDisplay}>
                     <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} style={{marginRight: 10}} />
                     <Text style={styles.dateText}>{format(studyDate, 'PPP', { locale: ptBR })}</Text>
                 </TouchableOpacity>
            </View>

            {/* Input Assunto */}
             <View style={styles.inputGroup}>
                <Text style={styles.label}>Assunto Estudado / Obs.</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    value={subject}
                    onChangeText={setSubject}
                    placeholder="O que foi considerado?"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                />
            </View>

            {/* Botão Salvar */}
            <TouchableOpacity
                style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={isSaving}
            >
                {isSaving ? (
                    <ActivityIndicator color={colors.white} size="small" />
                ) : (
                    <Text style={styles.buttonText}>Registrar Estudo</Text>
                )}
            </TouchableOpacity>

            {/* Modal de Seleção de Data */}
            <DatePickerModal
                isVisible={isDatePickerVisible}
                onClose={() => setIsDatePickerVisible(false)}
                onDateSelected={(date) => setStudyDate(date)}
                initialDate={studyDate}
                maxDate={new Date()} // Não permite registrar data futura
            />
            </View>
        </View>
    );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
     container: {
        flex: 1,
        backgroundColor: colors.backgroundPrimary,
    },
     title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 30,
        textAlign: 'center',
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
        backgroundColor: colors.backgroundSecondary,
        color: colors.textPrimary,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 16,
    },
     textArea: {
        minHeight: 100,
        textAlignVertical: 'top', // Alinha texto no topo em Android
        paddingTop: 12,
     },
     dateDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
     },
     dateText: {
        fontSize: 16,
        color: colors.textPrimary,
     },
     button: {
        paddingVertical: 15,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    saveButton: {
        // backgroundColor definido inline
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.white,
    },
});