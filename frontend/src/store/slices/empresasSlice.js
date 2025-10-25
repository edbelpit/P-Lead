import { createSlice } from '@reduxjs/toolkit'

const empresasSlice = createSlice({
  name: 'empresas',
  initialState: {
    resultados: [],
    loading: false,
    error: null,
    total: 0,
    paginaAtual: 1,
  },
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload
    },
    setResultados: (state, action) => {
      state.resultados = action.payload.resultados || []
      state.total = action.payload.total || 0
      state.paginaAtual = action.payload.pagina_atual || 1
    },
    setError: (state, action) => {
      state.error = action.payload
    },
  },
})

export const { setLoading, setResultados, setError } = empresasSlice.actions
export default empresasSlice.reducer