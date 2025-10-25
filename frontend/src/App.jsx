import React from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { setLoading, setResultados } from './store/slices/empresasSlice'
import './App.css'

function App() {
  const dispatch = useDispatch()
  const { resultados, loading, total } = useSelector(state => state.empresas)

  const handleTeste = () => {
    dispatch(setLoading(true))
    
    // Simulando uma busca
    setTimeout(() => {
      dispatch(setResultados({
        resultados: [
          { cnpj_completo: '12.345.678/0001-90', nome_empresa: 'Empresa Teste' }
        ],
        total: 1,
        pagina_atual: 1
      }))
      dispatch(setLoading(false))
    }, 1000)
  }

  return (
    <div className="App">
      <h1>⚡ Novo Sistema P-Lead (Vite + React + Redux)</h1>
      
      <button onClick={handleTeste} disabled={loading}>
        {loading ? 'Carregando...' : 'Testar Redux'}
      </button>

      {resultados.length > 0 && (
        <div>
          <h3>Resultados: {total} empresas</h3>
          <ul>
            {resultados.map(empresa => (
              <li key={empresa.cnpj_completo}>{empresa.nome_empresa}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default App