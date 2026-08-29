import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Divider, HelperText, Modal, Portal, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';

import { apiErrorMessage, changeUserName } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

export function ChangeUsernameModal({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const session = useAuthStore((state) => state.session);
  const setSession = useAuthStore((state) => state.setSession);

  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (visible) {
      setName(session?.name ?? '');
      setSnackbarVisible(false);
      setSuccess(false);
    }
  }, [visible, session?.name]);

  const showSnackbar = (msg: string) => {
    setSnackbarMsg(msg);
    setSnackbarVisible(true);
  };

  const onSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showSnackbar('Name is required.');
      return;
    }
    if (session && trimmed === session.name) {
      showSnackbar('Name is the same as the current one.');
      return;
    }
    try {
      setSubmitting(true);
      const updated = await changeUserName(session!.id, trimmed);
      setSession({ ...session!, name: updated.name });
      setSuccess(true);
      showSnackbar('Username updated successfully.');
      setTimeout(() => onDismiss(), 1500);
    } catch (error) {
      showSnackbar(apiErrorMessage(error, 'Could not update username.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setSnackbarVisible(false);
    setSuccess(false);
    onDismiss();
  };

  if (!mounted) return null;

  return (
    <>
      <Portal>
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
            Change username
          </Text>
          <Text style={{ fontSize: 13, color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
            Choose a new display name.
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
          />
          <HelperText type="info" visible>
            Up to 100 characters.
          </HelperText>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <Button onPress={handleClose} textColor={theme.colors.onSurfaceVariant}>
              Cancel
            </Button>
            <Button mode="contained" onPress={onSubmit} loading={submitting} disabled={submitting || success}>
              {success ? 'Saved' : 'Save'}
            </Button>
          </View>
        </Modal>
      </Portal>
      {snackbarVisible ? (
        <Portal>
          <Snackbar
            visible={snackbarVisible}
            onDismiss={() => setSnackbarVisible(false)}
            duration={3000}>
            {snackbarMsg}
          </Snackbar>
        </Portal>
      ) : null}
    </>
  );
}
