#!/usr/bin/env python3
"""
Ejemplo rápido de uso de la simulación Lagrangiana
"""

from src.lagrangian_trading import LagrangianTradingSimulator, MarketSimulator
from src.visualizer import LagrangianVisualizer
import matplotlib.pyplot as plt

# 1. Crear simuladores
market = MarketSimulator(
    initial_price=100.0,
    drift=0.0002,
    volatility=0.02,
    dt=0.1
)

trader = LagrangianTradingSimulator(
    initial_cash=10000.0,
    risk_aversion=0.5,  # 0=agresivo, 1=conservador
    momentum_factor=1.0,
    transaction_cost=0.001
)

# 2. Ejecutar simulación
print("Ejecutando simulación...")
for i in range(500):
    market_state = market.step()
    trader.step(market_state)

    if (i + 1) % 100 == 0:
        pnl = trader.history[-1]['pnl']
        L = trader.history[-1]['lagrangian']
        print(f"Paso {i+1}: P&L=${pnl:+.2f}, L={L:.2f}")

# 3. Obtener resultados
df = trader.get_history_df()
print(f"\nResultados finales:")
print(f"P&L: ${df['pnl'].iloc[-1]:+.2f}")
print(f"Trades: {len(df[df['action'] != 'HOLD'])}")

# 4. Visualizar
visualizer = LagrangianVisualizer()
visualizer.plot_static(df)
plt.show()
