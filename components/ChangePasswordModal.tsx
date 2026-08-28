import { useState } from 'react';
import { View } from 'react-native';
import { Button, Divider, Modal, Portal, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';

import { apiErrorMessage, changePassword } from '@/lib/api';

export function ChangePasswordModal({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState('');
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSnackbar('');
    setSuccess(false);
  };

  const onSubmit = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setSnackbar('All fields are required.');
      return;
    }
    if (newPassword.length < 4) {
      setSnackbar('New password must be at least 4 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSnackbar('New password and confirmation do not match.');
      return;
    }
    try {
      setSubmitting(true);
      await changePassword(oldPassword, newPassword, confirmPassword);
      setSuccess(true);
      setSnackbar('Password changed successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setSnackbar(apiErrorMessage(error, 'Could not change password.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onDismiss();
  };

  const bg = theme.colors.surface;
  const textColor = theme.colors.onSurface;
  const textMuted = theme.colors.onSurfaceVariant;
  const borderColor = theme.colors.outline;

  return (
    <>
      <Portal>
        <Modal
          visible={visible}
          onDismiss={handleClose}
          contentContainerStyle={{
            margin: 16,
            backgroundColor: bg,
            borderRadius: 12,
            padding: 20,
            maxWidth: 420,
            alignSelf: 'center',
            width: '100%',
          }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: textColor, marginBottom: 4 }}>
            Change Password
          </Text>
          <Text style={{ fontSize: 13, color: textMuted, marginBottom: 16 }}>
            Enter your current password and the new one twice.
          </Text>
          <Divider style={{ marginBottom: 16 }} />
          <View style={{ gap: 12 }}>
            <TextInput
              mode="outlined"
              label="Current password"
              secureTextEntry
              value={oldPassword}
              onChangeText={setOldPassword}
              outlineColor={borderColor}
              activeOutlineColor={theme.colors.primary}
            />
            <TextInput
              mode="outlined"
              label="New password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              outlineColor={borderColor}
              activeOutlineColor={theme.colors.primary}
            />
            <TextInput
              mode="outlined"
              label="Confirm new password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              outlineColor={borderColor}
              activeOutlineColor={theme.colors.primary}
              error={!!confirmPassword && newPassword !== confirmPassword}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button onPress={handleClose} textColor={textMuted}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={onSubmit}
              loading={submitting}
              disabled={submitting || success}>
              {success ? 'Changed' : 'Change password'}
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
