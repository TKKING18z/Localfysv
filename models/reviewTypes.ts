export interface Review {
  id: string;
  businessId: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  rating: number; // 1-5 stars
  text: string;
  createdAt: Date;
  updatedAt?: Date;
  images?: ReviewImage[];
  ownerReply?: OwnerReply;
  reactions?: Reactions;
  moderationStatus: 'approved' | 'pending' | 'rejected';
}

export interface ReviewImage {
  id?: string;
  url: string;
  thumbnailUrl?: string;
  uploadedAt?: Date;
}

export interface OwnerReply {
  text: string;
  repliedAt: Date;
  ownerId: string;
}

export interface Reactions {
  likes: number;
  usersWhoLiked: string[];
}

export interface ReviewsStats {
  totalCount: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  ratingCounts: { [key: string]: number };
  ratingPercentages: { [key: string]: number };
}

export type ReviewFilters = {
  businessId?: string;
  userId?: string;
  rating?: number; // filter by specific rating
  sortBy: 'recent' | 'rating' | 'relevant';
};
