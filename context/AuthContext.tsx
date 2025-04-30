// context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
} from 'react';
import { useRouter, useSegments } from 'expo-router';
import {
  User as FirebaseUser, // Renomeado para clareza
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
    doc,
    getDoc, // Para validar congregationId e buscar dados de pessoa
    setDoc,
    onSnapshot, // Para escutar mudanças
    Unsubscribe,
    DocumentData,
    serverTimestamp, // Para timestamps
    writeBatch, // Para operações atômicas
    collection,
    where,
    query, // Para referenciar coleções/subcoleções
} from "firebase/firestore";
import { auth, db } from '../lib/firebase'; // Importa instâncias do Firebase

// Importa os tipos centralizados
import { UserData, AuthContextData, PersonData, ADMIN_CATEGORY, LoginCredentials, SignupCredentials } from '@/types';

// --- Contexto ---
// Usa o tipo importado AuthContextData
const AuthContext = createContext<AuthContextData | undefined>(undefined);

// --- Hook Customizado ---
// Retorna o tipo importado AuthContextData
export const useAuth = (): AuthContextData => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

// --- Provedor ---
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // --- Estados do Contexto ---
  const [user, setUser] = useState<FirebaseUser | null>(null); // Usuário do Firebase Auth
  const [userData, setUserData] = useState<UserData | null>(null); // Dados do Firestore (/users/{uid})
  const [isAdmin, setIsAdmin] = useState<boolean>(false); // Estado para admin
  const [userCategories, setUserCategories] = useState<string[] | null>(null); // Estado para categorias do usuário
  const [loading, setLoading] = useState(true); // Estado de carregamento inicial

  // Hooks de Navegação
  const router = useRouter();
  const segments = useSegments();

  // --- Efeito Principal (Monitora Auth e UserData) ---
  useEffect(() => {
    let unsubscribeUserDoc: Unsubscribe | null = null; // Listener para /users/{uid}

    // Listener do Firebase Auth
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      console.log('Auth State Changed:', currentUser?.uid);
      setUser(currentUser); // Atualiza o usuário Auth

      // Limpa listener do UserDoc anterior
      if (unsubscribeUserDoc) {
         console.log('Limpando listener UserDoc anterior.');
         unsubscribeUserDoc();
         unsubscribeUserDoc = null;
      }
      // Limpa isAdmin e userCategories ao deslogar ou mudar de usuário
      setIsAdmin(false);
      setUserCategories(null);

      // Se o usuário deslogou
      if (!currentUser) {
        console.log('Usuário deslogado, limpando userData.');
        setUserData(null);
        setLoading(false); // Termina o loading no logout
        return;
      }

      // --- Usuário logado: Configura listener para /users/{uid} ---
      console.log(`Usuário logado (${currentUser.uid}), buscando/escutando /users/${currentUser.uid}...`);
      const userDocRef = doc(db, "users", currentUser.uid);

      unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
          let fetchedUserData: UserData | null = null;
          if (docSnap.exists()) {
              const data = docSnap.data() as DocumentData;
              fetchedUserData = {
                  uid: currentUser.uid,
                  name: data.name ?? currentUser.displayName ?? null,
                  email: data.email ?? currentUser.email ?? null,
                  congregationId: data.congregationId ?? null,
                  createdAt: data.createdAt,
              };
              console.log("Dados /users atualizados:", fetchedUserData);
          } else {
              // Documento não encontrado
              console.warn(`Documento /users/${currentUser.uid} não encontrado.`);
              fetchedUserData = { // Cria objeto parcial
                   uid: currentUser.uid,
                   name: currentUser.displayName ?? null,
                   email: currentUser.email ?? null,
                   congregationId: null,
              };
          }
          setUserData(fetchedUserData); // Atualiza userData

          // Define loading principal como false após obter o primeiro snapshot de /users
          if (loading) {
              setLoading(false);
          }
      }, (error) => {
          // Erro ao escutar /users
          console.error("Erro ao escutar /users:", error);
          setUserData(null);
          setIsAdmin(false);
          setUserCategories(null); // Limpa categorias no erro
          setLoading(false); // Termina o loading
      });
    });

    // Função de limpeza do listener do Auth
    return () => {
        console.log("Desmontando AuthProvider, limpando listener Auth.");
        unsubscribeAuth();
        // O listener de userDoc será limpo quando o usuário mudar ou deslogar
        // O listener de personDoc será limpo pelo outro useEffect
    };
  }, []); // Roda só na montagem

  // --- Efeito Secundário (Monitora status Admin e Categorias em /people) ---
  useEffect(() => {
    let unsubscribePersonQuery: Unsubscribe | null = null; // <<< Mudou nome da variável

      // Só executa se tivermos usuário E um congregationId nos dados do usuário
      if (user && userData?.congregationId) {
          const congregationId = userData.congregationId;
          const userId = user.uid; // UID do usuário logado
          console.log(`Verificando/Escutando status/categorias para ${userId} em /congregations/${congregationId}/people/${userId}...`);

          // Referência ao documento da pessoa na subcoleção (usando UID como ID)
          const peopleSubColRef = collection(db, "congregations", congregationId, "people");
          // 2. Cria a query para encontrar o documento onde linkedUserId == userId
          const q = query(peopleSubColRef, where("linkedUserId", "==", userId)); // <<< Query por linkedUserId
          unsubscribePersonQuery = onSnapshot(q, (querySnapshot) => {
            if (!querySnapshot.empty) {
                // Pega o primeiro documento encontrado (deve haver apenas um)
                const personDocSnap = querySnapshot.docs[0];
                const personData = personDocSnap.data() as DocumentData;
                const categories = (Array.isArray(personData.categories) ? personData.categories : []) as string[];
                const hasAdminCategory = categories.includes(ADMIN_CATEGORY);

                console.log(`AuthContext: Documento encontrado para linkedUserId=${userId} (ID: ${personDocSnap.id}). Categorias:`, categories);
                setIsAdmin(hasAdminCategory);
                setUserCategories(categories);

            } else {
                // Nenhum documento encontrado com o linkedUserId correspondente
                console.warn(`AuthContext: Nenhum documento /people encontrado com linkedUserId=${userId} na congregação ${congregationId}. Definindo isAdmin/Categorias como padrão.`);
                setIsAdmin(false);
                setUserCategories([]); // Define como array vazio
            }
        }, (error) => {
            // Erro ao escutar a query
            console.error(`AuthContext: Erro ao escutar query por linkedUserId=${userId}:`, error);
            setIsAdmin(false);
            setUserCategories(null); // Define como null no erro
        });

    } else {
        // Se não tem usuário ou congregationId, reseta isAdmin e userCategories
        if (isAdmin) setIsAdmin(false);
        if (userCategories !== null) setUserCategories(null);
    }

    // Função de limpeza para o listener da query
    return () => {
        if (unsubscribePersonQuery) {
            console.log("AuthContext: Limpando listener PersonQuery.");
            unsubscribePersonQuery();
        }
    };
// Depende do UID do usuário e do congregationId
}, [user, userData?.congregationId]);// Dependências corretas


  // --- Efeito para Redirecionamento ---
  useEffect(() => {
    // Só redireciona após o loading inicial terminar
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)'; // Rota atual está no grupo (auth)?

    // Se não tem usuário logado E não está no grupo de autenticação -> vai para auth
    if (!user && !inAuthGroup) {
      console.log('Redirect: Usuário não logado, indo para /auth');
      router.replace('/(auth)');
    }
    // Se tem usuário logado E está no grupo de autenticação -> vai para as abas
    else if (user && inAuthGroup) {
       console.log('Redirect: Usuário logado, indo para /tabs');
       router.replace('/(tabs)/congregacao');
    }
  }, [user, loading, segments, router]); // Dependências corretas

  // --- Funções de Autenticação ---

  // Função de Login
  const login = async ({ email, password }: LoginCredentials): Promise<void> => {
    if (!email || !password) {
        throw new Error("Email e senha são obrigatórios.");
    }
    await signInWithEmailAndPassword(auth, email, password);
    // Redirecionamento tratado pelo useEffect
  };

  // Função de Signup (com validação de código e adição à subcoleção)
  const signup = async ({ name, email, password, congregationId }: SignupCredentials): Promise<void> => {
     if (!name || !email || !password) {
        throw new Error("Nome, email e senha são obrigatórios.");
     }

     let validatedCongregationId: string | null = null;

     // 1. Valida o congregationId (se fornecido)
     if (congregationId && congregationId.trim()) {
         const trimmedCongregationId = congregationId.trim();
         console.log("Validando congregationId:", trimmedCongregationId);
         const congDocRef = doc(db, "congregations", trimmedCongregationId);
         try {
             const congDocSnap = await getDoc(congDocRef);
             if (!congDocSnap.exists()) {
                 console.warn("Código da Congregação inválido (não encontrado):", trimmedCongregationId);
                 throw new Error("Código da Congregação inválido ou não encontrado.");
             }
             console.log("Código da Congregação válido.");
             validatedCongregationId = trimmedCongregationId;
         } catch (error: any) {
             console.error("Erro ao validar congregationId:", error);
             throw new Error(`Erro ao verificar o Código da Congregação: ${error.message || error.code || 'Erro desconhecido'}`);
         }
     }

     // 2. Cria o usuário no Firebase Auth
     const userCredential = await createUserWithEmailAndPassword(auth, email, password);
     const newUser = userCredential.user;

     // 3. Atualiza o profile do Auth (nome)
     await updateProfile(newUser, { displayName: name });

     // 4. Cria/Atualiza documentos no Firestore usando Batch
     const batch = writeBatch(db);

     // 4.1 Documento na coleção /users
     const userDocRef = doc(db, "users", newUser.uid);
     const initialUserData: UserData = {
         uid: newUser.uid,
         name: name,
         email: email,
         congregationId: validatedCongregationId, // Usa o ID validado ou null
         createdAt: serverTimestamp(),
     };
     batch.set(userDocRef, initialUserData);
     console.log("Batch: Adicionado criação do documento /users/", newUser.uid);

     // 4.2 Documento na subcoleção /congregations/{id}/people se congregationId foi validado
     if (validatedCongregationId) {
         // Usa UID do usuário como ID do doc na subcoleção people
         const personDocRef = doc(db, "congregations", validatedCongregationId, "people", newUser.uid);
         const newPersonData: Omit<PersonData, 'id'> = {
             name: name, // Mesmo nome do cadastro
             categories: [], // Sem categorias iniciais ao entrar com código
             linkedUserId: newUser.uid, // Vincula automaticamente
             createdBy: newUser.uid, // Criado por ele mesmo
             createdAt: serverTimestamp(),
         };
         batch.set(personDocRef, newPersonData);
         console.log("Batch: Adicionado criação do documento /congregations/", validatedCongregationId, "/people/", newUser.uid);
         // Opcional: Atualizar contagem de membros aqui (idealmente com Cloud Function)
     }

     // 5. Executa o Batch
     try {
         await batch.commit();
         console.log("Batch de Signup commitado com sucesso.");
     } catch (firestoreError) {
         console.error("Erro ao commitar batch de Signup:", firestoreError);
         // Considerar deletar usuário do Auth se batch falhar
         throw new Error("Erro ao salvar dados iniciais do usuário.");
     }
     // O listener onSnapshot no useEffect principal pegará a criação/atualização
     // do documento /users e o redirecionamento ocorrerá.
  };

  // Função de Logout
  const logout = async (): Promise<void> => {
    await signOut(auth);
    // O redirecionamento será tratado pelo useEffect
  };

  // --- Valor do Contexto ---
  // Otimiza o valor para evitar re-renderizações desnecessárias
  const value: AuthContextData = useMemo(
    () => ({
      user,
      userData,
      isAdmin, // Inclui isAdmin
      userCategories, // Inclui userCategories
      loading,
      login,
      signup,
      logout,
    }),
    [user, userData, isAdmin, userCategories, loading] // Adiciona dependências
    
  );

  // --- Renderização do Provedor ---
  return (
    <AuthContext.Provider value={value}>
      {/* Renderiza null durante o loading inicial */}
      {loading ? null : children}
    </AuthContext.Provider>
  );
};
