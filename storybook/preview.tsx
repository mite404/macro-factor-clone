import type { Preview } from '@storybook/react-native-web-vite';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    options: { storySort: { order: ['Reference screens'] } },
  },
};

export default preview;
