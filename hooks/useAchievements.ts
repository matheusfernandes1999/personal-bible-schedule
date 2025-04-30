// src/hooks/useAchievements.ts
import { useState, useEffect } from 'react';
// 1. Importe 'db' do seu arquivo firebase.ts
import { db } from '@/lib/firebase'; // <--- AJUSTE O CAMINHO SE NECESSÁRIO
import { collection, getDocs, onSnapshot, query, orderBy, doc } from 'firebase/firestore'; // Mantenha as importações do Firestore v9+
import { useAuth } from '@/context/AuthContext'; // Seu contexto de autenticação existente
import { AchievementDefinition, UserAchievement } from '@/types'; // Seus tipos definidos

interface AchievementsHookResult {
  achievements: (AchievementDefinition & { userStatus: UserAchievement | null })[];
  loading: boolean;
  error: Error | null;
}

export function useAchievements(): AchievementsHookResult {
  const { user } = useAuth(); // Obtém o usuário do seu contexto
  const [definitions, setDefinitions] = useState<AchievementDefinition[]>([]);
  const [userAchievements, setUserAchievements] = useState<Record<string, UserAchievement>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 1. Fetch Definitions once using the imported 'db'
  useEffect(() => {
    const fetchDefs = async () => {
      setError(null); // Reseta erro ao tentar buscar
      try {
        // 2. Use 'db' na função collection
        const defsCollectionRef = collection(db, 'achievements');
        // Opcional: Adicionar ordenação se houver um campo 'order'
        const q = query(defsCollectionRef, orderBy('order', 'asc')); // Adapte se não usar 'order'
        // const snapshot = await getDocs(defsCollectionRef); // Sem ordenação
        const snapshot = await getDocs(q); // Com ordenação

        const defsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AchievementDefinition));
        setDefinitions(defsData);

      } catch (err) {
        console.error("Error fetching achievement definitions:", err);
        setError(err instanceof Error ? err : new Error('Failed to fetch achievement definitions'));
      } finally {
         // Se não houver usuário, o loading principal será tratado no próximo useEffect
         if (!user?.uid) {
             setLoading(false);
         }
      }
    };
    fetchDefs();
  }, [db]); // db geralmente é estável, mas incluir pode ser uma boa prática em alguns cenários

  // 2. Listen to User Achievements changes using the imported 'db'
  useEffect(() => {
    // Só executa se tivermos um usuário logado E as definições já foram carregadas (ou tentaram carregar)
    if (!user?.uid) {
      setUserAchievements({}); // Limpa conquistas se o usuário deslogar
      setLoading(false); // Garante que o loading pare se não houver usuário
      return;
    }

     if (definitions.length === 0 && !error) {
        // Ainda esperando definições ou houve erro nelas, não busca conquistas do user ainda
        setLoading(true); // Mantém loading ativo
        return;
     }


    setLoading(true); // Inicia loading para buscar dados do usuário
    setError(null); // Limpa erros anteriores

    // 3. Use 'db' para obter a referência da subcoleção do usuário
    const userAchColRef = collection(db, 'users', user.uid, 'userAchievements');

    const unsubscribe = onSnapshot(userAchColRef, (snapshot) => {
      const userAchData: Record<string, UserAchievement> = {};
      snapshot.docs.forEach(docSnapshot => { // Renomeado para evitar conflito com 'doc' do firestore
        userAchData[docSnapshot.id] = { achievementId: docSnapshot.id, ...docSnapshot.data() } as UserAchievement;
      });
      setUserAchievements(userAchData);
      setLoading(false); // Terminou de carregar/atualizar
      setError(null); // Limpa erro em caso de sucesso
    }, (err) => {
      console.error("Error fetching user achievements:", err);
      setError(err instanceof Error ? err : new Error('Failed to fetch user achievements'));
      setLoading(false); // Terminou com erro
    });

    // Função de limpeza para desregistrar o listener quando o componente desmontar ou o user mudar
    return () => unsubscribe();

  }, [user?.uid, db, definitions, error]); // Reage a mudanças no user, db (raro), definições e estado de erro anterior


  // 3. Combine definitions with user status (Lógica inalterada)
  const combinedAchievements = definitions.map(def => ({
    ...def,
    userStatus: userAchievements[def.id] || null, // Associa o status do usuário à definição
  })).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)); // Mantém a ordenação se existir 'order'

  return { achievements: combinedAchievements, loading, error };
}