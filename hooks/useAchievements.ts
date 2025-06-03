// src/hooks/useAchievements.ts
import { useState, useEffect, useCallback } from 'react'; // <<< Added useCallback
// 1. Importe 'db' do seu arquivo firebase.ts
import { db } from '@/lib/firebase'; // <--- AJUSTE O CAMINHO SE NECESSÁRIO
import { collection, getDocs, onSnapshot, query, orderBy, doc } from 'firebase/firestore'; // Mantenha as importações do Firestore v9+
import { useAuth } from '@/context/AuthContext'; // Seu contexto de autenticação existente
import { AchievementDefinition, UserAchievement } from '@/types'; // Seus tipos definidos

interface AchievementsHookResult {
  achievements: (AchievementDefinition & { userStatus: UserAchievement | null })[];
  loading: boolean;
  error: Error | null;
  refreshAchievements: () => void; // <<< Added refresh function
}

export function useAchievements(): AchievementsHookResult {
  const { user } = useAuth(); // Obtém o usuário do seu contexto
  const [definitions, setDefinitions] = useState<AchievementDefinition[]>([]);
  const [userAchievements, setUserAchievements] = useState<Record<string, UserAchievement>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // <<< Added refreshKey state

  const refreshAchievements = useCallback(() => { // <<< Added refreshAchievements function
    setRefreshKey(prevKey => prevKey + 1);
  }, []);

  // 1. Fetch Definitions
  useEffect(() => {
    const fetchDefs = async () => {
      setLoading(true); // <<< Set loading true at the beginning
      setError(null);
      try {
        const defsCollectionRef = collection(db, 'achievements');
        // Opcional: Adicionar ordenação se houver um campo 'order'
        const q = query(defsCollectionRef, orderBy('order', 'asc')); // Adapte se não usar 'order'
        // const snapshot = await getDocs(defsCollectionRef); // Sem ordenação
        const snapshot = await getDocs(q); // Com ordenação

        const defsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AchievementDefinition));
        setDefinitions(defsData);
        // Do not set loading to false here, let the user achievements effect handle it or handle it if no user.
      } catch (err) {
        console.error("Error fetching achievement definitions:", err);
        const newError = err instanceof Error ? err : new Error('Failed to fetch achievement definitions');
        setError(newError);
        // Set loading to false only if there's an error and no user to trigger the next effect
        if (!user?.uid) {
            setLoading(false);
        }
      }
      // If there's no user, the user achievements effect won't run to set loading to false.
      if (!user?.uid) {
          setLoading(false);
      }
    };
    fetchDefs();
  }, [db, refreshKey]); // <<< Added refreshKey to dependency array

  // 2. Listen to User Achievements changes
  useEffect(() => {
    if (!user?.uid) {
      setUserAchievements({});
      // If definitions also failed to load, error is already set.
      // If definitions loaded but no user, this is not an error state for achievements overall.
      // Loading should be false if definitions finished and there's no user.
      // The definitions useEffect handles setting loading to false if no user.
      return;
    }

    // If definitions are still loading or failed, don't proceed
    // (unless it's just refreshKey that changed, in which case defs will reload too)
    if (definitions.length === 0 && error) {
        // Error already occurred in definitions fetch, loading is likely false from there if no user.
        // If user exists, definitions effect might not have set loading to false.
        setLoading(false);
        return;
    }
     if (definitions.length === 0 && loading && refreshKey === 0) { // Only on initial load, not refresh
         // Still waiting for definitions on initial load, keep loading
         return;
     }


    setLoading(true); // <<< Set loading true for user achievements fetch
    // setError(null); // Do not reset error here, keep error from definitions if it occurred

    const userAchColRef = collection(db, 'users', user.uid, 'userAchievements');
    const unsubscribe = onSnapshot(userAchColRef, (snapshot) => {
      const userAchData: Record<string, UserAchievement> = {};
      snapshot.docs.forEach(docSnapshot => {
        userAchData[docSnapshot.id] = { achievementId: docSnapshot.id, ...docSnapshot.data() } as UserAchievement;
      });
      setUserAchievements(userAchData);
      setLoading(false);
      // Clear error only if this part succeeds. If defs failed, error remains.
      // However, if defs failed, this part might not even run as intended.
      // A more robust approach might be to set specific errors for defs vs userAch.
      // For now, if this succeeds, we assume any previous error can be cleared if it wasn't from defs.
      // If error is from defs, this success doesn't override it.
      // Let's only clear if there wasn't an error from definitions.
      if (!error || error.message === 'Failed to fetch user achievements') { // only clear userAch error
          setError(null);
      }
    }, (err) => {
      console.error("Error fetching user achievements:", err);
      const newError = err instanceof Error ? err : new Error('Failed to fetch user achievements');
      // Preserve definition error if it exists
      setError(prevError => prevError && prevError.message !== 'Failed to fetch user achievements' ? prevError : newError);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, db, definitions, error, refreshKey, loading]); // <<< Added refreshKey and loading to dependency array


  // 3. Combine definitions with user status
  const combinedAchievements = definitions && definitions.length > 0
    ? definitions.map(def => ({
        ...def,
        userStatus: userAchievements[def.id] || null,
      })).sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    : [];

  return { achievements: combinedAchievements, loading, error, refreshAchievements }; // <<< Added refreshAchievements
}