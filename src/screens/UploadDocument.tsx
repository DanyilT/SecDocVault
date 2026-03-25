import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../nav/App';
import styles from '../design/Styles';

type Props = NativeStackScreenProps<RootStackParamList, 'UploadDocument'>;

const UploadDocument: React.FC<Props> = ({ navigation }) => {
  const [recordName, setRecordName] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const handlePickFile = () => {
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

      <View style={styles.uploadContent}>
        {/* Record Name */}
        <Text style={styles.inputFieldDescription}>Document Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Passport"
          value={recordName}
          onChangeText={setRecordName}
        />

        {/* File Picker Area */}
        <Text style={styles.inputFieldDescription}>Document</Text>
        <TouchableOpacity style={styles.uploadArea} onPress={handlePickFile}>
          <Image source={require('../assets/uploadIcon.png')} style={styles.uploadAreaIcon} />
          <Text style={styles.uploadAreaText}>
            {selectedFile ? selectedFile : 'Tap to select a file'}
          </Text>
        </TouchableOpacity>

        {/* Upload Button */}
        <TouchableOpacity
          style={[styles.buttonPrimary, (!recordName || !selectedFile) && styles.buttonDisabled]}
          onPress={handleUpload}
          disabled={!recordName || !selectedFile}
        >
          <Text style={styles.buttonPrimaryText}>Upload</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default UploadDocument;
