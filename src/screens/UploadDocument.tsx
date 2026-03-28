import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { RootStackParamList } from '../nav/App';
import styles from '../design/Styles';
import { getAuth } from '@react-native-firebase/auth';
import { generateAesKey, encryptImage, encryptAesKey } from '../Utils/Encryption';
import { getFirestore, collection, doc, setDoc } from '@react-native-firebase/firestore';
import { getStorage, ref, uploadString } from '@react-native-firebase/storage';
import { getPassphrase, saveEncKey } from '../keystore/Keystore';

type SelectedImage = { uri: string; fileName: string; base64: string };

type Props = NativeStackScreenProps<RootStackParamList, 'UploadDocument'>;

const UploadDocument: React.FC<Props> = ({ navigation }) => {
  const [recordName, setRecordName] = useState('');
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [uploading, setUploading] = useState(false);

  const MAX_IMAGES = 10;

  const handlePickImages = () => {
    const remaining = MAX_IMAGES - selectedImages.length;
    if (remaining <= 0) {
      Alert.alert('Limit reached', `You can upload ${MAX_IMAGES} images only.`);
      return;
    }
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.6, maxWidth: 1920, maxHeight: 1920, selectionLimit: remaining, includeBase64: true },
      (response) => {
        if (response.didCancel) { return; }
        if (response.errorCode) {
          Alert.alert('Error', response.errorMessage ?? 'Failed to pick images');
          return;
        }
        const newImages: SelectedImage[] = (response.assets ?? [])
          .map(a => ({
            uri: a.uri!,
            fileName: a.fileName ?? a.uri!.split('/').pop() ?? 'image',
            base64: a.base64!,
          }));
        setSelectedImages(prev => [...prev, ...newImages]);
      },
    );
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    setUploading(true);
    try {
      // Set up firebase connection
      const db = getFirestore();
      const docRef = doc(collection(db, 'docsVault'));

      //Retrieve passphrase from secure local keystore
      const passphrase = await getPassphrase();

      // Generate a single AES-256 key for all images in this document
      // Save generated key to secure local keystore
      // Encrypt generated key with the user's passphrase before saving to firestore
      const key = generateAesKey();
      await saveEncKey(docRef.id, key);
      const { encryptedKey, keySalt } = encryptAesKey(key, passphrase!);

      // Encrypt with custom iv and upload each image to firebase Storage
      const storagePaths: string[] = await Promise.all(
        selectedImages.map(async (img) => {
          const { iv, ciphertext } = encryptImage(img.base64, key);
          const storagePath = `docsVault/${docRef.id}/${img.fileName}`;
          await uploadString(ref(getStorage(), storagePath), JSON.stringify({ iv, ciphertext }));
          return storagePath;
        }),
      );

      const sharedWith: string[] = [];

      // Save metadata and storage paths to docsVault collection
      await setDoc(docRef, {
        owner: uid,
        name: recordName,
        storagePaths,
        encryptedKey,
        keySalt,
        sharedWith,
      });

      navigation.goBack();
    } catch (e) {
      Alert.alert('Upload failed', (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.uploadHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image source={require('../assets/returnIcon.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <Text style={styles.uploadHeaderTitle}>Upload Document</Text>
        <View style={styles.headerIcon} />
      </View>

      <ScrollView contentContainerStyle={styles.uploadContent}>
        {/* Record Name */}
        <Text style={styles.inputFieldDescription}>Document Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Passport"
          value={recordName}
          onChangeText={setRecordName}
        />

        {/* Image Grid */}
        <Text style={styles.inputFieldDescription}>Document</Text>
        <View style={styles.imageGrid}>
          <TouchableOpacity style={styles.imageGridAddCell} onPress={handlePickImages}>
            <Image source={require('../assets/uploadIcon.png')} style={styles.imageGridAddIcon} />
          </TouchableOpacity>
          {selectedImages.map((img, index) => (
            <View key={index} style={styles.imageGridCell}>
              <Image source={{ uri: img.uri }} style={styles.imageGridThumb} />
              <TouchableOpacity
                style={styles.imageGridDeleteButton}
                onPress={() => handleRemoveImage(index)}
              >
                <Text style={styles.imageGridDeleteText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Upload Button */}
        <TouchableOpacity
          style={[styles.buttonPrimary, (!recordName || selectedImages.length === 0 || uploading) && styles.buttonDisabled]}
          onPress={handleUpload}
          disabled={!recordName || selectedImages.length === 0 || uploading}
        >
          {uploading ? 
              <ActivityIndicator color="#fff" /> : <Text style={styles.buttonPrimaryText}>Upload</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default UploadDocument;
