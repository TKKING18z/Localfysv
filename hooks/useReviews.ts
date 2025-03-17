import { useState, useEffect, useCallback } from 'react';
import { 
  collection, query, where, orderBy, limit, 
  getDocs, startAfter
} from 'firebase/firestore';
import { firestore } from '../config/firebase';
import { Review, ReviewsStats } from '../models/reviewTypes';

// Tipos locales que no existen en el archivo de tipos
type ReviewFilterOption = 'all' | '1' | '2' | '3' | '4' | '5';
type ReviewSortOption = 'recent' | 'highest' | 'lowest';

/**
 * Hook personalizado para gestionar las reseñas de un negocio
 */
export const useBusinessReviews = (businessId: string) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState<ReviewsStats | null>(null);
  const [activeFilter, setActiveFilter] = useState<ReviewFilterOption>('all');
  const [sortBy, setSortBy] = useState<ReviewSortOption>('recent');
  
  // Función para refrescar las reseñas (exportada para usarse después de añadir una nueva)
  const refreshReviews = useCallback(async () => {
    try {
      console.log('Refrescando reseñas para negocio:', businessId);
      setLoading(true);
      setError(null);
      
      // Crear la consulta base - MODIFICADO para evitar error de índice
      let reviewsQuery = query(
        collection(firestore, 'reviews'),
        where('businessId', '==', businessId)
      );
      
      // Aplicar filtro por rating si es necesario
      if (activeFilter !== 'all') {
        const filterRating = parseInt(activeFilter);
        reviewsQuery = query(
          reviewsQuery,
          where('rating', '==', filterRating)
        );
      }
      
      // MODIFICADO - Usar .orderBy solamente cuando sea necesario
      // y con cuidado con los índices compuestos
      if (sortBy === 'recent') {
        // Esta consulta requiere un índice más simple
        reviewsQuery = query(reviewsQuery, orderBy('createdAt', 'desc'));
      } else if (sortBy === 'highest') {
        // Para estas consultas, podrías necesitar crear índices manualmente
        reviewsQuery = query(reviewsQuery, orderBy('rating', 'desc'));
      } else if (sortBy === 'lowest') {
        reviewsQuery = query(reviewsQuery, orderBy('rating', 'asc'));
      }
      
      // Limitar resultados
      reviewsQuery = query(reviewsQuery, limit(10));
      
      try {
        // Ejecutar la consulta
        const querySnapshot = await getDocs(reviewsQuery);
        
        // Procesar resultados
        const reviewsList: Review[] = [];
        querySnapshot.forEach((doc) => {
          reviewsList.push({
            id: doc.id,
            ...doc.data()
          } as Review);
        });
        
        console.log(`Obtenidas ${reviewsList.length} reseñas`);
        setReviews(reviewsList);
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
        setHasMore(querySnapshot.docs.length === 10);
        
        // Calcular estadísticas
        calculateStats(reviewsList);
      } catch (firestoreErr) {
        // Si hay error de índice, mostrar mensaje más amigable
        if (firestoreErr instanceof Error && firestoreErr.toString().includes('requires an index')) {
          console.error('Se necesita crear un índice en Firebase:', firestoreErr);
          setError('Se necesita un índice en Firebase. Por favor contacta al administrador.');
          
          // Versión alternativa con orden simple para recuperar al menos algunos datos
          try {
            const fallbackQuery = query(
              collection(firestore, 'reviews'),
              where('businessId', '==', businessId),
              orderBy('createdAt', 'desc'),
              limit(10)
            );
            
            const fallbackSnapshot = await getDocs(fallbackQuery);
            const fallbackReviews: Review[] = [];
            fallbackSnapshot.forEach((doc) => {
              fallbackReviews.push({
                id: doc.id,
                ...doc.data()
              } as Review);
            });
            
            setReviews(fallbackReviews);
            setLastVisible(fallbackSnapshot.docs[fallbackSnapshot.docs.length - 1] || null);
            setHasMore(fallbackSnapshot.docs.length === 10);
            calculateStats(fallbackReviews);
            
            // Actualizamos error para mostrar que tenemos datos parciales
            setError('Algunas funciones de filtrado no están disponibles');
          } catch (fallbackErr) {
            console.error('Error en consulta fallback:', fallbackErr);
            // Mantenemos el error original
          }
        } else {
          throw firestoreErr; // Re-lanzamos para que lo capture el catch externo
        }
      }
    } catch (err) {
      console.error('Error al obtener reseñas:', err);
      setError('No se pudieron cargar las reseñas');
    } finally {
      setLoading(false);
    }
  }, [businessId, activeFilter, sortBy]);
  
  // Cargar más reseñas (paginación)
  const loadMore = useCallback(async () => {
    if (!hasMore || !lastVisible) return;
    
    try {
      setLoading(true);
      
      // Crear la consulta con paginación
      let nextQuery = query(
        collection(firestore, 'reviews'),
        where('businessId', '==', businessId)
      );
      
      // Aplicar filtro si es necesario
      if (activeFilter !== 'all') {
        const filterRating = parseInt(activeFilter);
        nextQuery = query(
          nextQuery,
          where('rating', '==', filterRating)
        );
      }
      
      // Aplicar ordenamiento
      if (sortBy === 'recent') {
        nextQuery = query(nextQuery, orderBy('createdAt', 'desc'));
      } else if (sortBy === 'highest') {
        nextQuery = query(nextQuery, orderBy('rating', 'desc'));
      } else if (sortBy === 'lowest') {
        nextQuery = query(nextQuery, orderBy('rating', 'asc'));
      }
      
      // Configurar paginación y límite
      nextQuery = query(
        nextQuery,
        startAfter(lastVisible),
        limit(10)
      );
      
      // Ejecutar la consulta
      const querySnapshot = await getDocs(nextQuery);
      
      // Procesar resultados
      const newReviews: Review[] = [];
      querySnapshot.forEach((doc) => {
        newReviews.push({
          id: doc.id,
          ...doc.data()
        } as Review);
      });
      
      // Actualizar estado
      setReviews(prev => [...prev, ...newReviews]);
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
      setHasMore(querySnapshot.docs.length === 10);
      
    } catch (err) {
      console.error('Error al cargar más reseñas:', err);
      setError('Error al cargar más reseñas');
    } finally {
      setLoading(false);
    }
  }, [businessId, lastVisible, hasMore, activeFilter, sortBy]);
  
  // Filtrar por calificación
  const filterByRating = useCallback((filter: ReviewFilterOption) => {
    setActiveFilter(filter);
    setLastVisible(null);
    setHasMore(true);
    // La actualización de reseñas ocurrirá en el efecto que observa cambios en activeFilter
  }, []);
  
  // Cambiar método de ordenamiento
  const changeSortMethod = useCallback((sortMethod: ReviewSortOption) => {
    setSortBy(sortMethod);
    setLastVisible(null);
    setHasMore(true);
    // La actualización de reseñas ocurrirá en el efecto que observa cambios en sortBy
  }, []);
  
  // Calcular estadísticas de reseñas
  const calculateStats = (reviewData: Review[]) => {
    if (!reviewData.length) {
      setStats(null);
      return;
    }
    
    const totalReviews = reviewData.length;
    const sumRatings = reviewData.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = sumRatings / totalReviews;
    
    // Contar reseñas por rating
    const ratingCounts = {
      '1': 0, '2': 0, '3': 0, '4': 0, '5': 0
    };
    
    // Para ratingDistribution (requisito del tipo ReviewsStats)
    const ratingDistribution: Record<number, number> = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0
    };
    
    reviewData.forEach(review => {
      if (review.rating >= 1 && review.rating <= 5) {
        ratingCounts[review.rating.toString() as '1'|'2'|'3'|'4'|'5'] += 1;
        ratingDistribution[review.rating] += 1;
      }
    });
    
    // Calcular porcentajes
    const ratingPercentages = {
      '1': (ratingCounts['1'] / totalReviews) * 100,
      '2': (ratingCounts['2'] / totalReviews) * 100,
      '3': (ratingCounts['3'] / totalReviews) * 100,
      '4': (ratingCounts['4'] / totalReviews) * 100,
      '5': (ratingCounts['5'] / totalReviews) * 100,
    };
    
    setStats({
      totalCount: totalReviews,
      averageRating,
      ratingCounts,
      ratingPercentages,
      ratingDistribution
    });
  };
  
  // Efecto para cargar reseñas iniciales
  useEffect(() => {
    refreshReviews();
  }, [refreshReviews]);
  
  return {
    reviews,
    loading,
    error,
    hasMore,
    stats,
    loadMore,
    filterByRating,
    activeFilter,
    sortBy,
    changeSortMethod,
    refreshReviews, // Exportar esta función para actualizar después de añadir una reseña
  };
};
