// src/services/achievementService.ts
import { db } from '@/lib/firebase'; // Ajuste o caminho se necessário
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
  query,
  Timestamp, // Import Timestamp
} from 'firebase/firestore';
import {
  AchievementDefinition,
  UserAchievement,
} from '@/types'; // Seus tipos
import { ReadingSchedule } from '@/types'; // Tipo ReadingSchedule

// Importar TODAS as funções de verificação necessárias
import {
  calculateStreak,
  didCompleteBook,
  didCompleteSection, // <--- Importar nova função
  checkReadTime,      // <--- Importar nova função
  checkReadDate       // <--- Importar nova função
} from '@/utils/achievementCheckUtils'; // <--- Ajuste o caminho

/**
 * Contexto do evento que disparou a verificação de conquistas.
 */
export type AchievementCheckContext =
  | 'plan_created'
  | 'progress_updated'
  | 'plan_completed'
  | 'app_load';

/**
 * Verifica as condições das conquistas com base nos dados do usuário e do plano,
 * e desbloqueia a primeira nova conquista encontrada.
 *
 * @param userId ID do usuário.
 * @param scheduleData Dados atuais do plano de leitura (pode ser null).
 * @param context O evento que disparou a verificação.
 * @returns A definição da primeira conquista desbloqueada nesta verificação, ou null.
 */
export const checkAndAwardAchievements = async (
  userId: string,
  scheduleData: ReadingSchedule | null,
  context: AchievementCheckContext
): Promise<AchievementDefinition | null> => {
  if (!userId) {
    console.warn('checkAndAwardAchievements: userId is required.');
    return null;
  }

  // Obter o timestamp mais recente se o contexto for de atualização de progresso
   let lastReadTimestamp: Timestamp | null = null;
   if (context === 'progress_updated' && scheduleData?.readCompletionTimestamps && scheduleData.readCompletionTimestamps.length > 0) {
     // Pega o último timestamp adicionado
     lastReadTimestamp = scheduleData.readCompletionTimestamps[scheduleData.readCompletionTimestamps.length - 1];
   }

  console.log(`Checking achievements for user ${userId}, context: ${context}, lastReadTs: ${lastReadTimestamp?.toDate()}`);

  try {
    // 1. Buscar definições (sem alterações aqui)
    const definitionsRef = collection(db, 'achievements');
    const definitionsSnap = await getDocs(definitionsRef);
    const definitions: AchievementDefinition[] = definitionsSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as AchievementDefinition)
    );

    if (definitions.length === 0) {
      console.warn('No achievement definitions found in Firestore.');
      return null;
    }

    // 2. Buscar conquistas já desbloqueadas (sem alterações aqui)
    const userAchRef = collection(db, 'users', userId, 'userAchievements');
    const userAchSnap = await getDocs(userAchRef);
    const unlockedIds = new Set<string>(userAchSnap.docs.map((doc) => doc.id));

    let newlyUnlockedAchievement: AchievementDefinition | null = null;
    const batch = writeBatch(db);
    let batchHasWrites = false;

    // 3. Iterar e verificar condições (com novos casos)
    for (const definition of definitions) {
      if (unlockedIds.has(definition.id)) {
        continue;
      }

      let conditionMet = false;

      // --- Lógica de Verificação ATUALIZADA ---
      switch (definition.triggerType) {
        case 'streak':
          if (scheduleData?.readCompletionTimestamps) {
            const currentStreak = calculateStreak(scheduleData.readCompletionTimestamps);
            if (currentStreak >= (definition.triggerValue as number)) {
              conditionMet = true;
            }
          }
          break;

        case 'plan_started':
          if (context === 'plan_created') {
             conditionMet = true;
          }
          break;

        case 'plan_completed':
          if ((context === 'plan_completed' || context === 'progress_updated') && scheduleData?.status === 'completed') {
             conditionMet = true;
          }
          break;

        case 'chapters_read':
           if (scheduleData?.chaptersReadCount && scheduleData.chaptersReadCount >= (definition.triggerValue as number)) {
               conditionMet = true;
           }
           break;

        case 'book_completed':
           if (didCompleteBook(definition.triggerValue as string, scheduleData?.completedChaptersMap)) {
               conditionMet = true;
           }
           break;

        // --- NOVOS CASOS ---
        case 'section_completed':
            if (didCompleteSection(definition.triggerValue as string, scheduleData?.completedChaptersMap)) {
                conditionMet = true;
            }
            break;

        case 'read_time':
            // Verifica apenas se o contexto é de atualização e temos um timestamp recente
            if (context === 'progress_updated' && lastReadTimestamp) {
                if (checkReadTime(lastReadTimestamp, definition.triggerValue as string)) {
                     conditionMet = true;
                }
            }
            break;

        case 'read_date':
            // Verifica apenas se o contexto é de atualização e temos um timestamp recente
             if (context === 'progress_updated' && lastReadTimestamp) {
                if (checkReadDate(lastReadTimestamp, definition.triggerValue as string)) {
                    conditionMet = true;
                }
             }
            break;

        default:
          // console.warn(`Unknown trigger type: ${definition.triggerType}`);
          break;
      }
      // --- Fim da Lógica de Verificação ---

      if (conditionMet && !newlyUnlockedAchievement) {
        console.log(`Condition met for achievement: ${definition.name} (ID: ${definition.id})`);
        newlyUnlockedAchievement = definition;

        const newUserAchDocRef = doc(db, 'users', userId, 'userAchievements', definition.id);
        batch.set(newUserAchDocRef, {
          achievementId: definition.id,
          unlocked: true,
          unlockedAt: serverTimestamp(),
          notified: false,
        });
        batchHasWrites = true;

        // break; // Descomente para parar na primeira conquista desbloqueada
      }
    }

    // 4. Commit do Batch (sem alterações aqui)
    if (batchHasWrites) {
      await batch.commit();
      console.log(`Batch committed for user ${userId}. Unlocked: ${newlyUnlockedAchievement?.name}`);
      return newlyUnlockedAchievement;
    }

    return null;

  } catch (error) {
    console.error(`Error checking/awarding achievements for user ${userId}:`, error);
    return null;
  }
};