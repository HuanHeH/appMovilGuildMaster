import { Platform, Alert as RNAlert } from 'react-native';

export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    return;
  }
  RNAlert.alert(title, message);
}

export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      if (window.confirm(message ? `${title}\n\n${message}` : title)) {
        onConfirm();
      } else if (onCancel) {
        onCancel();
      }
    }
    return;
  }
  RNAlert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: onCancel },
    { text: 'Confirm', onPress: onConfirm },
  ]);
}
