"""
Visualizador Interactivo para la Simulación Lagrangiana

Este módulo proporciona visualización en tiempo real de:
- Precio del mercado y posición del trader
- Energía cinética (momentum) y potencial (riesgo)
- El Lagrangiano (T - V)
- Valor del portfolio y P&L
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
from matplotlib.gridspec import GridSpec
from typing import List, Dict
import pandas as pd


class LagrangianVisualizer:
    """Visualizador interactivo para la simulación Lagrangiana"""

    def __init__(self, figsize=(15, 10)):
        """
        Inicializa el visualizador

        Args:
            figsize: Tamaño de la figura (ancho, alto)
        """
        self.figsize = figsize
        self.fig = None
        self.axes = {}
        self.lines = {}
        self.colors = {
            'price': '#2E86AB',
            'kinetic': '#A23B72',
            'potential': '#F18F01',
            'lagrangian': '#C73E1D',
            'portfolio': '#06A77D',
            'pnl': '#D4AF37',
            'buy': '#00CC66',
            'sell': '#FF4444',
            'hold': '#AAAAAA'
        }

    def setup_figure(self):
        """Configura la figura con múltiples subplots"""
        self.fig = plt.figure(figsize=self.figsize)
        self.fig.suptitle('Simulación Lagrangiana de Trading',
                         fontsize=16, fontweight='bold')

        # Crear grid de subplots
        gs = GridSpec(3, 2, figure=self.fig, hspace=0.3, wspace=0.3)

        # 1. Precio del mercado y posición
        self.axes['price'] = self.fig.add_subplot(gs[0, :])
        self.axes['price'].set_title('Precio del Mercado y Acciones Poseídas')
        self.axes['price'].set_xlabel('Tiempo')
        self.axes['price'].set_ylabel('Precio', color=self.colors['price'])
        self.axes['price'].grid(True, alpha=0.3)
        self.axes['price'].tick_params(axis='y', labelcolor=self.colors['price'])

        # Eje secundario para shares
        self.axes['shares'] = self.axes['price'].twinx()
        self.axes['shares'].set_ylabel('Acciones', color=self.colors['portfolio'])
        self.axes['shares'].tick_params(axis='y', labelcolor=self.colors['portfolio'])

        # 2. Energías (cinética y potencial)
        self.axes['energy'] = self.fig.add_subplot(gs[1, 0])
        self.axes['energy'].set_title('Energía Cinética (T) vs Potencial (V)')
        self.axes['energy'].set_xlabel('Tiempo')
        self.axes['energy'].set_ylabel('Energía')
        self.axes['energy'].grid(True, alpha=0.3)
        self.axes['energy'].legend()

        # 3. Lagrangiano
        self.axes['lagrangian'] = self.fig.add_subplot(gs[1, 1])
        self.axes['lagrangian'].set_title('Lagrangiano (L = T - V)')
        self.axes['lagrangian'].set_xlabel('Tiempo')
        self.axes['lagrangian'].set_ylabel('L')
        self.axes['lagrangian'].grid(True, alpha=0.3)
        self.axes['lagrangian'].axhline(y=0, color='black', linestyle='--', alpha=0.5)

        # 4. Valor del Portfolio
        self.axes['portfolio'] = self.fig.add_subplot(gs[2, 0])
        self.axes['portfolio'].set_title('Valor del Portfolio')
        self.axes['portfolio'].set_xlabel('Tiempo')
        self.axes['portfolio'].set_ylabel('Valor ($)')
        self.axes['portfolio'].grid(True, alpha=0.3)

        # 5. P&L (Profit and Loss)
        self.axes['pnl'] = self.fig.add_subplot(gs[2, 1])
        self.axes['pnl'].set_title('Profit & Loss (P&L)')
        self.axes['pnl'].set_xlabel('Tiempo')
        self.axes['pnl'].set_ylabel('P&L ($)')
        self.axes['pnl'].grid(True, alpha=0.3)
        self.axes['pnl'].axhline(y=0, color='black', linestyle='--', alpha=0.5)

    def plot_static(self, df: pd.DataFrame):
        """
        Crea una visualización estática completa de la simulación

        Args:
            df: DataFrame con el historial de la simulación
        """
        self.setup_figure()

        time = df['time'].values

        # 1. Precio y Shares
        line1 = self.axes['price'].plot(time, df['price'].values,
                                        color=self.colors['price'],
                                        linewidth=2, label='Precio')[0]

        line2 = self.axes['shares'].plot(time, df['shares'].values,
                                         color=self.colors['portfolio'],
                                         linewidth=2, label='Acciones',
                                         linestyle='--')[0]

        # Marcar trades
        buy_mask = df['action'] == 'BUY'
        sell_mask = df['action'] == 'SELL'

        self.axes['price'].scatter(df[buy_mask]['time'], df[buy_mask]['price'],
                                  color=self.colors['buy'], marker='^', s=100,
                                  label='BUY', zorder=5)
        self.axes['price'].scatter(df[sell_mask]['time'], df[sell_mask]['price'],
                                  color=self.colors['sell'], marker='v', s=100,
                                  label='SELL', zorder=5)

        self.axes['price'].legend(loc='upper left')
        self.axes['shares'].legend(loc='upper right')

        # 2. Energías
        self.axes['energy'].plot(time, df['kinetic_energy'].values,
                                color=self.colors['kinetic'],
                                linewidth=2, label='Cinética (T)')
        self.axes['energy'].plot(time, df['potential_energy'].values,
                                color=self.colors['potential'],
                                linewidth=2, label='Potencial (V)')
        self.axes['energy'].legend()
        self.axes['energy'].fill_between(time, df['kinetic_energy'].values,
                                        alpha=0.3, color=self.colors['kinetic'])
        self.axes['energy'].fill_between(time, df['potential_energy'].values,
                                        alpha=0.3, color=self.colors['potential'])

        # 3. Lagrangiano
        self.axes['lagrangian'].plot(time, df['lagrangian'].values,
                                    color=self.colors['lagrangian'],
                                    linewidth=2, label='L = T - V')
        self.axes['lagrangian'].fill_between(time, df['lagrangian'].values, 0,
                                            where=df['lagrangian'].values >= 0,
                                            alpha=0.3, color='green',
                                            label='Favorable')
        self.axes['lagrangian'].fill_between(time, df['lagrangian'].values, 0,
                                            where=df['lagrangian'].values < 0,
                                            alpha=0.3, color='red',
                                            label='Desfavorable')
        self.axes['lagrangian'].legend()

        # 4. Portfolio Value
        self.axes['portfolio'].plot(time, df['portfolio_value'].values,
                                   color=self.colors['portfolio'],
                                   linewidth=2)
        self.axes['portfolio'].fill_between(time, df['portfolio_value'].values,
                                           alpha=0.3, color=self.colors['portfolio'])

        # Línea del valor inicial
        initial_value = df['portfolio_value'].iloc[0]
        self.axes['portfolio'].axhline(y=initial_value, color='black',
                                      linestyle='--', alpha=0.5,
                                      label=f'Inicial: ${initial_value:.2f}')
        self.axes['portfolio'].legend()

        # 5. P&L
        self.axes['pnl'].plot(time, df['pnl'].values,
                             color=self.colors['pnl'],
                             linewidth=2)
        self.axes['pnl'].fill_between(time, df['pnl'].values, 0,
                                     where=df['pnl'].values >= 0,
                                     alpha=0.3, color='green')
        self.axes['pnl'].fill_between(time, df['pnl'].values, 0,
                                     where=df['pnl'].values < 0,
                                     alpha=0.3, color='red')

        # Estadísticas finales
        final_pnl = df['pnl'].iloc[-1]
        max_drawdown = df['pnl'].min()
        max_gain = df['pnl'].max()

        stats_text = f'Final P&L: ${final_pnl:.2f}\n'
        stats_text += f'Max Ganancia: ${max_gain:.2f}\n'
        stats_text += f'Max Pérdida: ${max_drawdown:.2f}'

        self.axes['pnl'].text(0.02, 0.98, stats_text,
                             transform=self.axes['pnl'].transAxes,
                             verticalalignment='top',
                             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

        plt.tight_layout()
        return self.fig

    def create_animation(self, df: pd.DataFrame, interval: int = 50):
        """
        Crea una animación de la simulación

        Args:
            df: DataFrame con el historial
            interval: Intervalo entre frames en ms
        """
        self.setup_figure()

        def init():
            """Inicializa la animación"""
            self.lines['price'], = self.axes['price'].plot([], [],
                                                           color=self.colors['price'],
                                                           linewidth=2, label='Precio')
            self.lines['shares'], = self.axes['shares'].plot([], [],
                                                             color=self.colors['portfolio'],
                                                             linewidth=2, label='Acciones',
                                                             linestyle='--')
            self.lines['kinetic'], = self.axes['energy'].plot([], [],
                                                              color=self.colors['kinetic'],
                                                              linewidth=2, label='Cinética (T)')
            self.lines['potential'], = self.axes['energy'].plot([], [],
                                                                color=self.colors['potential'],
                                                                linewidth=2, label='Potencial (V)')
            self.lines['lagrangian'], = self.axes['lagrangian'].plot([], [],
                                                                     color=self.colors['lagrangian'],
                                                                     linewidth=2, label='L')
            self.lines['portfolio'], = self.axes['portfolio'].plot([], [],
                                                                   color=self.colors['portfolio'],
                                                                   linewidth=2)
            self.lines['pnl'], = self.axes['pnl'].plot([], [],
                                                       color=self.colors['pnl'],
                                                       linewidth=2)

            self.axes['price'].legend()
            self.axes['shares'].legend()
            self.axes['energy'].legend()

            return list(self.lines.values())

        def update(frame):
            """Actualiza cada frame de la animación"""
            idx = min(frame, len(df) - 1)
            current_df = df.iloc[:idx+1]

            time = current_df['time'].values

            # Actualizar líneas
            self.lines['price'].set_data(time, current_df['price'].values)
            self.lines['shares'].set_data(time, current_df['shares'].values)
            self.lines['kinetic'].set_data(time, current_df['kinetic_energy'].values)
            self.lines['potential'].set_data(time, current_df['potential_energy'].values)
            self.lines['lagrangian'].set_data(time, current_df['lagrangian'].values)
            self.lines['portfolio'].set_data(time, current_df['portfolio_value'].values)
            self.lines['pnl'].set_data(time, current_df['pnl'].values)

            # Ajustar límites de los ejes
            for ax_name, ax in self.axes.items():
                if ax_name not in ['shares']:
                    ax.relim()
                    ax.autoscale_view()

            return list(self.lines.values())

        anim = FuncAnimation(self.fig, update, init_func=init,
                           frames=len(df), interval=interval,
                           blit=True, repeat=True)

        return anim

    def save_figure(self, filename: str = 'lagrangian_simulation.png', dpi: int = 150):
        """Guarda la figura actual"""
        if self.fig:
            self.fig.savefig(filename, dpi=dpi, bbox_inches='tight')
            print(f"Figura guardada en: {filename}")

    def show(self):
        """Muestra la visualización"""
        if self.fig:
            plt.show()


def plot_phase_space(df: pd.DataFrame, figsize=(10, 8)):
    """
    Crea un diagrama de espacio de fases (position vs velocity)

    Args:
        df: DataFrame con el historial
        figsize: Tamaño de la figura
    """
    fig, axes = plt.subplots(2, 2, figsize=figsize)
    fig.suptitle('Análisis de Espacio de Fases', fontsize=14, fontweight='bold')

    # 1. Precio vs Velocidad
    ax = axes[0, 0]
    scatter = ax.scatter(df['price'], df['velocity'],
                        c=df['lagrangian'], cmap='RdYlGn',
                        alpha=0.6, s=50)
    ax.set_xlabel('Precio')
    ax.set_ylabel('Velocidad del Precio')
    ax.set_title('Espacio de Fases: Precio-Velocidad')
    ax.grid(True, alpha=0.3)
    plt.colorbar(scatter, ax=ax, label='Lagrangiano')

    # 2. Shares vs Cash
    ax = axes[0, 1]
    scatter = ax.scatter(df['shares'], df['cash'],
                        c=df['time'], cmap='viridis',
                        alpha=0.6, s=50)
    ax.set_xlabel('Acciones')
    ax.set_ylabel('Cash ($)')
    ax.set_title('Trayectoria en Espacio de Posición')
    ax.grid(True, alpha=0.3)
    plt.colorbar(scatter, ax=ax, label='Tiempo')

    # 3. T vs V
    ax = axes[1, 0]
    ax.scatter(df['kinetic_energy'], df['potential_energy'],
              c=df['lagrangian'], cmap='RdYlGn',
              alpha=0.6, s=50)
    ax.set_xlabel('Energía Cinética (T)')
    ax.set_ylabel('Energía Potencial (V)')
    ax.set_title('Espacio de Energías')
    ax.grid(True, alpha=0.3)

    # Línea L = 0 (donde T = V)
    max_val = max(df['kinetic_energy'].max(), df['potential_energy'].max())
    ax.plot([0, max_val], [0, max_val], 'k--', alpha=0.5, label='L=0 (T=V)')
    ax.legend()

    # 4. Histograma de acciones
    ax = axes[1, 1]
    action_counts = df['action'].value_counts()
    colors_action = [{'BUY': '#00CC66', 'SELL': '#FF4444', 'HOLD': '#AAAAAA'}.get(a, '#CCCCCC')
                    for a in action_counts.index]
    ax.bar(action_counts.index, action_counts.values, color=colors_action, alpha=0.7)
    ax.set_xlabel('Acción')
    ax.set_ylabel('Frecuencia')
    ax.set_title('Distribución de Acciones')
    ax.grid(True, alpha=0.3, axis='y')

    # Añadir valores en las barras
    for i, (action, count) in enumerate(action_counts.items()):
        ax.text(i, count, str(count), ha='center', va='bottom')

    plt.tight_layout()
    return fig
