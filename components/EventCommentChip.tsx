import { View } from 'react-native';
import { Chip, Icon, Text, TouchableRipple } from 'react-native-paper';

import { GM, commentChipClass, commentChipTextClass } from '@/lib/guildmaster-theme';

type EventCommentChipProps = {
  label: string;
  onPress: () => void;
  muted?: boolean;
};

export function EventCommentChip({ label, onPress, muted = false }: EventCommentChipProps) {
  if (muted) {
    return (
      <Chip
        compact
        icon="comment-text-outline"
        onPress={onPress}
        className={commentChipClass}
        textStyle={{ color: GM.accentSoft, fontWeight: '600', flexShrink: 1 }}>
        View comment
      </Chip>
    );
  }

  return (
    <View className={`${commentChipClass} self-stretch`}>
      <TouchableRipple onPress={onPress} borderless style={{ borderRadius: 16 }}>
        <View className="flex-row items-start py-2 pl-1 pr-2">
          <View className="p-1 pl-2">
            <Icon source="comment-text-outline" size={18} color={GM.primary} />
          </View>
          <Text
            variant="labelLarge"
            className={`mt-1.5 mr-2 flex-1 shrink ${commentChipTextClass}`}>
            {label}
          </Text>
        </View>
      </TouchableRipple>
    </View>
  );
}
