import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { RootStackParamList } from '../nav/App';
import styles from '../design/Styles';

type SelectedImage = { uri: string; fileName: string };

type Props = NativeStackScreenProps<RootStackParamList, 'UploadDocument'>;

const UploadDocument: React.FC<Props> = ({ navigation }) => {
  const [recordName, setRecordName] = useState('');
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);

  const handlePickImages = () => {
    launchImageLibrary(
      { mediaType: 'photo', quality: 1, selectionLimit: 0 },
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
          }));
        setSelectedImages(prev => [...prev, ...newImages]);
      },
    );
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    navigation.goBack();
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
          style={[styles.buttonPrimary, (!recordName || selectedImages.length === 0) && styles.buttonDisabled]}
          onPress={handleUpload}
          disabled={!recordName || selectedImages.length === 0}
        >
          <Text style={styles.buttonPrimaryText}>Upload</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default UploadDocument;
