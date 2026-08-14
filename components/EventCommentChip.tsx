import { View } from 'react-native';
import { Chip, Icon, Text, TouchableRipple } from 'react-native-paper';

import { commentChipColors } from '@/lib/guildmaster-theme';

type EventCommentChipProps = {
  label: string;
  onPress: () => void;
  muted?: boolean;
};

const CHIP = commentChipColors;

const chipFrameStyle = {
  alignSelf: 'stretch' as const,
  marginTop: 4,
  maxWidth: '100%' as const,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: CHIP.border,
  backgroundColor: CHIP.bg,
  overflow: 'hidden' as const,
};

export function EventCommentChip({ label, onPress, muted = false }: EventCommentChipProps) {
  if (muted) {
    return (
      <Chip
        compact
        icon="comment-text-outline"
        onPress={onPress}
        style={{
          alignSelf: 'flex-start',
          marginTop: 4,
          maxWidth: '100%',
          backgroundColor: CHIP.bg,
          borderWidth: 1,
          borderColor: CHIP.border,
        }}
        textStyle={{
          color: CHIP.text,
          fontWeight: '600',
          flexShrink: 1,
        }}>
        View comment
      </Chip>
    );
  }

  return (
    <View style={chipFrameStyle}>
      <TouchableRipple onPress={onPress} borderless style={{ borderRadius: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingVertical: 8,
            paddingLeft: 4,
            paddingRight: 8,
          }}>
          <View style={{ padding: 4, paddingLeft: 8 }}>
            <Icon source="comment-text-outline" size={18} color={CHIP.icon} />
          </View>
          <Text
            variant="labelLarge"
            style={{
              flex: 1,
              flexShrink: 1,
              marginTop: 6,
              marginRight: 8,
              color: CHIP.text,
              fontWeight: '600',
              lineHeight: 20,
            }}>
            {label}
          </Text>
        </View>
      </TouchableRipple>
    </View>
  );
}
