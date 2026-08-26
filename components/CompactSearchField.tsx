import { Platform, Pressable, TextInput as RNTextInput, View } from 'react-native';
import { Icon } from 'react-native-paper';

import { GM } from '@/lib/guildmaster-theme';

/** Match titleSmall row height; Icon outside Paper TextInput (web Affix often invisible). */
export const COMPACT_SEARCH_FIELD_HEIGHT = 28;

type CompactSearchFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Taller field for filter cards (events). */
  height?: number;
};

export function CompactSearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  height = COMPACT_SEARCH_FIELD_HEIGHT,
}: CompactSearchFieldProps) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 112,
        height,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: GM.outline,
        backgroundColor: GM.white,
      }}>
      <Icon source="magnify" size={16} color={GM.black} />
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#444444"
        style={[
          {
            flex: 1,
            paddingVertical: 0,
            paddingHorizontal: 0,
            margin: 0,
            height: height - 2,
            color: GM.black,
            fontSize: 13,
            backgroundColor: GM.white,
          },
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
        ]}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityLabel="Clear search"
          hitSlop={8}>
          <Icon source="close" size={16} color={GM.black} />
        </Pressable>
      ) : null}
    </View>
  );
}
