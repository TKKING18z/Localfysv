import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase'; // Assuming your Firebase config is in this path

export const authService = {
  forgotPassword: async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { 
        success: true, 
        data: { message: 'Password reset email sent successfully' } 
      };
    } catch (error: any) {
      // Firebase error codes: https://firebase.google.com/docs/auth/admin/errors
      let errorMessage = 'Something went wrong. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        // Don't reveal if a user exists or not for security reasons
        // Return success anyway but no email will actually be sent
        return { 
          success: true, 
          data: { message: 'If an account exists, a password reset link will be sent.' }
        };
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'The email address is not valid.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Try again later.';
      }
      
      console.error('Firebase password reset error:', error);
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }
};