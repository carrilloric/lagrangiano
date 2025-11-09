# Lagrangiano: Simulación Interactiva de Trading

Una simulación interactiva que muestra exactamente cómo funciona el **Lagrangiano** aplicado al trading. Este proyecto demuestra los principios de la mecánica Lagrangiana en el contexto de mercados financieros.

## ¿Qué es el Lagrangiano?

En física clásica, el **Lagrangiano** es una función que describe la dinámica de un sistema:

```
L = T - V
```

donde:
- **T** = Energía Cinética (movimiento, momentum)
- **V** = Energía Potencial (posición, fuerzas conservativas)

El **Principio de Mínima Acción** establece que un sistema evoluciona a lo largo de la trayectoria que minimiza la integral del Lagrangiano (llamada "acción"):

```
S = ∫ L dt
```

## Lagrangiano en Trading

Esta simulación adapta el formalismo Lagrangiano al trading:

### Energía Cinética (T) - Momentum del Mercado

Representa la **oportunidad** de trading basada en el movimiento del mercado:

```python
T = ½ × m × v²
```

donde:
- `m` = masa efectiva (volumen del mercado × factor de momentum)
- `v` = velocidad del precio (tasa de cambio)

**Interpretación**: Un T alto indica fuerte momentum → oportunidad para trading

### Energía Potencial (V) - Riesgo de la Posición

Representa el **riesgo** asociado con la posición actual:

```python
V = ½ × k × x²
```

donde:
- `k` = constante de "resorte" (aversión al riesgo × volatilidad)
- `x` = exposición al mercado (acciones × precio)

**Interpretación**: Un V alto indica alto riesgo → necesidad de reducir exposición

### El Lagrangiano (L)

```python
L = T - V = (momentum) - (riesgo)
```

**Toma de Decisiones**:
- `L > 0`: El momentum supera el riesgo → **favorable** para trading
- `L < 0`: El riesgo supera el momentum → **desfavorable** para trading

El algoritmo usa el principio de acción mínima para optimizar las decisiones de compra/venta, buscando maximizar L a lo largo del tiempo.

## Características

- **Motor de Simulación Lagrangiana**: Implementación completa del formalismo Lagrangiano para trading
- **Visualización Interactiva**: Gráficos en tiempo real de todas las métricas clave
- **Mercado Realista**: Simulación de precios usando movimiento Browniano geométrico
- **Múltiples Estrategias**: Comparación de diferentes niveles de aversión al riesgo
- **Análisis de Espacio de Fases**: Visualización de la dinámica del sistema

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/carrilloric/lagrangiano.git
cd lagrangiano

# Instalar dependencias
pip install -r requirements.txt
```

## Uso Rápido

### Simulación Simple

```bash
python examples/simple_simulation.py
```

Esto ejecutará una simulación de 500 pasos mostrando:
- Evolución del precio del mercado
- Decisiones de trading (BUY/SELL/HOLD)
- Energía cinética y potencial
- El Lagrangiano en tiempo real
- P&L y valor del portfolio

### Opciones Avanzadas

```bash
# Simulación con parámetros personalizados
python examples/simple_simulation.py --steps 1000 --cash 50000 --risk 0.3

# Con animación (más lento pero visual)
python examples/simple_simulation.py --animate

# Comparar diferentes estrategias
python examples/simple_simulation.py --mode comparison
```

### Parámetros

- `--steps`: Número de pasos de tiempo (default: 500)
- `--cash`: Capital inicial en dólares (default: 10000)
- `--risk`: Aversión al riesgo de 0 a 1 (default: 0.5)
  - `0.1`: Agresivo (bajo riesgo percibido)
  - `0.5`: Moderado
  - `0.9`: Conservador (alto riesgo percibido)
- `--animate`: Mostrar animación en tiempo real
- `--mode`: Modo de simulación (`simple` o `comparison`)

## Uso Programático

```python
from src.lagrangian_trading import LagrangianTradingSimulator, MarketSimulator
from src.visualizer import LagrangianVisualizer

# Crear simuladores
market = MarketSimulator(
    initial_price=100.0,
    drift=0.0002,
    volatility=0.02,
    dt=0.1
)

trader = LagrangianTradingSimulator(
    initial_cash=10000.0,
    risk_aversion=0.5,
    momentum_factor=1.0,
    transaction_cost=0.001
)

# Ejecutar simulación
for _ in range(500):
    market_state = market.step()
    trader.step(market_state)

# Obtener resultados
df = trader.get_history_df()

# Visualizar
visualizer = LagrangianVisualizer()
visualizer.plot_static(df)
visualizer.show()
```

## Estructura del Proyecto

```
lagrangiano/
├── src/
│   ├── __init__.py
│   ├── lagrangian_trading.py   # Motor de simulación Lagrangiana
│   └── visualizer.py            # Visualización interactiva
├── examples/
│   ├── __init__.py
│   └── simple_simulation.py    # Ejemplo de uso
├── requirements.txt
├── .gitignore
└── README.md
```

## Visualizaciones

La simulación genera múltiples visualizaciones:

### 1. Precio del Mercado y Posición
- Muestra el precio del activo a lo largo del tiempo
- Indica las acciones poseídas
- Marca los puntos de compra (▲) y venta (▼)

### 2. Energías (T y V)
- Energía Cinética (T): momentum del mercado
- Energía Potencial (V): riesgo de la posición

### 3. Lagrangiano (L = T - V)
- Valores positivos (verde): condiciones favorables
- Valores negativos (rojo): condiciones desfavorables

### 4. Valor del Portfolio
- Evolución del valor total de la posición

### 5. Profit & Loss (P&L)
- Ganancia/pérdida acumulada

### 6. Espacio de Fases
- Diagrama precio vs velocidad
- Trayectoria en espacio de posición
- Análisis T vs V

## Interpretación de Resultados

### Métricas Clave

- **P&L Final**: Ganancia o pérdida total
- **Retorno**: Porcentaje de ganancia sobre capital inicial
- **Número de Trades**: Frecuencia de operaciones
- **Lagrangiano Promedio**: Indica si el mercado fue favorable en general
- **Tiempo en L > 0**: Porcentaje del tiempo en condiciones favorables

### Estrategias

**Baja Aversión al Riesgo (0.1-0.3)**
- Más trades
- Mayor exposición al mercado
- Mayor P&L potencial pero más volátil

**Aversión Moderada (0.4-0.6)**
- Balance entre oportunidad y riesgo
- Frecuencia moderada de trades
- Resultados más consistentes

**Alta Aversión al Riesgo (0.7-0.9)**
- Pocos trades
- Baja exposición
- P&L más estable pero menor

## Conceptos Físicos vs Trading

| Física | Trading |
|--------|---------|
| Posición (q) | Número de acciones |
| Velocidad (q̇) | Velocidad del precio |
| Masa (m) | Volumen del mercado |
| Energía Cinética (T) | Momentum/Oportunidad |
| Energía Potencial (V) | Riesgo |
| Lagrangiano (L) | Balance oportunidad-riesgo |
| Acción (S) | Integral del balance en el tiempo |
| Principio de Mínima Acción | Optimización de decisiones |

## Limitaciones y Extensiones

### Limitaciones Actuales

- Modelo simplificado de mercado (no incluye microestructura)
- Sin consideración de spread bid-ask
- Tamaño de orden fijo
- Sin restricciones de margen o apalancamiento
- Costos de transacción simplificados

### Extensiones Posibles

- Múltiples activos (portfolio optimization)
- Órdenes límite y stop-loss
- Análisis de sensibilidad paramétrica
- Backtesting con datos reales
- Machine learning para estimar parámetros
- Restricciones de capital y apalancamiento

## Fundamentos Matemáticos

### Ecuaciones de Euler-Lagrange

En mecánica Lagrangiana, las ecuaciones de movimiento se derivan de:

```
d/dt(∂L/∂q̇) - ∂L/∂q = 0
```

En este sistema de trading:
- La derivada con respecto a q̇ (velocidad de cambio de posición) determina el momentum
- La derivada con respecto a q (posición) determina la fuerza del "resorte" de riesgo

### Principio de Acción Mínima

El sistema busca trayectorias que minimizan:

```
S = ∫[t1 to t2] L(q, q̇, t) dt
```

Esto se traduce en decisiones de trading que balancean:
- Aprovechar momentum (maximizar T)
- Minimizar riesgo (minimizar V)

## Referencias

- Goldstein, H. "Classical Mechanics" - Formalismo Lagrangiano
- Hull, J. "Options, Futures, and Other Derivatives" - Modelos de mercado
- Movimiento Browniano Geométrico para precios de activos
- Teoría de portfolio y optimización

## Contribuciones

Las contribuciones son bienvenidas! Por favor:

1. Fork el repositorio
2. Crea una branch para tu feature
3. Commit tus cambios
4. Push a la branch
5. Abre un Pull Request

## Licencia

MIT License

## Autor

Este proyecto es una demostración educativa de cómo los principios de física pueden aplicarse al trading cuantitativo.

---

**Nota**: Esta simulación es solo para fines educativos y de investigación. No constituye asesoramiento financiero. El trading de instrumentos financieros conlleva riesgos significativos.
