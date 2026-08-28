import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Divider,
  List,
  Modal,
  Text,
  useTheme,
} from 'react-native-paper';

import { ChangePasswordModal } from '@/components/ChangePasswordModal';

export function SettingsMenuModal({
  visible,
  onDismiss,
  onChangeUsername,
  onChangeUsernameLabel = 'Change username',
  onChangeUsernameDescription = 'Edit how you appear in the app',
  onLogout,
}: {
  visible: boolean;
  onDismiss: () => void;
  onChangeUsername: () => void;
  onChangeUsernameLabel?: string;
  onChangeUsernameDescription?: string;
  onLogout: () => void;
}) {
  const theme = useTheme();
  const [pwOpen, setPwOpen] = useState(false);

  return (
    <>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={{
          margin: 16,
          backgroundColor: theme.colors.surface,
          borderRadius: 12,
          padding: 8,
          maxWidth: 420,
          width: '100%',
          alignSelf: 'center',
        }}>
        <Text
          variant="titleMedium"
          style={{ color: theme.colors.onSurface, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
          Settings
        </Text>
        <Divider style={{ marginVertical: 4 }} />
        <List.Item
          title={onChangeUsernameLabel}
          description={onChangeUsernameDescription}
          left={(props) => <List.Icon {...props} icon="account-edit" />}
          onPress={() => {
            onDismiss();
            setTimeout(() => onChangeUsername(), 200);
          }}
        />
        <List.Item
          title="Change password"
          description="Change your account password"
          left={(props) => <List.Icon {...props} icon="lock-reset" />}
          onPress={() => {
            onDismiss();
            setTimeout(() => setPwOpen(true), 200);
          }}
        />
        <Divider style={{ marginVertical: 4 }} />
        <List.Item
          title="Log out"
          titleStyle={{ color: theme.colors.error }}
          left={(props) => <List.Icon {...props} icon="logout" color={theme.colors.error} />}
          onPress={() => {
            onDismiss();
            setTimeout(() => onLogout(), 200);
          }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 8 }}>
          <Button onPress={onDismiss}>Close</Button>
        </View>
      </Modal>
      <ChangePasswordModal visible={pwOpen} onDismiss={() => setPwOpen(false)} />
    </>
  );
}
