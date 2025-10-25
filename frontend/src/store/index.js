import { configureStore } from '@reduxjs/toolkit'
import empresasReducer from './slices/empresasSlice'

export const store = configureStore({
  reducer: {
    empresas: empresasReducer,
  },
})