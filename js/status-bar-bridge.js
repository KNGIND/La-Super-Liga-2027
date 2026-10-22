// Se empaqueta a IIFE durante la compilación Android para que pueda usarse sin un bundler en la app web.
import { StatusBar, Style } from '@capacitor/status-bar';

(function (w) {
  w.LSLNativeStatusBar = {
    setStyle: function (theme) {
      return StatusBar.setStyle({ style: theme === 'light' ? Style.Light : Style.Dark });
    },
    setBackgroundColor: function (color) {
      return StatusBar.setBackgroundColor({ color: color });
    }
  };
})(window);
