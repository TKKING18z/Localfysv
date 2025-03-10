import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../src/config/firebase';

const updateBusinessImages = async () => {
  try {
    // List all images in the business_images folder
    const imagesRef = ref(storage, 'business_images');
    const imagesList = await listAll(imagesRef);
    
    // Create a map of business ID → image URL
    const imageMap: Record<string, string> = {};
    await Promise.all(imagesList.items.map(async imageRef => {
      const url = await getDownloadURL(imageRef);
      const filename = imageRef.name;
      
      // Try to extract business ID from filename
      // For example: business_1740960236020_c1cq5q.jpg
      const match = filename.match(/business_([^_]+)/);
      if (match && match[1]) {
        imageMap[match[1]] = url;
      }
    }));
    
    // Update business documents with corresponding images
    const businessesRef = collection(db, 'businesses');
    const snapshot = await getDocs(businessesRef);
    
    snapshot.forEach(async docSnapshot => {
      const businessId = docSnapshot.id;
      const businessData = docSnapshot.data();
      
      // If there's an image for this business in the map
      if (imageMap[businessId]) {
        // Update the document with the image
        await updateDoc(doc(db, 'businesses', businessId), {
          images: [{
            id: `img-${businessId}`,
            url: imageMap[businessId],
            isMain: true
          }]
        });
        console.log(`Updated business ${businessId} with image`);
      }
    });
    
    console.log('Image migration completed');
  } catch (error) {
    console.error('Error in image migration:', error);
  }
};

// Run migration
updateBusinessImages();
