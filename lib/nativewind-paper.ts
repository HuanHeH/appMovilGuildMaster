import { cssInterop } from 'nativewind';
import { Card, Chip, List, Text as PaperText, TextInput, TouchableRipple } from 'react-native-paper';

/** Wire Paper surfaces so className maps to style (tokens live in global.css). */
cssInterop(Card, { className: 'style' });
cssInterop(Chip, { className: 'style', textClassName: 'textStyle' });
cssInterop(PaperText, { className: 'style' });
cssInterop(TextInput, { className: 'style' });
cssInterop(TouchableRipple, { className: 'style' });
cssInterop(List.Accordion, { className: 'style' });
