import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../nav/App';
import styles from '../design/Styles';
import { useAuth } from '../context/AuthContext';
import { getAuth } from '@react-native-firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
} from '@react-native-firebase/firestore';
import {
  getStorage,
  ref,
  getDownloadURL,
  deleteObject,
} from '@react-native-firebase/storage';
import { getEncKey, getPassphrase, removeEncKey } from '../keystore/Keystore';
import { decryptAesKey, decryptImage } from '../Utils/Encryption';
import RNFS from 'react-native-fs';

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

type Record = {
  id: string;
  name: string;
  storagePaths: string[];
  encryptedKey: string;
  keySalt: string;
  expanded: boolean;
  images: string[] | null; // null if not yet decrypted
  loadingImages: boolean;
};

const Main: React.FC<Props> = ({ navigation }) => {
  const { signOut } = useAuth();
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRecordExpanded, setNewRecordExpanded] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const loadDocuments = useCallback(async () => {
    const uid = getAuth().currentUser?.uid;
    setLoading(true);
    try {

      // Fetch documents owned by user
      const db = getFirestore();
      const q = query(collection(db, 'docsVault'), where('owner', '==', uid));
      const snapshot = await getDocs(q);

      //TODO: fetch documents shared with the user

      const docs: Record[] = snapshot.docs.map((d: any) => ({
        id: d.id,
        name: d.data().name as string,
        storagePaths: d.data().storagePaths as string[],
        encryptedKey: d.data().encryptedKey as string,
        keySalt: d.data().keySalt as string,
        expanded: false,
        images: null,
        loadingImages: false,
      }));

      setRecords(docs);

    } catch (e) {
      Alert.alert('Error', 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load documents on start
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const resolveAesKey = async (record: Record): Promise<string | null> => {
    // TODO: If any of these are absent, initiate backup from user passphrase
    const localKey = await getEncKey(record.id);
    if (localKey) { return localKey; }
    const passphrase = await getPassphrase();
    if (!passphrase) { return null; }
    return decryptAesKey(record.encryptedKey, passphrase, record.keySalt);
  };

  const toggleRecord = async (id: string) => {
    const record = records.find(r => r.id === id);
    if (!record) { return; }

    // If already expanded, just collapse with images already loaded
    if (record.expanded) {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, expanded: false } : r));
      return;
    }

    // Loads images during decryption if not yet loaded, otherwise just expands
    setRecords(prev =>
      prev.map(r => r.id === id ? { ...r, expanded: true, loadingImages: r.images === null } : r)
    );

    if (record.images !== null) { return; }

    try {
      const aesKey = await resolveAesKey(record);
      if (!aesKey) {
        Alert.alert('Error', 'Could not retrieve decryption key');
        return;
      }

      // Retrieve and decrypt images
      const decryptedImages = await Promise.all(
        record.storagePaths.map(async (storagePath) => {
          const url = await getDownloadURL(ref(getStorage(), storagePath));
          const response = await fetch(url);
          const payload: { iv: string; ciphertext: string } = await response.json();
          const base64 = decryptImage(payload.ciphertext, payload.iv, aesKey);
          return `data:image/jpeg;base64,${base64}`;
        })
      );

      // Sets images to records
      setRecords(prev =>
        prev.map(r => r.id === id ? { ...r, images: decryptedImages, loadingImages: false } : r)
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to decrypt document');
    }
  };

  const downloadRecord = async (record: Record) => {
    if (!record.images || record.images.length === 0) {
      Alert.alert('Not ready', 'Expand the record first to load images');
      return;
    }
    try {
      const basePath = Platform.OS === 'android'
        ? RNFS.DownloadDirectoryPath
        : RNFS.DocumentDirectoryPath;

      const safeName = record.name.replace(/[^a-zA-Z0-9_-]/g, '_');

      for (let i = 0; i < record.images.length; i++) {
        const base64Data = record.images[i].replace(/^data:image\/\w+;base64,/, '');
        const fileName = `${safeName}_${i + 1}.jpg`;
        await RNFS.writeFile(`${basePath}/${fileName}`, base64Data, 'base64');
      }

      const label = Platform.OS === 'android' ? 'Downloads' : 'Files (Documents)';
      Alert.alert('Downloaded', `${record.images.length} image(s), saved to ${label}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to save files: ' + (e as Error).message);
    }
  };

  const deleteRecord = (record: Record) => {
    Alert.alert(
      'Delete Record',
      `Are you sure you want to delete "${record.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const storage = getStorage();
              await Promise.all(
                record.storagePaths.map(p =>
                  deleteObject(ref(storage, p)).catch(() => {})
                )
              );
              await deleteDoc(doc(getFirestore(), 'docsVault', record.id));
              await removeEncKey(record.id);
              setRecords(prev => prev.filter(r => r.id !== record.id));
            } catch (e) {
              Alert.alert('Error', 'Failed to delete document');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity>
            <Image source={require('../assets/notificationPassiveIcon.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={loadDocuments}>
            <Image source={require('../assets/reloadIcon.png')} style={styles.headerIcon} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAccountMenuOpen(prev => !prev)}>
            <Image source={require('../assets/userIcon.png')} style={styles.headerIcon} />
          </TouchableOpacity>
        </View>
      </View>

      {accountMenuOpen && (
        <View style={styles.accountMenu}>
          <TouchableOpacity style={styles.accountMenuItem} onPress={signOut}>
            <Text style={styles.accountMenuText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#3597ff" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Record List */}
          {records.map(record => (
            <View key={record.id} style={styles.recordCard}>
              <TouchableOpacity style={styles.recordRow} onPress={() => toggleRecord(record.id)}>
                <Image
                  source={require('../assets/dropdownIcon.png')}
                  style={[styles.dropdownIcon, record.expanded && styles.dropdownIconExpanded]}
                />
                <Text style={styles.recordName}>{record.name}</Text>
                {record.expanded && (
                  <View style={styles.recordActions}>
                    <TouchableOpacity onPress={() => deleteRecord(record)}>
                      <Image source={require('../assets/deleteIcon.png')} style={styles.actionIcon} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => downloadRecord(record)}>
                      <Image source={require('../assets/downloadIcon.png')} style={styles.actionIcon} />
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>

              {record.expanded && (
                record.loadingImages ? (
                  <View style={styles.recordImagesLoading}>
                    <ActivityIndicator size="small" color="#3597ff" />
                  </View>
                ) : record.images && record.images.length > 0 ? (
                  <View style={styles.imageGridExpanded}>
                    {record.images.map((uri, index) => (
                      <View key={index} style={styles.imageGridCell}>
                        <Image source={{ uri }} style={styles.imageGridThumb} />
                      </View>
                    ))}
                  </View>
                ) : null
              )}
            </View>
          ))}

          {/* New Record */}
          <View style={styles.newRecordCard}>
            <TouchableOpacity
              style={styles.recordRow}
              onPress={() => setNewRecordExpanded(!newRecordExpanded)}
            >
              <Image
                source={require('../assets/dropdownIcon.png')}
                style={[styles.dropdownIcon, newRecordExpanded && styles.dropdownIconExpanded]}
              />
              <Text style={styles.newRecordText}>New Record</Text>
            </TouchableOpacity>

            {newRecordExpanded && (
              <View style={styles.newRecordButtons}>
                <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('UploadDocument')}>
                  <Image source={require('../assets/uploadIcon.png')} style={styles.actionButtonIcon} />
                  <Text style={styles.actionButtonText}>Upload</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Image source={require('../assets/checkIcon.png')} style={styles.actionButtonIcon} />
                  <Text style={styles.actionButtonText}>Request</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default Main;
