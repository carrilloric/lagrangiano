"""
Motor de Simulación Lagrangiana para Trading

Este módulo implementa el formalismo Lagrangiano aplicado al trading:
- L = T - V (Lagrangiano = Energía Cinética - Energía Potencial)
- T representa el momentum del mercado (oportunidad)
- V representa el riesgo de la posición actual
- El principio de acción mínima optimiza las decisiones de trading
"""

import numpy as np
from typing import List, Tuple, Dict
from dataclasses import dataclass


@dataclass
class MarketState:
    """Estado del mercado en un momento dado"""
    time: float
    price: float
    velocity: float  # tasa de cambio del precio
    volume: float
    volatility: float


@dataclass
class TradingPosition:
    """Posición de trading actual"""
    shares: float  # número de acciones (positivo=long, negativo=short)
    entry_price: float
    cash: float

    def get_total_value(self, current_price: float) -> float:
        """Calcula el valor total de la posición"""
        return self.cash + self.shares * current_price

    def get_pnl(self, current_price: float, initial_value: float) -> float:
        """Calcula el profit and loss"""
        return self.get_total_value(current_price) - initial_value


class LagrangianTradingSimulator:
    """
    Simulador de trading basado en mecánica Lagrangiana

    El Lagrangiano en trading se define como:
    L(q, q̇, t) = T(q̇) - V(q)

    donde:
    - q = posición en el mercado (número de acciones)
    - q̇ = velocidad de cambio de posición
    - T = energía cinética (momentum del mercado)
    - V = energía potencial (riesgo)
    """

    def __init__(
        self,
        initial_cash: float = 10000.0,
        risk_aversion: float = 0.5,
        momentum_factor: float = 1.0,
        transaction_cost: float = 0.001
    ):
        """
        Inicializa el simulador

        Args:
            initial_cash: Capital inicial
            risk_aversion: Factor de aversión al riesgo (0-1)
            momentum_factor: Factor de importancia del momentum
            transaction_cost: Costo de transacción (como fracción)
        """
        self.initial_cash = initial_cash
        self.risk_aversion = risk_aversion
        self.momentum_factor = momentum_factor
        self.transaction_cost = transaction_cost

        # Estado inicial
        self.position = TradingPosition(
            shares=0.0,
            entry_price=0.0,
            cash=initial_cash
        )

        # Historial
        self.history: List[Dict] = []

    def kinetic_energy(self, market_state: MarketState) -> float:
        """
        Calcula la energía cinética (T) - representa oportunidad/momentum

        T = ½ * m * v²
        donde:
        - m = momentum_factor * volume (masa efectiva del mercado)
        - v = velocity (velocidad del precio)

        Un T alto indica fuerte momentum (oportunidad de trading)
        """
        mass = self.momentum_factor * market_state.volume / 1000.0
        velocity_squared = market_state.velocity ** 2
        return 0.5 * mass * velocity_squared

    def potential_energy(self, market_state: MarketState, position: TradingPosition) -> float:
        """
        Calcula la energía potencial (V) - representa riesgo

        V = ½ * k * x²
        donde:
        - k = risk_aversion * volatility (constante del "resorte" de riesgo)
        - x = shares * price (exposición total al mercado)

        Un V alto indica alto riesgo en la posición actual
        """
        spring_constant = self.risk_aversion * market_state.volatility
        exposure = abs(position.shares * market_state.price)
        return 0.5 * spring_constant * (exposure / 1000.0) ** 2

    def lagrangian(self, market_state: MarketState, position: TradingPosition) -> float:
        """
        Calcula el Lagrangiano: L = T - V

        L > 0: El momentum supera el riesgo (favorable para trading)
        L < 0: El riesgo supera el momentum (desfavorable para trading)
        """
        T = self.kinetic_energy(market_state)
        V = self.potential_energy(market_state, position)
        return T - V

    def action(self, states: List[MarketState], positions: List[TradingPosition]) -> float:
        """
        Calcula la acción S = ∫ L dt

        El principio de acción mínima dice que el sistema evoluciona
        minimizando esta integral
        """
        total_action = 0.0
        for i in range(len(states) - 1):
            L = self.lagrangian(states[i], positions[i])
            dt = states[i+1].time - states[i].time
            total_action += L * dt
        return total_action

    def compute_optimal_action(self, market_state: MarketState) -> str:
        """
        Calcula la acción óptima basada en el Lagrangiano

        Returns:
            "BUY", "SELL", o "HOLD"
        """
        current_L = self.lagrangian(market_state, self.position)

        # Simula posiciones hipotéticas
        buy_position = TradingPosition(
            shares=self.position.shares + 10,
            entry_price=market_state.price,
            cash=self.position.cash - 10 * market_state.price
        )

        sell_position = TradingPosition(
            shares=self.position.shares - 10,
            entry_price=market_state.price,
            cash=self.position.cash + 10 * market_state.price
        )

        buy_L = self.lagrangian(market_state, buy_position)
        sell_L = self.lagrangian(market_state, sell_position)

        # Decide basándose en qué acción maximiza el Lagrangiano
        # (minimiza riesgo - maximiza oportunidad)
        if market_state.velocity > 0 and buy_L > current_L and buy_L > sell_L:
            if self.position.cash >= 10 * market_state.price * (1 + self.transaction_cost):
                return "BUY"
        elif market_state.velocity < 0 and sell_L > current_L and sell_L > buy_L:
            if self.position.shares >= 10:
                return "SELL"

        return "HOLD"

    def execute_trade(self, action: str, market_state: MarketState, shares: float = 10.0):
        """Ejecuta una orden de trading"""
        if action == "BUY":
            cost = shares * market_state.price * (1 + self.transaction_cost)
            if self.position.cash >= cost:
                self.position.shares += shares
                self.position.cash -= cost
                self.position.entry_price = market_state.price

        elif action == "SELL":
            if self.position.shares >= shares:
                revenue = shares * market_state.price * (1 - self.transaction_cost)
                self.position.shares -= shares
                self.position.cash += revenue

    def step(self, market_state: MarketState):
        """
        Ejecuta un paso de la simulación

        1. Calcula el Lagrangiano actual
        2. Determina la acción óptima
        3. Ejecuta el trade
        4. Registra el estado
        """
        # Calcula métricas Lagrangianas
        T = self.kinetic_energy(market_state)
        V = self.potential_energy(market_state, self.position)
        L = T - V

        # Determina acción óptima
        action = self.compute_optimal_action(market_state)

        # Ejecuta el trade
        self.execute_trade(action, market_state)

        # Registra el estado
        portfolio_value = self.position.get_total_value(market_state.price)
        pnl = self.position.get_pnl(market_state.price, self.initial_cash)

        self.history.append({
            'time': market_state.time,
            'price': market_state.price,
            'velocity': market_state.velocity,
            'volatility': market_state.volatility,
            'kinetic_energy': T,
            'potential_energy': V,
            'lagrangian': L,
            'action': action,
            'shares': self.position.shares,
            'cash': self.position.cash,
            'portfolio_value': portfolio_value,
            'pnl': pnl
        })

    def get_history_df(self):
        """Retorna el historial como DataFrame"""
        import pandas as pd
        return pd.DataFrame(self.history)


class MarketSimulator:
    """Simula un mercado con precios realistas"""

    def __init__(
        self,
        initial_price: float = 100.0,
        drift: float = 0.0001,
        volatility: float = 0.02,
        dt: float = 0.1
    ):
        """
        Args:
            initial_price: Precio inicial
            drift: Tendencia promedio del precio
            volatility: Volatilidad del mercado
            dt: Paso de tiempo
        """
        self.price = initial_price
        self.drift = drift
        self.volatility = volatility
        self.dt = dt
        self.time = 0.0
        self.velocity = 0.0

    def step(self) -> MarketState:
        """
        Genera el siguiente estado del mercado usando movimiento Browniano geométrico

        dS = μ*S*dt + σ*S*dW
        """
        # Movimiento Browniano geométrico
        dW = np.random.normal(0, np.sqrt(self.dt))
        dS = self.drift * self.price * self.dt + self.volatility * self.price * dW

        old_price = self.price
        self.price += dS
        self.velocity = (self.price - old_price) / self.dt
        self.time += self.dt

        # Volumen simulado (correlacionado con volatilidad)
        volume = abs(np.random.normal(1000, 200))

        return MarketState(
            time=self.time,
            price=self.price,
            velocity=self.velocity,
            volume=volume,
            volatility=self.volatility
        )

    def add_trend(self, trend_strength: float = 0.001):
        """Añade una tendencia temporal al mercado"""
        self.drift = trend_strength

    def add_shock(self, shock_size: float = 0.1):
        """Añade un shock al precio"""
        self.price *= (1 + shock_size)
