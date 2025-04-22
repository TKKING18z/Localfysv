import React, { createContext, useContext, useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useAuth } from './AuthContext';

// Define types for our context
export interface PointsTransaction {
  id: string;
  userId: string;
  points: number;
  type: 'purchase' | 'review' | 'share' | 'visit' | 'redeem' | 'other';
  description: string;
  businessId?: string;
  businessName?: string;
  orderId?: string;
  reviewId?: string;
  createdAt: firebase.firestore.Timestamp;
}

export interface PointsReward {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  isActive: boolean;
  imageUrl?: string;
  businessId?: string; // Optional: For business-specific rewards
}

// Add ActiveRedemption type for discounts
export interface ActiveRedemption {
  id: string;
  name: string;
  description?: string;
  discountAmount?: number;
  discountPercent?: number;
  expiryDate?: firebase.firestore.Timestamp;
  isUsed: boolean;
  businessId?: string;
}

interface PointsContextType {
  totalPoints: number;
  transactions: PointsTransaction[];
  rewards: PointsReward[];
  loading: boolean;
  error: string | null;
  refreshPoints: () => Promise<void>;
  awardPointsForPurchase: (orderId: string, amount: number, businessId: string, businessName: string) => Promise<void>;
  awardPointsForReview: (reviewId: string, businessId: string, businessName: string) => Promise<void>;
  awardPointsForShare: (businessId: string, businessName: string, platform: string) => Promise<void>;
  awardPointsForVisit: (businessId: string, businessName: string) => Promise<void>;
  redeemPoints: (rewardId: string, pointsCost: number, rewardName: string) => Promise<boolean>;
  getAvailableRewards: () => Promise<void>;
  getUserTransactions: (limit?: number) => Promise<PointsTransaction[]>;
  // Add the missing methods
  getActiveRedemptions: () => Promise<ActiveRedemption[]>;
  hasAvailableDiscount: () => boolean;
  getAvailableDiscount: () => ActiveRedemption | null;
  markRedemptionAsUsed: (redemptionId: string) => Promise<boolean>;
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);

export const PointsProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const { user } = useAuth();
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [rewards, setRewards] = useState<PointsReward[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Add state for active redemptions
  const [activeRedemptions, setActiveRedemptions] = useState<ActiveRedemption[]>([]);
  
  const db = firebase.firestore();
  
  // Load user's points when the component mounts or user changes
  useEffect(() => {
    if (user) {
      refreshPoints();
      // Also fetch active redemptions
      getActiveRedemptions().catch(err => 
        console.error('Error loading redemptions on mount:', err)
      );
    } else {
      // Reset state when user logs out
      setTotalPoints(0);
      setTransactions([]);
      setActiveRedemptions([]);
    }
  }, [user]);
  
  /**
   * Refresh user's points total and recent transactions
   */
  const refreshPoints = async (): Promise<void> => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get user's points summary document
      const pointsSummaryRef = db.collection('pointsSummary').doc(user.uid);
      const summaryDoc = await pointsSummaryRef.get();
      
      if (summaryDoc.exists) {
        const summaryData = summaryDoc.data();
        setTotalPoints(summaryData?.totalPoints || 0);
      } else {
        // Create points summary document if it doesn't exist
        await pointsSummaryRef.set({
          userId: user.uid,
          totalPoints: 0,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        setTotalPoints(0);
      }
      
      // Get user's recent transactions
      const transactionsRef = db.collection('pointsTransactions')
        .where('userId', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .limit(20);
      
      const transactionsSnapshot = await transactionsRef.get();
      const transactionsData = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PointsTransaction[];
      
      setTransactions(transactionsData);
    } catch (err: any) {
      console.error('Error refreshing points:', err);
      setError(err.message || 'Failed to refresh points');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Award points for a purchase
   */
  const awardPointsForPurchase = async (
    orderId: string, 
    amount: number, 
    businessId: string, 
    businessName: string
  ): Promise<void> => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Cambio en el cálculo de puntos: 2 puntos por cada dólar gastado
      const pointsToAward = Math.floor(amount * 2);
      
      // Check if points were already awarded for this order
      const existingTransaction = await db.collection('pointsTransactions')
        .where('userId', '==', user.uid)
        .where('orderId', '==', orderId)
        .where('type', '==', 'purchase')
        .limit(1)
        .get();
      
      if (!existingTransaction.empty) {
        console.log('Points already awarded for this order');
        return;
      }
      
      // Create transaction in Firestore using a batch
      const batch = db.batch();
      
      // Create points transaction
      const transactionRef = db.collection('pointsTransactions').doc();
      const transactionData: Omit<PointsTransaction, 'id'> = {
        userId: user.uid,
        points: pointsToAward,
        type: 'purchase',
        description: `Compra en ${businessName} por $${amount.toFixed(2)}`,
        businessId,
        businessName,
        orderId,
        createdAt: firebase.firestore.Timestamp.now()
      };
      
      batch.set(transactionRef, transactionData);
      
      // Update points summary
      const summaryRef = db.collection('pointsSummary').doc(user.uid);
      batch.update(summaryRef, {
        totalPoints: firebase.firestore.FieldValue.increment(pointsToAward),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Commit the batch
      await batch.commit();
      
      // Update local state
      setTotalPoints(prev => prev + pointsToAward);
      const newTransaction: PointsTransaction = {
        id: transactionRef.id,
        ...transactionData
      };
      setTransactions(prev => [newTransaction, ...prev]);
      
      console.log(`Awarded ${pointsToAward} points for purchase`);
    } catch (err: any) {
      console.error('Error awarding points for purchase:', err);
      setError(err.message || 'Failed to award points for purchase');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Award points for leaving a review
   */
  const awardPointsForReview = async (
    reviewId: string, 
    businessId: string, 
    businessName: string
  ): Promise<void> => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fixed points for reviews - changed from 5 to 3
      const pointsToAward = 3;
      
      // Check if points were already awarded for this review
      const existingTransaction = await db.collection('pointsTransactions')
        .where('userId', '==', user.uid)
        .where('reviewId', '==', reviewId)
        .where('type', '==', 'review')
        .limit(1)
        .get();
      
      if (!existingTransaction.empty) {
        console.log('Points already awarded for this review');
        return;
      }
      
      // Create transaction in Firestore using a batch
      const batch = db.batch();
      
      // Create points transaction
      const transactionRef = db.collection('pointsTransactions').doc();
      const transactionData: Omit<PointsTransaction, 'id'> = {
        userId: user.uid,
        points: pointsToAward,
        type: 'review',
        description: `Reseña en ${businessName}`,
        businessId,
        businessName,
        reviewId,
        createdAt: firebase.firestore.Timestamp.now()
      };
      
      batch.set(transactionRef, transactionData);
      
      // Update points summary
      const summaryRef = db.collection('pointsSummary').doc(user.uid);
      batch.update(summaryRef, {
        totalPoints: firebase.firestore.FieldValue.increment(pointsToAward),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Commit the batch
      await batch.commit();
      
      // Update local state
      setTotalPoints(prev => prev + pointsToAward);
      const newTransaction: PointsTransaction = {
        id: transactionRef.id,
        ...transactionData
      };
      setTransactions(prev => [newTransaction, ...prev]);
      
      console.log(`Awarded ${pointsToAward} points for review`);
    } catch (err: any) {
      console.error('Error awarding points for review:', err);
      setError(err.message || 'Failed to award points for review');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Award points for sharing on social media
   */
  const awardPointsForShare = async (
    businessId: string, 
    businessName: string, 
    platform: string
  ): Promise<void> => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fixed points for sharing
      const pointsToAward = 2;
      
      // Check if user has already shared this business today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existingTransaction = await db.collection('pointsTransactions')
        .where('userId', '==', user.uid)
        .where('businessId', '==', businessId)
        .where('type', '==', 'share')
        .where('createdAt', '>=', today)
        .limit(1)
        .get();
      
      if (!existingTransaction.empty) {
        console.log('Points already awarded for sharing this business today');
        return;
      }
      
      // Create transaction in Firestore using a batch
      const batch = db.batch();
      
      // Create points transaction
      const transactionRef = db.collection('pointsTransactions').doc();
      const transactionData: Omit<PointsTransaction, 'id'> = {
        userId: user.uid,
        points: pointsToAward,
        type: 'share',
        description: `Compartir ${businessName} en ${platform}`,
        businessId,
        businessName,
        createdAt: firebase.firestore.Timestamp.now()
      };
      
      batch.set(transactionRef, transactionData);
      
      // Update points summary
      const summaryRef = db.collection('pointsSummary').doc(user.uid);
      batch.update(summaryRef, {
        totalPoints: firebase.firestore.FieldValue.increment(pointsToAward),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Commit the batch
      await batch.commit();
      
      // Update local state
      setTotalPoints(prev => prev + pointsToAward);
      const newTransaction: PointsTransaction = {
        id: transactionRef.id,
        ...transactionData
      };
      setTransactions(prev => [newTransaction, ...prev]);
      
      console.log(`Awarded ${pointsToAward} points for sharing`);
    } catch (err: any) {
      console.error('Error awarding points for sharing:', err);
      setError(err.message || 'Failed to award points for sharing');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Award points for visiting a business
   */
  const awardPointsForVisit = async (
    businessId: string, 
    businessName: string
  ): Promise<void> => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Check if user has already visited this business today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existingTransaction = await db.collection('pointsTransactions')
        .where('userId', '==', user.uid)
        .where('businessId', '==', businessId)
        .where('type', '==', 'visit')
        .where('createdAt', '>=', today)
        .limit(1)
        .get();
      
      if (!existingTransaction.empty) {
        console.log('Points already awarded for visiting this business today');
        return;
      }
      
      // Get count of business visits for the user today
      const visitCountToday = await db.collection('pointsTransactions')
        .where('userId', '==', user.uid)
        .where('type', '==', 'visit')
        .where('createdAt', '>=', today)
        .get();
      
      // Count this visit too (current visit + existing visits)
      const totalVisitCount = visitCountToday.size + 1;
      
      // Award 1 point for every 10 businesses visited (count divisible by 10)
      // This means the 10th, 20th, 30th, etc. business visited will earn a point
      const pointsToAward = (totalVisitCount % 10 === 0) ? 1 : 0;
      
      // Always record the visit, even if no points awarded
      const batch = db.batch();
      
      // Create points transaction
      const transactionRef = db.collection('pointsTransactions').doc();
      const transactionData: Omit<PointsTransaction, 'id'> = {
        userId: user.uid,
        points: pointsToAward,
        type: 'visit',
        description: pointsToAward > 0 
          ? `Visita a ${businessName} (${totalVisitCount}ª visita del día - ¡Ganaste 1 punto!)` 
          : `Visita a ${businessName} (${totalVisitCount}ª visita del día)`,
        businessId,
        businessName,
        createdAt: firebase.firestore.Timestamp.now()
      };
      
      batch.set(transactionRef, transactionData);
      
      // Only update points summary if points were awarded
      if (pointsToAward > 0) {
        const summaryRef = db.collection('pointsSummary').doc(user.uid);
        batch.update(summaryRef, {
          totalPoints: firebase.firestore.FieldValue.increment(pointsToAward),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Commit the batch
      await batch.commit();
      
      // Update local state
      if (pointsToAward > 0) {
        setTotalPoints(prev => prev + pointsToAward);
      }
      
      const newTransaction: PointsTransaction = {
        id: transactionRef.id,
        ...transactionData
      };
      setTransactions(prev => [newTransaction, ...prev]);
      
      console.log(pointsToAward > 0 
        ? `Awarded ${pointsToAward} point for ${totalVisitCount}th business visit` 
        : `Recorded visit (no points awarded)`);
    } catch (err: any) {
      console.error('Error recording business visit:', err);
      setError(err.message || 'Failed to record business visit');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Redeem points for a reward
   */
  const redeemPoints = async (
    rewardId: string, 
    pointsCost: number, 
    rewardName: string
  ): Promise<boolean> => {
    if (!user) {
      console.error('No hay usuario autenticado');
      setError('Inicia sesión para canjear puntos');
      return false;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Iniciando canje: ID=${rewardId}, Costo=${pointsCost}, Nombre=${rewardName}`);
      console.log(`Puntos actuales del usuario: ${totalPoints}`);
      
      // Check if user has enough points
      if (totalPoints < pointsCost) {
        console.error(`Puntos insuficientes: ${totalPoints} < ${pointsCost}`);
        setError('No tienes suficientes puntos para este premio');
        return false;
      }
      
      // Variable para almacenar los datos del premio
      let rewardData: PointsReward = {
        id: rewardId,
        name: rewardName,
        description: `Premio canjeado por ${pointsCost} puntos`,
        pointsCost: pointsCost,
        isActive: true
      };
      
      // Get the reward details if it exists in the database
      try {
        const rewardDoc = await db.collection('rewards').doc(rewardId).get();
        
        if (rewardDoc.exists) {
          console.log('Premio encontrado en la base de datos');
          rewardData = { 
            ...rewardData, 
            ...rewardDoc.data() as PointsReward 
          };
        } else {
          // Si es un premio de muestra, no mostrar error, sólo continuar con los datos que tenemos
          if (rewardId.startsWith('sample-')) {
            console.log('Premio de muestra, no existe en la base de datos pero continuamos');
          } else {
            console.warn(`Premio no encontrado en la base de datos: ${rewardId}`);
          }
        }
      } catch (error) {
        // Si hay un error al buscar el premio, lo registramos pero continuamos con el canje
        console.error('Error al buscar el premio en la base de datos:', error);
      }
      
      // Create transaction in Firestore using a batch
      const batch = db.batch();
      
      // Create redemption transaction
      const transactionRef = db.collection('pointsTransactions').doc();
      const transactionData: Omit<PointsTransaction, 'id'> = {
        userId: user.uid,
        points: -pointsCost, // Negative points for redemption
        type: 'redeem',
        description: `Canje por ${rewardName}`,
        createdAt: firebase.firestore.Timestamp.now()
      };
      
      batch.set(transactionRef, transactionData);
      console.log('Transacción de canje creada');
      
      // Update points summary
      const summaryRef = db.collection('pointsSummary').doc(user.uid);
      batch.update(summaryRef, {
        totalPoints: firebase.firestore.FieldValue.increment(-pointsCost),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('Actualización de resumen de puntos preparada');
      
      // Create redemption record
      const redemptionRef = db.collection('redemptions').doc();
      batch.set(redemptionRef, {
        userId: user.uid,
        rewardId,
        rewardName,
        pointsCost,
        transactionId: transactionRef.id,
        status: 'pending', // pending, completed, canceled
        createdAt: firebase.firestore.Timestamp.now()
      });
      console.log('Registro de canje creado');
      
      // Create an active redemption (discount) record
      // Set expiry to 30 days from now
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      
      // Determine discount type and amount from the reward data
      const userRedemptionRef = db.collection('userRedemptions').doc();
      const userRedemptionData: Omit<ActiveRedemption, 'id'> = {
        name: rewardName,
        description: rewardData.description || `Descuento canjeado con ${pointsCost} puntos`,
        isUsed: false,
        expiryDate: firebase.firestore.Timestamp.fromDate(expiryDate)
      };
      
      // Add appropriate discount properties based on reward point cost
      if (pointsCost < 100) {
        // Small discount: $2 fixed amount
        userRedemptionData.discountAmount = 2;
      } else if (pointsCost < 200) {
        // Medium discount: $5 fixed amount
        userRedemptionData.discountAmount = 5;
      } else if (pointsCost < 500) {
        // Large discount: $10 fixed amount
        userRedemptionData.discountAmount = 10;
      } else {
        // Premium discount: 15% percentage
        userRedemptionData.discountPercent = 15;
      }
      
      // Optional: add business-specific information if this discount is for a specific business
      if (rewardData.businessId) {
        userRedemptionData.businessId = rewardData.businessId;
      }
      
      batch.set(userRedemptionRef, {
        ...userRedemptionData,
        userId: user.uid,
        createdAt: firebase.firestore.Timestamp.now()
      });
      console.log('Descuento activo creado');
      
      // Commit the batch
      console.log('Ejecutando transacción en la base de datos...');
      await batch.commit();
      console.log('¡Transacción completada con éxito!');
      
      // Update local state
      setTotalPoints(prev => prev - pointsCost);
      const newTransaction: PointsTransaction = {
        id: transactionRef.id,
        ...transactionData
      };
      setTransactions(prev => [newTransaction, ...prev]);
      
      // Refresh the active redemptions list
      await getActiveRedemptions();
      
      console.log(`Canje exitoso: ${pointsCost} puntos por ${rewardName}`);
      return true;
    } catch (err: any) {
      console.error('Error detallado al canjear puntos:', err);
      // Guardar información detallada sobre el error
      let errorDetails;
      try {
        errorDetails = JSON.stringify(err);
      } catch (e) {
        errorDetails = `Error no serializable: ${err.message || err}`;
      }
      console.error(`Detalles del error: ${errorDetails}`);
      
      // Mensaje de error más preciso para el usuario
      let errorMessage = 'Error al canjear puntos';
      
      // Analizar mensaje específico basado en tipo de error
      if (err.code === 'permission-denied') {
        errorMessage = 'No tienes permiso para realizar esta acción';
      } else if (err.code === 'not-found') {
        errorMessage = 'El premio solicitado no existe';
      } else if (err.code === 'resource-exhausted') {
        errorMessage = 'Servicio temporalmente no disponible. Intenta más tarde';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Get available rewards
   */
  const getAvailableRewards = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      const rewardsRef = db.collection('rewards')
        .where('isActive', '==', true)
        .orderBy('pointsCost', 'asc');
      
      const rewardsSnapshot = await rewardsRef.get();
      const rewardsData = rewardsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PointsReward[];
      
      setRewards(rewardsData);
    } catch (err: any) {
      console.error('Error getting rewards:', err);
      setError(err.message || 'Failed to get rewards');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Get user's transaction history
   */
  const getUserTransactions = async (limit: number = 50): Promise<PointsTransaction[]> => {
    if (!user) return [];
    
    setLoading(true);
    setError(null);
    
    try {
      const transactionsRef = db.collection('pointsTransactions')
        .where('userId', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .limit(limit);
      
      const transactionsSnapshot = await transactionsRef.get();
      return transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PointsTransaction[];
    } catch (err: any) {
      console.error('Error getting transactions:', err);
      setError(err.message || 'Failed to get transactions');
      return [];
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Get user's active redemptions (discounts)
   */
  const getActiveRedemptions = async (): Promise<ActiveRedemption[]> => {
    if (!user) return [];
    
    setLoading(true);
    setError(null);
    
    try {
      const redemptionsRef = db.collection('userRedemptions')
        .where('userId', '==', user.uid)
        .where('isUsed', '==', false)
        .where('expiryDate', '>', firebase.firestore.Timestamp.now());
      
      const redemptionsSnapshot = await redemptionsRef.get();
      const redemptionsData = redemptionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActiveRedemption[];
      
      // Cache the redemptions in state
      setActiveRedemptions(redemptionsData);
      return redemptionsData;
    } catch (err: any) {
      console.error('Error getting active redemptions:', err);
      setError(err.message || 'Failed to get active redemptions');
      return [];
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Check if user has any available discounts
   */
  const hasAvailableDiscount = (): boolean => {
    return activeRedemptions.length > 0;
  };
  
  /**
   * Get the first available discount
   */
  const getAvailableDiscount = (): ActiveRedemption | null => {
    if (!hasAvailableDiscount()) return null;
    // Return the first available discount
    // You could implement more complex logic here to choose the best discount
    return activeRedemptions[0];
  };
  
  /**
   * Mark a redemption as used
   */
  const markRedemptionAsUsed = async (redemptionId: string): Promise<boolean> => {
    if (!user) return false;
    
    setLoading(true);
    setError(null);
    
    try {
      // Update the redemption in Firestore
      await db.collection('userRedemptions').doc(redemptionId).update({
        isUsed: true,
        usedAt: firebase.firestore.Timestamp.now()
      });
      
      // Update local state
      setActiveRedemptions(prev => prev.filter(r => r.id !== redemptionId));
      return true;
    } catch (err: any) {
      console.error('Error marking redemption as used:', err);
      setError(err.message || 'Failed to mark redemption as used');
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  const value = {
    totalPoints,
    transactions,
    rewards,
    loading,
    error,
    refreshPoints,
    awardPointsForPurchase,
    awardPointsForReview,
    awardPointsForShare,
    awardPointsForVisit,
    redeemPoints,
    getAvailableRewards,
    getUserTransactions,
    // Add the new methods to the context value
    getActiveRedemptions,
    hasAvailableDiscount,
    getAvailableDiscount,
    markRedemptionAsUsed
  };
  
  return (
    <PointsContext.Provider value={value}>
      {children}
    </PointsContext.Provider>
  );
};

export const usePoints = () => {
  const context = useContext(PointsContext);
  if (context === undefined) {
    throw new Error('usePoints must be used within a PointsProvider');
  }
  return context;
}; 