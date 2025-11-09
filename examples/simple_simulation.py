#!/usr/bin/env python3
"""
Simulación Simple de Trading Lagrangiano

Este script ejecuta una simulación básica que muestra cómo el Lagrangiano
guía las decisiones de trading.

Uso:
    python examples/simple_simulation.py
"""

import sys
import os

# Añadir el directorio src al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.lagrangian_trading import (
    LagrangianTradingSimulator,
    MarketSimulator
)
from src.visualizer import LagrangianVisualizer, plot_phase_space
import matplotlib.pyplot as plt


def run_simple_simulation(
    n_steps: int = 500,
    initial_cash: float = 10000.0,
    risk_aversion: float = 0.5,
    show_animation: bool = False
):
    """
    Ejecuta una simulación simple

    Args:
        n_steps: Número de pasos de tiempo
        initial_cash: Capital inicial
        risk_aversion: Factor de aversión al riesgo (0-1)
        show_animation: Si True, muestra animación (más lento)
    """
    print("=" * 70)
    print("SIMULACIÓN LAGRANGIANA DE TRADING")
    print("=" * 70)
    print()
    print("Inicializando simulación...")
    print(f"  - Capital inicial: ${initial_cash:,.2f}")
    print(f"  - Aversión al riesgo: {risk_aversion}")
    print(f"  - Pasos de tiempo: {n_steps}")
    print()

    # Crear simuladores
    market = MarketSimulator(
        initial_price=100.0,
        drift=0.0002,  # Ligera tendencia alcista
        volatility=0.02,
        dt=0.1
    )

    trader = LagrangianTradingSimulator(
        initial_cash=initial_cash,
        risk_aversion=risk_aversion,
        momentum_factor=1.0,
        transaction_cost=0.001
    )

    print("Ejecutando simulación...")

    # Ejecutar simulación
    for i in range(n_steps):
        # Obtener estado del mercado
        market_state = market.step()

        # Añadir eventos aleatorios para hacer la simulación más interesante
        if i == n_steps // 4:
            print(f"  [t={i}] Añadiendo tendencia alcista...")
            market.add_trend(0.001)
        elif i == n_steps // 2:
            print(f"  [t={i}] Shock de mercado!")
            market.add_shock(-0.05)
        elif i == 3 * n_steps // 4:
            print(f"  [t={i}] Revirtiendo tendencia...")
            market.add_trend(-0.0005)

        # Ejecutar paso del trader
        trader.step(market_state)

        # Mostrar progreso
        if (i + 1) % 100 == 0:
            current_pnl = trader.history[-1]['pnl']
            current_shares = trader.position.shares
            print(f"  Paso {i+1}/{n_steps} - P&L: ${current_pnl:+.2f}, Acciones: {current_shares:.0f}")

    print()
    print("Simulación completada!")
    print()

    # Obtener resultados
    df = trader.get_history_df()

    # Estadísticas finales
    final_pnl = df['pnl'].iloc[-1]
    max_drawdown = df['pnl'].min()
    max_gain = df['pnl'].max()
    total_trades = len(df[df['action'] != 'HOLD'])
    buy_trades = len(df[df['action'] == 'BUY'])
    sell_trades = len(df[df['action'] == 'SELL'])

    initial_price = df['price'].iloc[0]
    final_price = df['price'].iloc[-1]
    price_return = (final_price - initial_price) / initial_price * 100

    print("=" * 70)
    print("RESULTADOS FINALES")
    print("=" * 70)
    print()
    print("Mercado:")
    print(f"  Precio inicial: ${initial_price:.2f}")
    print(f"  Precio final: ${final_price:.2f}")
    print(f"  Retorno del mercado: {price_return:+.2f}%")
    print()
    print("Trading:")
    print(f"  Total de trades: {total_trades}")
    print(f"    - Compras: {buy_trades}")
    print(f"    - Ventas: {sell_trades}")
    print()
    print("Performance:")
    print(f"  P&L Final: ${final_pnl:+.2f}")
    print(f"  Retorno: {(final_pnl/initial_cash)*100:+.2f}%")
    print(f"  Máxima ganancia: ${max_gain:+.2f}")
    print(f"  Máxima pérdida: ${max_drawdown:+.2f}")
    print()

    # Métricas Lagrangianas
    avg_lagrangian = df['lagrangian'].mean()
    positive_L_pct = (df['lagrangian'] > 0).sum() / len(df) * 100

    print("Métricas Lagrangianas:")
    print(f"  Lagrangiano promedio: {avg_lagrangian:.4f}")
    print(f"  Tiempo en L > 0: {positive_L_pct:.1f}%")
    print()
    print("=" * 70)
    print()

    # Visualización
    print("Generando visualizaciones...")
    visualizer = LagrangianVisualizer(figsize=(16, 10))

    if show_animation:
        print("  Creando animación (esto puede tardar)...")
        anim = visualizer.create_animation(df, interval=20)
        plt.show()
    else:
        print("  Creando gráficos estáticos...")
        visualizer.plot_static(df)

        # Crear también el gráfico de espacio de fases
        fig_phase = plot_phase_space(df)

        print()
        print("Visualizaciones listas!")
        print("Cierra las ventanas para terminar.")
        plt.show()

    return df, trader


def run_comparison_simulations():
    """
    Ejecuta múltiples simulaciones con diferentes parámetros de riesgo
    para comparar estrategias
    """
    print("=" * 70)
    print("COMPARACIÓN DE ESTRATEGIAS")
    print("=" * 70)
    print()

    risk_levels = [0.1, 0.5, 0.9]
    results = {}

    for risk in risk_levels:
        print(f"\nEjecutando simulación con risk_aversion = {risk}...")

        market = MarketSimulator(
            initial_price=100.0,
            drift=0.0002,
            volatility=0.02,
            dt=0.1
        )

        trader = LagrangianTradingSimulator(
            initial_cash=10000.0,
            risk_aversion=risk,
            momentum_factor=1.0
        )

        # Ejecutar
        for i in range(500):
            market_state = market.step()
            trader.step(market_state)

        df = trader.get_history_df()
        final_pnl = df['pnl'].iloc[-1]
        results[risk] = {
            'df': df,
            'pnl': final_pnl,
            'trades': len(df[df['action'] != 'HOLD'])
        }

        print(f"  → P&L: ${final_pnl:+.2f}, Trades: {results[risk]['trades']}")

    # Visualizar comparación
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle('Comparación de Estrategias por Nivel de Riesgo', fontsize=14, fontweight='bold')

    colors = ['#2E86AB', '#A23B72', '#F18F01']

    # P&L
    ax = axes[0, 0]
    for i, (risk, data) in enumerate(results.items()):
        ax.plot(data['df']['time'], data['df']['pnl'],
               label=f'Risk={risk}', color=colors[i], linewidth=2)
    ax.set_title('P&L por Estrategia')
    ax.set_xlabel('Tiempo')
    ax.set_ylabel('P&L ($)')
    ax.legend()
    ax.grid(True, alpha=0.3)
    ax.axhline(y=0, color='black', linestyle='--', alpha=0.5)

    # Portfolio Value
    ax = axes[0, 1]
    for i, (risk, data) in enumerate(results.items()):
        ax.plot(data['df']['time'], data['df']['portfolio_value'],
               label=f'Risk={risk}', color=colors[i], linewidth=2)
    ax.set_title('Valor del Portfolio')
    ax.set_xlabel('Tiempo')
    ax.set_ylabel('Valor ($)')
    ax.legend()
    ax.grid(True, alpha=0.3)

    # Lagrangiano promedio
    ax = axes[1, 0]
    avg_lagrangians = [data['df']['lagrangian'].mean() for data in results.values()]
    ax.bar(range(len(risk_levels)), avg_lagrangians, color=colors, alpha=0.7)
    ax.set_title('Lagrangiano Promedio')
    ax.set_xlabel('Estrategia')
    ax.set_ylabel('L promedio')
    ax.set_xticks(range(len(risk_levels)))
    ax.set_xticklabels([f'Risk={r}' for r in risk_levels])
    ax.grid(True, alpha=0.3, axis='y')
    ax.axhline(y=0, color='black', linestyle='--', alpha=0.5)

    # Resumen
    ax = axes[1, 1]
    ax.axis('off')

    summary_text = "RESUMEN DE RESULTADOS\n" + "=" * 40 + "\n\n"
    for risk, data in results.items():
        pnl = data['pnl']
        trades = data['trades']
        ret = (pnl / 10000.0) * 100
        summary_text += f"Risk Aversion = {risk}\n"
        summary_text += f"  P&L: ${pnl:+.2f} ({ret:+.2f}%)\n"
        summary_text += f"  Trades: {trades}\n\n"

    ax.text(0.1, 0.9, summary_text, transform=ax.transAxes,
           verticalalignment='top', fontfamily='monospace',
           bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description='Simulación Lagrangiana de Trading'
    )
    parser.add_argument(
        '--mode',
        choices=['simple', 'comparison'],
        default='simple',
        help='Modo de simulación (default: simple)'
    )
    parser.add_argument(
        '--steps',
        type=int,
        default=500,
        help='Número de pasos de tiempo (default: 500)'
    )
    parser.add_argument(
        '--cash',
        type=float,
        default=10000.0,
        help='Capital inicial (default: 10000)'
    )
    parser.add_argument(
        '--risk',
        type=float,
        default=0.5,
        help='Aversión al riesgo 0-1 (default: 0.5)'
    )
    parser.add_argument(
        '--animate',
        action='store_true',
        help='Mostrar animación (más lento)'
    )

    args = parser.parse_args()

    if args.mode == 'simple':
        run_simple_simulation(
            n_steps=args.steps,
            initial_cash=args.cash,
            risk_aversion=args.risk,
            show_animation=args.animate
        )
    else:
        run_comparison_simulations()
