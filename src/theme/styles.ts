import { contentStyles } from './styleSections/contentStyles';
import { headerStyles } from './styleSections/headerStyles';
import { interactionStyles } from './styleSections/interactionStyles';
import { introStyles } from './styleSections/introStyles';
import { layoutStyles } from './styleSections/layoutStyles';

const mergedStyles: Record<string, any> = {
  ...layoutStyles,
  ...introStyles,
  ...headerStyles,
  ...interactionStyles,
  ...contentStyles,
};

export const styles = mergedStyles;
