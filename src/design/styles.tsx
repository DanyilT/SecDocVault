import {
  StyleSheet,
} from 'react-native';

const styles = StyleSheet.create({
  /*authentication*/
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
    color: '#474646',
  },
  inputFieldDescription: {
    fontSize: 16,
    textAlign: 'left',
    marginBottom: 10,
    marginLeft: 5,
    color: '#6c757e',
  },
  input: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  buttonPrimary: {
    height: 50,
    backgroundColor: '#3597ff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonSecondary: {
    height: 50,
    backgroundColor: '#6c757e',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonLink: {
    color: '#007AFF',
    fontSize: 14,
    marginTop: 25,
    marginBottom: 20,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  /*main*/
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
  },
  headerIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  dropdownIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    marginRight: 12,
  },
  dropdownIconExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  recordName: {
    flex: 1,
    fontSize: 16,
    color: '#474646',
  },
  recordActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  imageRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  imagePlaceholder: {
    width: 100,
    height: 80,
    backgroundColor: '#ddd',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbb',
  },
  newRecordCard: {
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
    marginTop: 8,
  },
  newRecordText: {
    flex: 1,
    fontSize: 16,
    color: '#474646',
    textAlign: 'center',
  },
  newRecordButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  actionButtonIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#474646',
    fontWeight: '500',
  },
  accountMenu: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    zIndex: 100,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  accountMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  accountMenuText: {
    fontSize: 16,
    color: '#e53935',
  },
});

export default styles;