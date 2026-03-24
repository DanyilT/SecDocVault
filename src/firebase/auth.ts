import { getAuth, createUserWithEmailAndPassword, updateProfile, sendEmailVerification, sendPasswordResetEmail } from '@react-native-firebase/auth';
import { getFirestore, collection, doc, setDoc } from '@react-native-firebase/firestore';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out. Check your internet connection.')), ms)
    ),
  ]);
}

export async function createAccount(
  username: string,
  email: string,
  password: string,
): Promise<void> {
  // Create user
  const auth = getAuth();
  const { user } = await withTimeout(createUserWithEmailAndPassword(auth, email, password), 10000);
  
  // Send email verification
  await sendEmailVerification(user);
  
  // Add username to users table
  const db = getFirestore();
  setDoc(doc(collection(db, 'users'), user.uid), { username }).catch(console.error);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const auth = getAuth();
  await withTimeout(sendPasswordResetEmail(auth, email), 10000);
}