from __future__ import annotations

import hashlib
import secrets
from typing import MutableSequence


class DeterministicRng:
    """Small serializable RNG so a game can be replayed without global state."""

    def __init__(self, seed: int | str | None = None, state: int | None = None):
        if isinstance(seed, str):
            seed = int.from_bytes(hashlib.sha256(seed.encode("utf-8")).digest()[:4], "big")
        self.seed = int(seed if seed is not None else secrets.randbits(32)) & 0xFFFFFFFF
        self.state = int(state if state is not None else self.seed) & 0xFFFFFFFF
        self.position = 0

    def next_u32(self) -> int:
        self.state = (1664525 * self.state + 1013904223) & 0xFFFFFFFF
        self.position += 1
        return self.state

    def randbelow(self, upper: int) -> int:
        if upper <= 0:
            raise ValueError("upper must be positive")
        return self.next_u32() % upper

    def shuffle(self, values: MutableSequence[object]) -> None:
        for index in range(len(values) - 1, 0, -1):
            other = self.randbelow(index + 1)
            values[index], values[other] = values[other], values[index]
