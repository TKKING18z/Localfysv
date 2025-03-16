import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../theme';

interface ReviewFiltersProps {
  activeFilter: number | null;
  onFilterChange: (rating: number | null) => void;
  sortBy: 'recent' | 'rating' | 'relevant';
  onSortChange: (sortBy: 'recent' | 'rating' | 'relevant') => void;
}

const ReviewFilters: React.FC<ReviewFiltersProps> = ({
  activeFilter,
  onFilterChange,
  sortBy,
  onSortChange,
}) => {
  const sortOptions = [
    { id: 'recent' as const, label: 'Más recientes', icon: 'access-time' },
    { id: 'rating' as const, label: 'Mejor calificadas', icon: 'star' },
    { id: 'relevant' as const, label: 'Más relevantes', icon: 'trending-up' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            !activeFilter && styles.activeFilterChip,
          ]}
          onPress={() => onFilterChange(null)}
        >
          <Text
            style={[
              styles.filterText,
              !activeFilter && styles.activeFilterText,
            ]}
          >
            Todas
          </Text>
        </TouchableOpacity>

        {[5, 4, 3, 2, 1].map(rating => (
          <TouchableOpacity
            key={rating}
            style={[
              styles.filterChip,
              activeFilter === rating && styles.activeFilterChip,
            ]}
            onPress={() => onFilterChange(activeFilter === rating ? null : rating)}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === rating && styles.activeFilterText,
              ]}
            >
              {rating}
            </Text>
            <MaterialIcons
              name="star"
              size={14}
              color={activeFilter === rating ? colors.white : colors.primary}
            />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Ordenar por:</Text>
        <View style={styles.sortOptions}>
          {sortOptions.map(option => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.sortButton,
                sortBy === option.id && styles.activeSortButton,
              ]}
              onPress={() => onSortChange(option.id)}
            >
              <MaterialIcons
                name={option.icon as any}
                size={16}
                color={sortBy === option.id ? colors.white : colors.textSecondary}
              />
              <Text
                style={[
                  styles.sortButtonText,
                  sortBy === option.id && styles.activeSortText,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: spacing.borderRadius,
    padding: spacing.medium,
    shadowColor: "#000", // was colors.shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  filtersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.medium,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small - 2,
    borderRadius: 20,
    marginRight: spacing.small,
    marginBottom: spacing.small,
    borderWidth: 1,
    borderColor: colors.grey, // was colors.border
  },
  activeFilterChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 4,
  },
  activeFilterText: {
    color: colors.white,
  },
  sortContainer: {
    marginTop: spacing.small,
  },
  sortLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.small,
  },
  sortOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: spacing.borderRadius,
    marginRight: spacing.small,
    marginBottom: spacing.small,
  },
  activeSortButton: {
    backgroundColor: colors.primary,
  },
  sortButtonText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.tiny,
  },
  activeSortText: {
    color: colors.white,
  },
});

export default ReviewFilters;
