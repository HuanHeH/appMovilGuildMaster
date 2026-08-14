import { View } from 'react-native';
import { Chip, Icon, Text, TouchableRipple } from 'react-native-paper';

type EventCommentChipProps = {
  label: string;
  onPress: () => void;
  muted?: boolean;
};

/** Matches common-skill purple/blue chips (e.g. alumno2). */
const PURPLE_CHIP = {
  bg: '#eff6ff',
  border: '#2563eb',
  text: '#1e40af',
  icon: '#2563eb',
} as const;

const chipFrameStyle = {
  alignSelf: 'stretch' as const,
  marginTop: 4,
  maxWidth: '100%' as const,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: PURPLE_CHIP.border,
  backgroundColor: PURPLE_CHIP.bg,
  overflow: 'hidden' as const,
};

/** View comment + open comment share the same purple chip look; open state wraps multiline text. */
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
          backgroundColor: PURPLE_CHIP.bg,
          borderWidth: 1,
          borderColor: PURPLE_CHIP.border,
        }}
        textStyle={{
          color: PURPLE_CHIP.text,
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
            <Icon source="comment-text-outline" size={18} color={PURPLE_CHIP.icon} />
          </View>
          <Text
            variant="labelLarge"
            style={{
              flex: 1,
              flexShrink: 1,
              marginTop: 6,
              marginRight: 8,
              color: PURPLE_CHIP.text,
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
