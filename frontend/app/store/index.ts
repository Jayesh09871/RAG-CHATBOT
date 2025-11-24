import { configureStore } from "@reduxjs/toolkit";
import toggleTheme from "./slices/themeSlice";

const store = configureStore({
  reducer: {
    theme: toggleTheme,
  },
});

console.log(store.getState())
export default store;