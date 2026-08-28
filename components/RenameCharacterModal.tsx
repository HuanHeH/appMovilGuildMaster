import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Divider, HelperText, Modal, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';

import { apiErrorMessage, api } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/endpoints';
import { useCharacterStore, selectSelectedCharacter } from '@/store/character-store';

export function RenameCharacterModal({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const selectedCharacter = useCharacterStore(selectSelectedCharacter);
  const setCharacters = useCharacterStore((state) => state.setCharacters);
  const characters = useCharacterStore((state) => state.characters);

  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (visible && selectedCharacter) {
      setName(selectedCharacter.name);
      setSnackbar('');
      setSuccess(false);
    }
  }, [visible, selectedCharacter?.name]);

  const onSubmit = async () => {
    if (!selectedCharacter) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setSnackbar('Name is required.');
      return;
    }
    if (trimmed === selectedCharacter.name) {
      onDismiss();
      return;
    }
    try {
      setSubmitting(true);
      const { data } = await api.put(API_ENDPOINTS.characters.update(selectedCharacter.id), { name: trimmed });
      setCharacters(characters.map((c) => (c.id === data.id ? data : c)));
      setSuccess(true);
      setSnackbar('Character renamed successfully.');
    } catch (error) {
      setSnackbar(apiErrorMessage(error, 'Could not rename character.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setSnackbar('');
    setSuccess(false);
    onDismiss();
  };

  return (
    <>
      <Modal
        visible={visible}
        onDismiss={handleClose}
        contentContainerStyle={{
          margin: 16,
          backgroundColor: theme.colors.surface,
          borderRadius: 12,
          padding: 20,
          maxWidth: 420,
          width: '100%',
          alignSelf: 'center',
        }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 4 }}>
          Rename character
        </Text>
        <Text style={{ fontSize: 13, color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
          {selectedCharacter ? `Current name: ${selectedCharacter.name}` : 'Select a character first.'}
        </Text>
        <Divider style={{ marginBottom: 16 }} />
        <TextInput
          mode="outlined"
          label="New name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          outlineColor={theme.colors.outline}
          activeOutlineColor={theme.colors.primary}
          maxLength={100}
          disabled={!selectedCharacter}
        />
        <HelperText type="info" visible>
          Up to 100 characters.
        </HelperText>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <Button onPress={handleClose} textColor={theme.colors.onSurfaceVariant}>
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting || success || !selectedCharacter}>
            {success ? 'Saved' : 'Save'}
          </Button>
        </View>
      </Modal>
      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar('')} duration={3500}>
        {snackbar}
      </Snackbar>
    </>
  );
}
