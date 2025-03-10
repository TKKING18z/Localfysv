
// Adding the missing Business interface type definition

// Note: This is just the interface definition - the actual context implementation would be more complex
export interface Business {
  id: string;
  name: string;
  category: string;
  description?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    accuracy?: number;
  };
  images?: Array<{
    id: string;
    url: string;
    isMain: boolean;
  }>;
  // Add other business properties as needed
}

// Rest of your BusinessContext implementation
// ...