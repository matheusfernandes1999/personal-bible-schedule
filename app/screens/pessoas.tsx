// app/(tabs)/pessoas.tsx
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
  FlatList,
  Alert,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { showMessage } from 'react-native-flash-message';
import {
    collection,
    addDoc,
    doc,
    updateDoc,
    serverTimestamp,
    query,
    onSnapshot,
    Unsubscribe,
    writeBatch, // <<< Importa writeBatch
    getDoc, // <<< Importa getDoc para validar se o usuário existe (opcional)
} from "firebase/firestore";
import { db } from '@/lib/firebase';
import { PersonData, CATEGORIES_LIST } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import TopBar from '@/components/Components/TopBar';

export default function PessoasScreen() {
  // --- Hooks e Estados ---
  const { colors } = useTheme();
  const { user, userData, isAdmin, loading: authLoading } = useAuth();

  const [peopleList, setPeopleList] = useState<PersonData[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonData | null>(null);
  const [personName, setPersonName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSavingPerson, setIsSavingPerson] = useState(false);
  const [isLinkModalVisible, setIsLinkModalVisible] = useState(false);
  const [linkingPerson, setLinkingPerson] = useState<PersonData | null>(null);
  const [linkUserIdInput, setLinkUserIdInput] = useState('');
  const [isLinkingUser, setIsLinkingUser] = useState(false);

  // --- Fetch Pessoas ---
  useEffect(() => {
    if (authLoading || !userData?.congregationId) {
        setPeopleLoading(false);
        setPeopleList([]);
        return;
    }
    setPeopleLoading(true);
    const congregationId = userData.congregationId;
    const peopleSubColRef = collection(db, "congregations", congregationId, "people");
    const q = query(peopleSubColRef);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedPeople: PersonData[] = [];
      querySnapshot.forEach((doc) => {
        fetchedPeople.push({ id: doc.id, ...doc.data() } as PersonData);
      });
      setPeopleList(fetchedPeople.sort((a, b) => a.name.localeCompare(b.name)));
      setPeopleLoading(false);
    }, (error) => {
      console.error("Erro ao buscar pessoas:", error);
      showMessage({ message: "Erro", description: "Não foi possível carregar a lista de pessoas.", type: "danger" });
      setPeopleLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.congregationId, authLoading, userData]);


  // --- Funções do Modal de Criação/Edição ---
  const handlePresentEditModal = useCallback((person: PersonData | null = null) => {
    if (person) {
      setEditingPerson(person);
      setPersonName(person.name);
      setSelectedCategories(person.categories || []);
    } else {
      setEditingPerson(null);
      setPersonName('');
      setSelectedCategories([]);
    }
    setIsEditModalVisible(true);
  }, []);

  const handleDismissEditModal = useCallback(() => {
    setIsEditModalVisible(false);
    setEditingPerson(null);
  }, []);

  const handleToggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleSavePerson = async () => {
    if (!personName.trim()) { /* ... */ return; }
    if (!user || !userData?.congregationId) { /* ... */ return; }

    setIsSavingPerson(true);
    const congregationId = userData.congregationId;

    try {
      if (editingPerson && editingPerson.id) { // Edição
        const personDocRef = doc(db, "congregations", congregationId, "people", editingPerson.id);
        await updateDoc(personDocRef, {
          name: personName.trim(),
          categories: selectedCategories,
        });
        showMessage({ message: "Sucesso!", description: `"${personName.trim()}" atualizado(a).`, type: "success" });
      } else { // Criação
        const peopleSubColRef = collection(db, "congregations", congregationId, "people");
        const newPersonData: Omit<PersonData, 'id'> = {
          name: personName.trim(),
          categories: selectedCategories,
          linkedUserId: null,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        };
        await addDoc(peopleSubColRef, newPersonData);
        showMessage({ message: "Sucesso!", description: `"${personName.trim()}" adicionado(a).`, type: "success" });
      }
      handleDismissEditModal();
    } catch (error: any) { /* ... */ }
    finally { setIsSavingPerson(false); }
  };

  // --- Funções do Modal de Vinculação (ATUALIZADO) ---
  const handlePresentLinkModal = useCallback((person: PersonData) => {
    setLinkingPerson(person);
    setLinkUserIdInput('');
    setIsLinkModalVisible(true);
  }, []);

  const handleDismissLinkModal = useCallback(() => {
    setIsLinkModalVisible(false);
    setLinkingPerson(null);
  }, []);

  const handleLinkUser = async () => {
      const userIdToLink = linkUserIdInput.trim();
      if (!userIdToLink) {
          showMessage({ message: "ID Inválido", description: "Insira o ID do usuário.", type: "warning" });
          return;
      }
      // Verifica se temos a pessoa a ser vinculada e o ID da congregação atual
      if (!linkingPerson?.id || !userData?.congregationId) {
          showMessage({ message: "Erro", description: "Não foi possível identificar a pessoa ou congregação.", type: "danger"});
          return;
      }
       // Verifica se o ID inserido não é o mesmo do usuário já vinculado (se houver)
      if (linkingPerson.linkedUserId === userIdToLink) {
          showMessage({ message: "Já Vinculado", description: "Esta pessoa já está vinculada a este ID de usuário.", type: "info"});
          return;
      }

      setIsLinkingUser(true);
      const congregationId = userData.congregationId;
      const personId = linkingPerson.id;

      try {
          // Opcional: Validar se o usuário com userIdToLink existe na coleção /users
          const userToLinkRef = doc(db, "users", userIdToLink);
          const userToLinkSnap = await getDoc(userToLinkRef);
          if (!userToLinkSnap.exists()) {
              throw new Error(`Usuário com ID ${userIdToLink.substring(0,8)}... não encontrado.`);
          }
          // Opcional: Verificar se o usuário a ser vinculado já não pertence a outra congregação
          const userToLinkData = userToLinkSnap.data();
          if (userToLinkData?.congregationId && userToLinkData.congregationId !== congregationId) {
              throw new Error(`Este usuário já pertence a outra congregação (${userToLinkData.congregationId.substring(0,5)}...).`);
          }

          // --- Início do Batch ---
          const batch = writeBatch(db);

          // 1. Atualiza o documento da pessoa na subcoleção people
          const personDocRef = doc(db, "congregations", congregationId, "people", personId);
          batch.update(personDocRef, {
              linkedUserId: userIdToLink
          });
          console.log(`Batch: Atualizando people/${personId} com linkedUserId: ${userIdToLink}`);

          // 2. Atualiza o documento do usuário na coleção users
          // (userToLinkRef já foi definido acima para validação)
          batch.update(userToLinkRef, {
              congregationId: congregationId
          });
          console.log(`Batch: Atualizando users/${userIdToLink} com congregationId: ${congregationId}`);

          // 3. Commita o batch
          await batch.commit();
          console.log("Batch de vinculação commitado.");
          // --- Fim do Batch ---

          showMessage({ message: "Sucesso", description: `${linkingPerson.name} vinculado(a) com sucesso!`, type: "success" });
          handleDismissLinkModal();

      } catch (error: any) {
          console.error("Erro ao vincular usuário:", error);
          showMessage({ message: "Erro ao Vincular", description: error.message || "Não foi possível vincular o usuário.", type: "danger" });
      } finally {
          setIsLinkingUser(false);
      }
  };
  const styles = createStyles(colors);

  if (authLoading) { /* ... loading auth ... */ }
  if (!userData?.congregationId && !authLoading) { /* ... sem congregação ... */ }

  const renderCategoryItem = ({ item }: { item: string }) => {
    const isSelected = selectedCategories.includes(item);
    return (
      <TouchableOpacity
        style={[
          styles.categoryItem, 
          { 
            backgroundColor: isSelected ? colors.primary + '15' : colors.backgroundPrimary,
            borderColor: isSelected ? colors.primary : colors.border 
          }
        ]}
        onPress={() => handleToggleCategory(item)}
      >
        <Ionicons 
          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'} 
          size={20} 
          color={isSelected ? colors.primary : colors.textSecondary} 
        />
        <Text style={[styles.categoryText, { color: colors.textPrimary }]}>
          {item}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderPersonItem = ({ item }: { item: PersonData }) => {
    const initials = item.name.split(' ').map(n => n[0]).join('').substring(0, 2);
    return (
      <TouchableOpacity
        style={[styles.personCard, { backgroundColor: colors.backgroundSecondary }]}
        onPress={isAdmin ? () => handlePresentEditModal(item) : undefined}
      >
        <View style={styles.personHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {initials}
            </Text>
          </View>
          <Text style={[styles.personName, { color: colors.textPrimary }]}>
            {item.name}
          </Text>
          {item.linkedUserId && (
            <Ionicons name="link" size={20} color={colors.success} />
          )}
        </View>

        {item.categories?.length > 0 && (
          <View style={styles.categoryContainer}>
            {item.categories.slice(0, 3).map(category => (
              <View key={category} style={[styles.categoryPill, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.categoryLabel, { color: colors.primary }]}>
                  {category}
                </Text>
              </View>
            ))}
            {item.categories.length > 3 && (
              <Text style={[styles.moreCategories, { color: colors.textSecondary }]}>
                +{item.categories.length - 3}
              </Text>
            )}
          </View>
        )}

        {!item.linkedUserId && isAdmin && (
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={(e) => {
              e.stopPropagation();
              handlePresentLinkModal(item);
            }}
          >
            <Text style={[styles.linkButtonText, { color: colors.primary }]}>
              Vincular Usuário
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}>
      <TopBar title='Pessoas' showBackButton={true} />
      
      {isAdmin && (
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => handlePresentEditModal(null)}
        >
          <Ionicons name="person-add" size={24} color={colors.white} />
          <Text style={styles.addButtonText}>Nova Pessoa</Text>
        </TouchableOpacity>
      )}

      {/* List */}
      {peopleLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : peopleList.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Nenhuma pessoa cadastrada
          </Text>
        </View>
      ) : (
        <FlatList 
          data={peopleList}
          renderItem={renderPersonItem}
          keyExtractor={(item) => item.id ?? item.name}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isEditModalVisible}
        onRequestClose={handleDismissEditModal}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"} 
          style={styles.modalContainer}
        >
          <TouchableWithoutFeedback onPress={handleDismissEditModal}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>
          
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} />
            </View>
            
            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {editingPerson ? 'Editar Pessoa' : 'Nova Pessoa'}
              </Text>

              <TextInput
                style={[styles.input, { 
                  backgroundColor: colors.backgroundPrimary,
                  color: colors.textPrimary,
                  borderColor: colors.border
                }]}
                placeholder="Nome completo"
                placeholderTextColor={colors.textSecondary}
                value={personName}
                onChangeText={setPersonName}
              />

              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Categorias
              </Text>

              <FlatList
                data={CATEGORIES_LIST}
                renderItem={renderCategoryItem}
                numColumns={2}
                columnWrapperStyle={styles.categoryGrid}
                scrollEnabled={false}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSavePerson}
              disabled={isSavingPerson}
            >
              {isSavingPerson ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.saveButtonText}>
                  {editingPerson ? 'Salvar Alterações' : 'Criar Pessoa'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Link Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isLinkModalVisible}
        onRequestClose={handleDismissLinkModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <TouchableWithoutFeedback onPress={handleDismissLinkModal}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>

          <View style={[styles.modalContent, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} />
            </View>

            <View style={styles.modalScrollContent}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Vincular Usuário
              </Text>

              <Text style={[styles.linkDescription, { color: colors.textSecondary }]}>
                Vincular {linkingPerson?.name} a uma conta existente
              </Text>

              <TextInput
                style={[styles.input, {
                  backgroundColor: colors.backgroundPrimary,
                  color: colors.textPrimary,
                  borderColor: colors.border
                }]}
                placeholder="ID do usuário"
                placeholderTextColor={colors.textSecondary}
                value={linkUserIdInput}
                onChangeText={setLinkUserIdInput}
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleLinkUser}
                disabled={isLinkingUser}
              >
                {isLinkingUser ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Vincular</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// Enhanced Styles
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },

  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  personCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryPill: {
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  moreCategories: {
    fontSize: 12,
    alignSelf: 'center',
  },
  linkButton: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 12,
    alignItems: 'center',
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    paddingTop: 16,
    alignItems: 'center',
  },
  modalHandle: {
    width: 48,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  categoryGrid: {
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 24,
  },
  categoryItem: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  linkDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
});