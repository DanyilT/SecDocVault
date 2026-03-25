import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../nav/App';
import styles from '../design/Styles';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

type Record = {
  id: string;
  name: string;
  expanded: boolean;
  images: string[];
};

const initialRecords: Record[] = [
  { id: '1', name: 'Passport', expanded: false, images: ['placeholder'] },
  { id: '2', name: 'Driving Licence', expanded: false, images: ['placeholder', 'placeholder'] },
  { id: '3', name: 'Insurance', expanded: false, images: ['placeholder', 'placeholder'] },
];

const Main: React.FC<Props> = ({ navigation }) => {
  const { signOut } = useAuth();
  const [records, setRecords] = useState<Record[]>(initialRecords);
  const [newRecordExpanded, setNewRecordExpanded] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const toggleRecord = (id: string) => {
    // decryption logic would go here
    setRecords(prev =>
      prev.map(r => (r.id === id ? { ...r, expanded: !r.expanded } : r))
    );
  };

  const deleteRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
    // deletion logic would go here
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity>
            <Image source={require('../assets/notificationPassiveIcon.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity>
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
                  <TouchableOpacity onPress={() => deleteRecord(record.id)}>
                    <Image source={require('../assets/deleteIcon.png')} style={styles.actionIcon} />
                  </TouchableOpacity>
                  <TouchableOpacity>
                    <Image source={require('../assets/downloadIcon.png')} style={styles.actionIcon} />
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>

            {record.expanded && record.images.length > 0 && (
              <View style={styles.imageRow}>
                {record.images.map((_, index) => (
                  <View key={index} style={styles.imagePlaceholder} />
                ))}
              </View>
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
    </SafeAreaView>
  );
};

export default Main;
