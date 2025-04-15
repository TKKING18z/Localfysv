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
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);

export const PointsProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const { user } = useAuth();
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [rewards, setRewards] = useState<PointsReward[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const db = firebase.firestore();
  
  // Load user's points when the component mounts or user changes
  useEffect(() => {
    if (user) {
      refreshPoints();
    } else {
      // Reset state when user logs out
      setTotalPoints(0);
      setTransactions([]);
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
    if (!user) return false;
    
    setLoading(true);
    setError(null);
    
    try {
      // Check if user has enough points
      if (totalPoints < pointsCost) {
        setError('No tienes suficientes puntos para este premio');
        return false;
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
      
      // Update points summary
      const summaryRef = db.collection('pointsSummary').doc(user.uid);
      batch.update(summaryRef, {
        totalPoints: firebase.firestore.FieldValue.increment(-pointsCost),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
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
      
      // Commit the batch
      await batch.commit();
      
      // Update local state
      setTotalPoints(prev => prev - pointsCost);
      const newTransaction: PointsTransaction = {
        id: transactionRef.id,
        ...transactionData
      };
      setTransactions(prev => [newTransaction, ...prev]);
      
      console.log(`Redeemed ${pointsCost} points for ${rewardName}`);
      return true;
    } catch (err: any) {
      console.error('Error redeeming points:', err);
      setError(err.message || 'Failed to redeem points');
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
    getUserTransactions
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