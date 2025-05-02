// app/(tabs)/congregacao.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
  Share, // <<< Importa Share API
  Clipboard, // <<< Importa Clipboard API (ou use expo-clipboard)
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext'; // <<< Importa isAdmin
import { showMessage } from 'react-native-flash-message';
import { collection, addDoc, doc, updateDoc, serverTimestamp, getDoc, DocumentData, writeBatch } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { UserData, CongregationData, MeetingTime, PersonData, ADMIN_CATEGORY } from '@/types';
import { Ionicons } from '@expo/vector-icons'; // Para ícones
import { router } from 'expo-router';

// --- Função para buscar dados completos da congregação ---
const getCongregationData = async (id: string | null): Promise<CongregationData | null> => {
  if (!id) return null;
  try {
    const docRef = doc(db, "congregations", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as CongregationData;
    } else {
      console.warn(`Congregação com ID ${id} não encontrada.`);
      return null;
    }
  } catch (error) {
    console.error("Erro ao buscar dados da congregação:", error);
    throw error;
  }
}

// --- Componente Principal ---
export default function CongregacaoScreen() {
  // --- Hooks e Estados ---
  const { colors } = useTheme();
  // Adiciona isAdmin
  const { logout, user, userData, isAdmin, loading: authLoading, userCategories } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCreatingCongregation, setIsCreatingCongregation] = useState(false);
  const [isUpdatingMeetings, setIsUpdatingMeetings] = useState(false);
  const [newCongregationName, setNewCongregationName] = useState('');
  const [currentCongregation, setCurrentCongregation] = useState<CongregationData | null>(null);
  const [congregationLoading, setCongregationLoading] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isEditMeetingsModalVisible, setIsEditMeetingsModalVisible] = useState(false);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false); // <<< Estado para modal "Entrar"
  const [joinCongregationCode, setJoinCongregationCode] = useState(''); // <<< Estado para código de entrada
  const [isJoiningCongregation, setIsJoiningCongregation] = useState(false); // <<< Loading para entrar

  const [editMidweekDay, setEditMidweekDay] = useState('');
  const [editMidweekTime, setEditMidweekTime] = useState('');
  const [editWeekendDay, setEditWeekendDay] = useState('');
  const [editWeekendTime, setEditWeekendTime] = useState('');

  // --- Efeitos ---
  useEffect(() => {
    const fetchData = async () => {
        if (userData?.congregationId) {
            setCongregationLoading(true);
            try {
                const data = await getCongregationData(userData.congregationId);
                setCurrentCongregation(data);
            } catch (error) {
                showMessage({ message: "Erro", description: "Não foi possível buscar os dados da congregação.", type: "danger" });
                setCurrentCongregation(null);
            } finally {
                setCongregationLoading(false);
            }
        } else {
            setCurrentCongregation(null);
        }
    }
    // Verifica se authLoading terminou E se userData não é undefined (estado inicial do AuthContext)
    if (!authLoading && userData !== undefined) {
        fetchData();
    } else if (!authLoading && userData === null) { // Se auth carregou mas não há userData (caso de signup falho ou usuário sem doc?)
        setCurrentCongregation(null);
    }
  }, [userData?.congregationId, authLoading, userData]);

  // --- Callbacks para Modais ---
  const handlePresentCreateModal = useCallback(() => setIsCreateModalVisible(true), []);
  const handleDismissCreateModal = useCallback(() => setIsCreateModalVisible(false), []);
  const handlePresentEditMeetingsModal = useCallback(() => {
    // Preenche os inputs com os valores atuais
    setEditMidweekDay(currentCongregation?.meetingTimes?.midweek?.day ?? '');
    setEditMidweekTime(currentCongregation?.meetingTimes?.midweek?.time ?? '');
    setEditWeekendDay(currentCongregation?.meetingTimes?.weekend?.day ?? '');
    setEditWeekendTime(currentCongregation?.meetingTimes?.weekend?.time ?? '');
    setIsEditMeetingsModalVisible(true);
  }, [currentCongregation]);

  const handleDismissEditMeetingsModal = useCallback(() => setIsEditMeetingsModalVisible(false), []);

  const handlePresentJoinModal = useCallback(() => setIsJoinModalVisible(true), []); // <<< Callback para abrir modal "Entrar"
 
  const handleDismissJoinModal = useCallback(() => { // <<< Callback para fechar modal "Entrar"
    setIsJoinModalVisible(false);
    setJoinCongregationCode(''); // Limpa o código ao fechar
  }, []);

  // --- Funções de Lógica ---
// --- Funções de Lógica ---
const handleLogout = async () => {
  setIsLoggingOut(true);
  try {
    await logout();
    // O redirecionamento é automático pelo AuthProvider
  } catch (error: any) {
    console.error("Erro ao fazer logout:", error);
    showMessage({ message: "Erro ao Sair", description: error.message || "Não foi possível completar o logout.", type: "danger" });
    setIsLoggingOut(false); // Reseta o loading apenas em caso de erro
  }
};

// --- Criar Congregação (Com adição do Admin) ---
const handleCreateCongregation = async () => {
  if (!newCongregationName.trim()) {
    showMessage({ message: "Nome Inválido", description: "Por favor, insira um nome para a congregação.", type: "warning" });
    return;
  }
  // Verifica se temos user E userData (para pegar o nome e UID)
  if (!user || !userData) {
     showMessage({ message: "Erro", description: "Dados do usuário não carregados ou usuário não autenticado.", type: "danger" });
     return;
  }

  setIsCreatingCongregation(true);
  try {
    // Usar um Write Batch para garantir atomicidade
    const batch = writeBatch(db);

    // 1. Referência para a nova congregação (gera ID automaticamente)
    const newCongregationRef = doc(collection(db, "congregations"));
    const newCongregationId = newCongregationRef.id;

    // 2. Dados da nova congregação
    const initialMeetingTimes = {
        midweek: { day: null, time: null },
        weekend: { day: null, time: null }
    };
    const newCongregationData: Omit<CongregationData, 'id'> = {
      name: newCongregationName.trim(),
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      meetingTimes: initialMeetingTimes,
    };
    // Adiciona a criação da congregação ao batch
    batch.set(newCongregationRef, newCongregationData);
    console.log("Adicionado ao batch: Criação da congregação", newCongregationId);

    // 3. Referência para o documento do usuário criador na subcoleção 'people'
    // Usaremos o UID do usuário como ID do documento na subcoleção 'people' para fácil referência
    const creatorPersonRef = doc(db, "congregations", newCongregationId, "people", user.uid);

    // 4. Dados do usuário criador como 'PersonData'
    const creatorName = userData.name || user.displayName || 'Usuário Criador'; // Pega o nome disponível
    const creatorPersonData: Omit<PersonData, 'id'> = { // Omit 'id' pois estamos usando o UID
        name: creatorName,
        categories: [ADMIN_CATEGORY], // Adiciona a categoria Administrador
        linkedUserId: user.uid, // Vincula ao UID do usuário criador
        createdBy: user.uid, // Marca quem criou este registro de pessoa
        createdAt: serverTimestamp(),
    };
    // Adiciona a criação do registro da pessoa/administrador ao batch
    batch.set(creatorPersonRef, creatorPersonData);
    console.log("Adicionado ao batch: Criação do registro da pessoa/admin para", user.uid);


    // 5. Referência para o documento do usuário na coleção 'users' para atualizar o congregationId
    const userDocRef = doc(db, "users", user.uid);
    // Adiciona a atualização do usuário ao batch
    batch.update(userDocRef, { congregationId: newCongregationId });
    console.log("Adicionado ao batch: Atualização do usuário", user.uid, "com congregationId", newCongregationId);

    // 6. Executa todas as operações no batch
    await batch.commit();
    console.log("Batch commitado com sucesso!");

    // 7. Feedback e fecha modal
    showMessage({ message: "Sucesso!", description: `Congregação "${newCongregationName.trim()}" criada e você foi adicionado como administrador.`, type: "success" });
    handleDismissCreateModal();
    setNewCongregationName('');
    // O AuthContext listener buscará os dados atualizados do usuário e o useEffect recarregará os dados da congregação

  } catch (error: any) {
    console.error("Erro ao criar congregação e adicionar admin:", error);
    showMessage({ message: "Erro ao Criar", description: error.message || "Não foi possível completar a criação da congregação.", type: "danger" });
  } finally {
    setIsCreatingCongregation(false);
  }
};


const handleUpdateMeetingTimes = async () => {
    if (!currentCongregation?.id) {
        showMessage({ message: "Erro", description: "ID da congregação não encontrado.", type: "danger" });
        return;
    }
    if (!editMidweekDay.trim() || !editMidweekTime.trim() || !editWeekendDay.trim() || !editWeekendTime.trim()) {
        showMessage({ message: "Campos Vazios", description: "Preencha todos os dias e horários.", type: "warning"});
        return;
    }

    setIsUpdatingMeetings(true);
    try {
        const congregationDocRef = doc(db, "congregations", currentCongregation.id);
        const updatedMeetingTimes = {
            midweek: { day: editMidweekDay.trim(), time: editMidweekTime.trim() },
            weekend: { day: editWeekendDay.trim(), time: editWeekendTime.trim() }
        };

        await updateDoc(congregationDocRef, {
            meetingTimes: updatedMeetingTimes
        });

        showMessage({ message: "Sucesso", description: "Horários das reuniões atualizados.", type: "success" });
        handleDismissEditMeetingsModal();
        // Atualiza estado local
        setCurrentCongregation(prev => prev ? ({ ...prev, meetingTimes: updatedMeetingTimes }) : null);

    } catch (error: any) {
        console.error("Erro ao atualizar horários:", error);
        showMessage({ message: "Erro ao Atualizar", description: error.message || "Não foi possível salvar os horários.", type: "danger" });
    } finally {
        setIsUpdatingMeetings(false);
    }
};


  // --- Função para Convidar Membros (Mostrar/Copiar Código) ---
  const handleInviteMembers = async () => {
    if (!currentCongregation?.id) return;
    const inviteCode = currentCongregation.id;
    const messageToShare = `Olá! Use este código para entrar na nossa congregação no app Congregation Manager:\n\n${inviteCode}`;

    try {
        // Tenta usar a API de Compartilhamento nativa
        await Share.share({
            message: messageToShare,
            title: `Convite para ${currentCongregation.name}` // Título opcional (iOS)
        });
    } catch (error: any) {
        // Se o compartilhamento falhar (ou for cancelado), mostra um Alert com opção de copiar
        console.warn("Erro ou cancelamento no Share API:", error.message);
        Alert.alert(
            "Código de Convite",
            `Compartilhe este código com quem deseja convidar:\n\n${inviteCode}`,
            [
                { text: "Copiar Código", onPress: () => {
                    Clipboard.setString(inviteCode);
                    showMessage({ message: "Código Copiado!", type: "success"});
                }},
                { text: "OK" }
            ]
        );
    }
  };

  // --- Função para Entrar em Congregação com Código ---
  const handleJoinCongregation = async () => {
    const code = joinCongregationCode.trim();
    if (!code) {
        showMessage({ message: "Código Inválido", description: "Por favor, insira o código da congregação.", type: "warning" });
        return;
    }
    if (!user || !userData) { // Precisa de user e userData (pelo menos o UID)
        showMessage({ message: "Erro", description: "Usuário não autenticado ou dados não carregados.", type: "danger" });
        return;
    }
     if (userData.congregationId) { // Já pertence a uma congregação
        showMessage({ message: "Ação Inválida", description: "Você já pertence a uma congregação.", type: "warning" });
        handleDismissJoinModal();
        return;
    }

    setIsJoiningCongregation(true);
    try {
        // 1. Validar se a congregação existe
        const congDocRef = doc(db, "congregations", code);
        const congDocSnap = await getDoc(congDocRef);
        if (!congDocSnap.exists()) {
            throw new Error("Código da Congregação inválido ou não encontrado.");
        }
        const congregationName = congDocSnap.data()?.name ?? 'Congregação'; // Pega o nome para feedback

        // 2. Usar Batch para atualizar usuário e adicionar à subcoleção people
        const batch = writeBatch(db);

        // 2.1 Atualizar /users/{uid}
        const userDocRef = doc(db, "users", user.uid);
        batch.update(userDocRef, { congregationId: code });
        console.log(`Batch: Atualizando users/${user.uid} com congregationId: ${code}`);

        // 2.2 Adicionar a /congregations/{code}/people/{uid}
        const personDocRef = doc(db, "congregations", code, "people", user.uid);
        const userName = userData.name || user.displayName || 'Novo Membro'; // Usa nome disponível
        const newPersonData: Omit<PersonData, 'id'> = {
            name: userName,
            categories: [], // Sem categorias iniciais ao entrar
            linkedUserId: user.uid, // Vincula automaticamente
            createdBy: user.uid, // Criado por ele mesmo ao entrar
            createdAt: serverTimestamp(),
        };
        batch.set(personDocRef, newPersonData);
        console.log(`Batch: Adicionando ${user.uid} a people da congregação ${code}`);

        // Opcional: Atualizar contagem de membros (idealmente com Cloud Function)

        // 3. Commitar o Batch
        await batch.commit();
        console.log("Batch de entrada na congregação commitado.");

        showMessage({ message: "Sucesso!", description: `Você entrou na congregação "${congregationName}".`, type: "success" });
        handleDismissJoinModal();
        // O AuthContext listener pegará a atualização do usuário

    } catch (error: any) {
        console.error("Erro ao entrar na congregação:", error);
        showMessage({ message: "Erro ao Entrar", description: error.message || "Não foi possível entrar na congregação.", type: "danger" });
    } finally {
        setIsJoiningCongregation(false);
    }
  };


  // --- Função Auxiliar de Renderização ---
  const formatMeetingTime = (meeting: MeetingTime | undefined) => {
    if (meeting?.day && meeting?.time) {
        return `${meeting.day}, ${meeting.time}`;
    }
    return 'Não definido';
};

  // --- Renderização Principal ---
  const styles = createStyles(colors);
  if (authLoading) {
    return (
        <View style={[styles.container, styles.centered, { backgroundColor: colors.backgroundPrimary }]}>
            <ActivityIndicator size="large" color={colors.primary} />
        </View>
    );
}


  const userInitials = userData?.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || 'US';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Seção de Perfil */}
      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{userInitials}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.textPrimary }]}>
            {userData?.name || 'Usuário'}
          </Text>
          <Text style={[styles.profileRole, { color: colors.textSecondary }]}>
            {isAdmin ? 'Administrador' : 'Membro'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.error + '15' }]}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          <Ionicons name="exit-outline" size={20} color={colors.error} />
          {isLoggingOut && <ActivityIndicator size="small" color={colors.error} style={styles.loadingIcon} />}
        </TouchableOpacity>
      </View>

      {/* Seção de Perfil */}
      <View style={[styles.profileCard, {flexDirection: 'column', gap: 8}]}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primaryDark, width: '100%' }]}
          onPress={() => router.push('/screens/achievements')}
        >
          <Ionicons name="flash" size={18} color={colors.white} />
          <Text style={styles.actionButtonText}>Conquistas</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary, width: '100%' }]}
          onPress={() => router.push('/screens/relatorio')}
        >
          <Ionicons name="hourglass-outline" size={18} color={colors.white} />
          <Text style={styles.actionButtonText}>Relatório</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary + '90', width: '100%' }]}
          onPress={() => router.push('/screens/lembretes/notifications')}
        >
          <Ionicons name="notifications" size={18} color={colors.white} />
          <Text style={styles.actionButtonText}>Lembretes</Text>
        </TouchableOpacity>
      </View>

      {/* Seção da Congregação */}
      {currentCongregation ? (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Ionicons name="home" size={24} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Congregação: {currentCongregation.name}
            </Text>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Meio de Semana</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                {formatMeetingTime(currentCongregation.meetingTimes?.midweek)}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Fim de Semana</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                {formatMeetingTime(currentCongregation.meetingTimes?.weekend)}
              </Text>
            </View>
          </View>

          {isAdmin && (
            <View style={styles.adminActions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.warning }]}
                onPress={handlePresentEditMeetingsModal}
              >
                <Ionicons name="pencil-outline" size={18} color={colors.white} />
                <Text style={styles.actionButtonText}>Editar Horários</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.info }]}
                onPress={() => router.push('/screens/pessoas')}
              >
                <Ionicons name="people-outline" size={18} color={colors.white} />
                <Text style={styles.actionButtonText}>Gerenciar Membros</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.success }]}
                onPress={handleInviteMembers}
              >
                <Ionicons name="share-social-outline" size={18} color={colors.white} />
                <Text style={styles.actionButtonText}>Convidar Membros</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="people-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Nenhuma congregação vinculada
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Crie uma nova congregação ou entre com um código existente
          </Text>

          <View style={styles.joinActions}>
            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: colors.primary }]}
              onPress={handlePresentCreateModal}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.white} />
              <Text style={styles.joinButtonText}>Criar Nova Congregação</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: colors.secondary }]}
              onPress={handlePresentJoinModal}
            >
              <Ionicons name="arrow-forward-circle-outline" size={20} color={colors.white} />
              <Text style={styles.joinButtonText}>Entrar com Código</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

        {/* --- Modais --- */}

        {/* Modal CRIAR Congregação (inalterado) */}
        <Modal animationType="slide" transparent={true} visible={isCreateModalVisible} onRequestClose={handleDismissCreateModal} >
             <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalKeyboardAvoidingView} >
              <TouchableWithoutFeedback onPress={handleDismissCreateModal}>
                  <View style={styles.modalOverlay} />
              </TouchableWithoutFeedback>
              <View style={[styles.modalContentContainer, { backgroundColor: colors.backgroundSecondary }]}>
                  <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} /></View>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}> Criar Nova Congregação </Text>
                  <TextInput style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Nome da Congregação" placeholderTextColor={colors.placeholder} value={newCongregationName} onChangeText={setNewCongregationName} />
                  <TouchableOpacity style={[styles.modalButton, { backgroundColor: isCreatingCongregation ? colors.primaryLight : colors.primary, opacity: isCreatingCongregation ? 0.7 : 1, }]} onPress={handleCreateCongregation} disabled={isCreatingCongregation} >
                      {isCreatingCongregation ? ( <ActivityIndicator size="small" color={colors.textOnPrimary} /> ) : ( <Text style={[styles.modalButtonText, { color: colors.textOnPrimary }]}> Salvar Congregação </Text> )}
                  </TouchableOpacity>
              </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Modal EDITAR Horários (inalterado) */}
        <Modal animationType="slide" transparent={true} visible={isEditMeetingsModalVisible} onRequestClose={handleDismissEditMeetingsModal} >
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalKeyboardAvoidingView} >
              <TouchableWithoutFeedback onPress={handleDismissEditMeetingsModal}>
                  <View style={styles.modalOverlay} />
              </TouchableWithoutFeedback>
              <View style={[styles.modalContentContainer, styles.editModalContent, { backgroundColor: colors.backgroundSecondary }]}>
                  <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} /></View>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}> Editar Horários das Reuniões </Text>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Meio de Semana</Text>
                  <View style={styles.inputRow}>
                      <TextInput style={[styles.modalInput, styles.inputHalf, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Dia (ex: Terça)" placeholderTextColor={colors.placeholder} value={editMidweekDay} onChangeText={setEditMidweekDay}/>
                      <TextInput style={[styles.modalInput, styles.inputHalf, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Hora (ex: 19:30)" placeholderTextColor={colors.placeholder} value={editMidweekTime} onChangeText={setEditMidweekTime} keyboardType="numbers-and-punctuation"/>
                  </View>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Fim de Semana</Text>
                  <View style={styles.inputRow}>
                      <TextInput style={[styles.modalInput, styles.inputHalf, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Dia (ex: Sábado)" placeholderTextColor={colors.placeholder} value={editWeekendDay} onChangeText={setEditWeekendDay}/>
                      <TextInput style={[styles.modalInput, styles.inputHalf, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]} placeholder="Hora (ex: 18:00)" placeholderTextColor={colors.placeholder} value={editWeekendTime} onChangeText={setEditWeekendTime} keyboardType="numbers-and-punctuation"/>
                  </View>
                  <TouchableOpacity style={[styles.modalButton, { backgroundColor: isUpdatingMeetings ? colors.primaryLight : colors.primary, opacity: isUpdatingMeetings ? 0.7 : 1, marginTop: 20, }]} onPress={handleUpdateMeetingTimes} disabled={isUpdatingMeetings}>
                      {isUpdatingMeetings ? ( <ActivityIndicator size="small" color={colors.textOnPrimary} /> ) : ( <Text style={[styles.modalButtonText, { color: colors.textOnPrimary }]}> Salvar Horários </Text> )}
                  </TouchableOpacity>
              </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* --- Modal ENTRAR com Código --- */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isJoinModalVisible} // <<< Controlado por isJoinModalVisible
          onRequestClose={handleDismissJoinModal} // <<< Fecha com botão voltar
        >
          <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.modalKeyboardAvoidingView}
          >
              <TouchableWithoutFeedback onPress={handleDismissJoinModal}>
                  <View style={styles.modalOverlay} />
              </TouchableWithoutFeedback>
              <View style={[styles.modalContentContainer, styles.joinModalContent, { backgroundColor: colors.backgroundSecondary }]}>
                  <View style={styles.modalHeader}>
                      <View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} />
                  </View>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                      Entrar em Congregação
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                      Insira o código de convite fornecido pelo administrador.
                  </Text>
                  <TextInput
                      style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                      placeholder="Código da Congregação"
                      placeholderTextColor={colors.placeholder}
                      value={joinCongregationCode}
                      onChangeText={setJoinCongregationCode}
                      autoCapitalize="none"
                      autoCorrect={false}
                  />
                  <TouchableOpacity
                      style={[styles.modalButton, {
                          backgroundColor: isJoiningCongregation ? colors.primaryLight : colors.primary,
                          opacity: isJoiningCongregation ? 0.7 : 1,
                          marginTop: 10,
                      }]}
                      onPress={handleJoinCongregation}
                      disabled={isJoiningCongregation}
                  >
                      {isJoiningCongregation ? (
                          <ActivityIndicator size="small" color={colors.textOnPrimary} />
                      ) : (
                          <Text style={[styles.modalButtonText, { color: colors.textOnPrimary }]}>
                              Entrar na Congregação
                          </Text>
                      )}
                  </TouchableOpacity>
              </View>
          </KeyboardAvoidingView>
        </Modal>

      </ScrollView>
  );
}
const shadowStyle = (colors: any) => ({
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 4,
});
const screenHeight = Dimensions.get('window').height;
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...shadowStyle(colors),
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    opacity: 0.8,
  },
  logoutButton: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  loadingIcon: {
    marginLeft: 8,
  },
  sectionContainer: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
    ...shadowStyle(colors),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoItem: {
    width: '48%',
    backgroundColor: colors.backgroundPrimary,
    borderRadius: 12,
    padding: 16,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  adminActions: {
    marginTop: 16,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 12,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.white,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    ...shadowStyle(colors),
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  joinActions: {
    width: '100%',
    gap: 12,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.white,
  },
  modalHeader: { width: '100%', alignItems: 'center', marginBottom: 15, },
  modalHandle: { width: 40, height: 5, borderRadius: 4, },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, textAlign: 'center', },
  modalSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20, }, // <<< Estilo para subtítulo do modal
  modalInput: { height: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, fontSize: 16, marginBottom: 20, width: '100%', },
  inputLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 5, alignSelf: 'flex-start', width: '100%', },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 15, },
  inputHalf: { width: '48%', marginBottom: 0, },
  modalButton: { height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center', width: '100%', },
  modalButtonText: { fontSize: 16, fontWeight: 'bold', },


 
  centered: { justifyContent: 'center', alignItems: 'center', },
  content: { paddingVertical: 8, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', },
  subtitle: { fontSize: 16, textAlign: 'center' },
  infoBox: { width: '90%', backgroundColor: colors.backgroundSecondary, padding: 20, borderRadius: 8, alignItems: 'center', shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, },
  meetingTimesContainer: { width: '100%', marginTop: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 15, },
  meetingLabel: { fontSize: 14, color: colors.textSecondary, },
  meetingValue: { fontSize: 16, color: colors.textPrimary, marginBottom: 5, fontWeight: '500', },
  actionContainer: { width: '90%', alignItems: 'center', marginBottom: 30, },
   logoutButtonText: { fontSize: 16, fontWeight: 'bold', },
  modalKeyboardAvoidingView: { flex: 1, justifyContent: 'flex-end', },
  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', },
  modalContentContainer: { width: '100%', borderTopRightRadius: 20, borderTopLeftRadius: 20, paddingHorizontal: 24, paddingBottom: 30, paddingTop: 10, alignItems: 'center', },
  editModalContent: { minHeight: screenHeight * 0.5, maxHeight: screenHeight * 0.7, },
  joinModalContent: {
      minHeight: screenHeight * 0.35,
      maxHeight: screenHeight * 0.5,
  },
});
