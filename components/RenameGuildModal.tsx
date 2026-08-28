import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Divider, HelperText, Modal, Portal, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';

import { apiErrorMessage, updateGuildName } from '@/lib/api';

export function RenameGuildModal({
  guildId,
  guildName,
  visible,
  onDismiss,
  onRenamed,
}: {
  guildId: number | null;
  guildName: string;
  visible: boolean;
  onDismiss: () => void;
  onRenamed: (newName: string) => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState('');

  useEffect(() => {
    if (visible) {
      setName(guildName);
      setSnackbar('');
    }
  }, [visible, guildName]);

  const onSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setSnackbar('Name is required.');
      return;
    }
    if (guildId === null) return;
    if (trimmed === guildName) {
      onDismiss();
      return;
    }
    try {
      setSubmitting(true);
      await updateGuildName(guildId, trimmed);
      onRenamed(trimmed);
      onDismiss();
    } catch (error) {
      setSnackbar(apiErrorMessage(error, 'Could not rename guild.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Portal>
        <Modal
          visible={visible}
          onDismiss={onDismiss}
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
            Rename guild
          </Text>
          <Text style={{ fontSize: 13, color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
            Edit the display name of this guild.
          </Text>
          <Divider style={{ marginBottom: 16 }} />
          <TextInput
            mode="outlined"
            label="Guild name"
            value={name}
            onChangeText={setName}
            maxLength={120}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
          />
          <HelperText type="info" visible>
            Up to 120 characters.
          </HelperText>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <Button onPress={onDismiss} textColor={theme.colors.onSurfaceVariant}>
              Cancel
            </Button>
            <Button mode="contained" onPress={onSubmit} loading={submitting} disabled={submitting}>
              Save
            </Button>
          </View>
        </Modal>
      </Portal>
      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar('')} duration={3500}>
        {snackbar}
      </Snackbar>
    </>
  );
}
