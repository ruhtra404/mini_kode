"""
超级贪吃蛇游戏 v2.0
新增功能：
- 游戏进度保存/读取
- 时间挑战模式
- 无尽模式
- A*寻路AI
- 音效系统
- 关卡编辑器
- 多人对战支持
- 成就系统
"""

import pygame
import random
import math
import json
import os
from enum import Enum
from dataclasses import dataclass, asdict
from typing import List, Tuple, Optional, Dict, Any
from collections import deque
import heapq
from datetime import datetime

# 常量定义
WINDOW_WIDTH = 1200
WINDOW_HEIGHT = 800
GRID_SIZE = 20
GRID_WIDTH = WINDOW_WIDTH // GRID_SIZE
GRID_HEIGHT = WINDOW_HEIGHT // GRID_SIZE

# 颜色定义
COLORS = {
    'BACKGROUND': (15, 15, 35),
    'GRID': (30, 30, 50),
    'SNAKE_HEAD': (50, 255, 100),
    'SNAKE_BODY': (30, 200, 80),
    'FOOD': (255, 50, 50),
    'SPECIAL_FOOD': (255, 215, 0),
    'OBSTACLE': (100, 100, 100),
    'AI_SNAKE': (100, 150, 255),
    'TEXT': (255, 255, 255),
    'PARTICLE': (255, 200, 100),
    'PORTAL': (147, 112, 219),
    'TELEPORTER': (0, 255, 255),
    'BOMB': (255, 100, 0),
    'MINE': (128, 0, 128)
}

# 游戏设置
BASE_SPEED = 10
MAX_SPEED = 30
SPEED_INCREMENT = 0.3
SAVE_FILE = "snake_game_save.json"
LEVELS_DIR = "levels"

class Direction(Enum):
    UP = (0, -1)
    DOWN = (0, 1)
    LEFT = (-1, 0)
    RIGHT = (1, 0)

    def opposite(self) -> 'Direction':
        opposites = {
            Direction.UP: Direction.DOWN,
            Direction.DOWN: Direction.UP,
            Direction.LEFT: Direction.RIGHT,
            Direction.RIGHT: Direction.LEFT
        }
        return opposites[self]

class PowerUpType(Enum):
    SPEED_BOOST = "速度提升"
    SCORE_MULTIPLIER = "双倍积分"
    SHIELD = "护盾"
    GHOST = "幽灵模式"
    TELEPORT = "传送"
    BOMB = "炸弹"
    TIME_FREEZE = "时间冻结"

class GameMode(Enum):
    CLASSIC = "经典模式"
    AI_OPPONENT = "AI对战"
    SURVIVAL = "生存模式"
    TIME_CHALLENGE = "时间挑战"
    ENDLESS = "无尽模式"
    MULTIPLAYER = "多人对战"
    LEVEL_EDITOR = "关卡编辑"

class AchievementType(Enum):
    FIRST_WIN = "初次胜利"
    SCORE_100 = "积分破百"
    SCORE_500 = "积分破五百"
    AI_VICTORY = "AI对战胜利"
    SURVIVOR = "生存专家"
    SPEED_DEMON = "速度恶魔"
    PACIFIST = "和平主义者"
    EXPLORER = "探索者"

@dataclass
class PowerUp:
    type: PowerUpType
    position: Tuple[int, int]
    duration: int
    color: Tuple[int, int, int]
    value: int = 0

    @staticmethod
    def create_random(occupied_positions: set) -> 'PowerUp':
        while True:
            pos = (random.randint(0, GRID_WIDTH - 1),
                   random.randint(0, GRID_HEIGHT - 1))
            if pos not in occupied_positions:
                break

        powerup_type = random.choice(list(PowerUpType))
        colors = {
            PowerUpType.SPEED_BOOST: (255, 255, 0),
            PowerUpType.SCORE_MULTIPLIER: (255, 165, 0),
            PowerUpType.SHIELD: (0, 191, 255),
            PowerUpType.GHOST: (147, 112, 219),
            PowerUpType.TELEPORT: (0, 255, 255),
            PowerUpType.BOMB: (255, 100, 0),
            PowerUpType.TIME_FREEZE: (255, 255, 255)
        }

        return PowerUp(powerup_type, pos, 300, colors[powerup_type])

@dataclass
class Particle:
    x: float
    y: float
    vx: float
    vy: float
    lifetime: int
    color: Tuple[int, int, int]
    size: int = 3

@dataclass
class GameStats:
    games_played: int = 0
    total_score: int = 0
    high_score: int = 0
    total_time: float = 0.0
    achievements: List[str] = None
    unlocked_levels: List[int] = None
    player_name: str = "Player"

    def __post_init__(self):
        if self.achievements is None:
            self.achievements = []
        if self.unlocked_levels is None:
            self.unlocked_levels = [1]

@dataclass
class LevelData:
    name: str
    obstacles: List[Tuple[int, int]]
    portals: List[Tuple[Tuple[int, int], Tuple[int, int]]]
    special_items: List[Tuple[str, Tuple[int, int]]]
    time_limit: Optional[int] = None
    target_score: Optional[int] = None
    difficulty: str = "normal"

class AchievementManager:
    def __init__(self):
        self.achievements = {
            AchievementType.FIRST_WIN: {"name": "初次胜利", "description": "赢得第一场游戏", "unlocked": False},
            AchievementType.SCORE_100: {"name": "积分破百", "description": "单局积分达到100分", "unlocked": False},
            AchievementType.SCORE_500: {"name": "积分破五百", "description": "单局积分达到500分", "unlocked": False},
            AchievementType.AI_VICTORY: {"name": "AI对战胜利", "description": "在AI对战中获胜", "unlocked": False},
            AchievementType.SURVIVOR: {"name": "生存专家", "description": "生存模式存活超过5分钟", "unlocked": False},
            AchievementType.SPEED_DEMON: {"name": "速度恶魔", "description": "在速度提升状态下获得50分", "unlocked": False},
            AchievementType.PACIFIST: {"name": "和平主义者", "description": "不使用炸弹道具获得200分", "unlocked": False},
            AchievementType.EXPLORER: {"name": "探索者", "description": "发现所有类型的道具", "unlocked": False}
        }

    def check_achievements(self, game) -> List[str]:
        unlocked = []
        
        if game.player.score >= 100 and not self.achievements[AchievementType.SCORE_100]["unlocked"]:
            self.achievements[AchievementType.SCORE_100]["unlocked"] = True
            unlocked.append(AchievementType.SCORE_100.value)
            
        if game.player.score >= 500 and not self.achievements[AchievementType.SCORE_500]["unlocked"]:
            self.achievements[AchievementType.SCORE_500]["unlocked"] = True
            unlocked.append(AchievementType.SCORE_500.value)
            
        if game.mode == GameMode.AI_OPPONENT and game.player.alive and not game.ai_snake.alive:
            if not self.achievements[AchievementType.AI_VICTORY]["unlocked"]:
                self.achievements[AchievementType.AI_VICTORY]["unlocked"] = True
                unlocked.append(AchievementType.AI_VICTORY.value)
                
        return unlocked

class SoundManager:
    def __init__(self):
        self.sounds_enabled = False
        try:
            pygame.mixer.init()
            self.sounds = {
                'eat': self.load_sound('eat.wav'),
                'powerup': self.load_sound('powerup.wav'),
                'explosion': self.load_sound('explosion.wav'),
                'game_over': self.load_sound('game_over.wav'),
                'achievement': self.load_sound('achievement.wav')
            }
            self.sounds_enabled = True
        except:
            print("音效系统初始化失败，继续无声模式")

    def load_sound(self, filename):
        # 这里可以加载实际的音频文件
        # 现在返回一个模拟的声音对象
        class MockSound:
            def play(self): pass
        return MockSound()

    def play(self, sound_name):
        if self.sounds_enabled and sound_name in self.sounds:
            self.sounds[sound_name].play()

class SaveManager:
    @staticmethod
    def save_game(stats: GameStats, filename: str = SAVE_FILE):
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(asdict(stats), f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存游戏失败: {e}")
            return False

    @staticmethod
    def load_game(filename: str = SAVE_FILE) -> Optional[GameStats]:
        try:
            if os.path.exists(filename):
                with open(filename, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return GameStats(**data)
        except Exception as e:
            print(f"加载游戏失败: {e}")
        return None

    @staticmethod
    def save_level(level: LevelData, filename: str):
        try:
            os.makedirs(LEVELS_DIR, exist_ok=True)
            filepath = os.path.join(LEVELS_DIR, filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(asdict(level), f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存关卡失败: {e}")
            return False

    @staticmethod
    def load_level(filename: str) -> Optional[LevelData]:
        try:
            filepath = os.path.join(LEVELS_DIR, filename)
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return LevelData(**data)
        except Exception as e:
            print(f"加载关卡失败: {e}")
        return None

class Snake:
    def __init__(self, start_pos: Tuple[int, int], color: Tuple[int, int, int],
                 is_ai: bool = False, name: str = "Snake"):
        self.body = deque([start_pos])
        self.direction = Direction.RIGHT
        self.next_direction = Direction.RIGHT
        self.color = color
        self.is_ai = is_ai
        self.name = name
        self.alive = True
        self.score = 0
        self.has_shield = False
        self.is_ghost = False
        self.score_multiplier = 1
        self.active_powerups = {}
        self.bombs = 0
        self.teleports = 0
        self.speed_boost = 1.0

    def move(self) -> Tuple[int, int]:
        self.direction = self.next_direction
        head_x, head_y = self.body[0]
        dx, dy = self.direction.value
        new_head = ((head_x + dx) % GRID_WIDTH, (head_y + dy) % GRID_HEIGHT)
        self.body.appendleft(new_head)
        return self.body.pop()

    def grow(self):
        tail = self.body[-1]
        self.body.append(tail)

    def set_direction(self, new_direction: Direction):
        if new_direction != self.direction.opposite():
            self.next_direction = new_direction

    def check_self_collision(self) -> bool:
        if self.is_ghost:
            return False
        head = self.body[0]
        return head in list(self.body)[1:]

    def activate_powerup(self, powerup: PowerUp):
        self.active_powerups[powerup.type] = powerup.duration

        if powerup.type == PowerUpType.SHIELD:
            self.has_shield = True
        elif powerup.type == PowerUpType.GHOST:
            self.is_ghost = True
        elif powerup.type == PowerUpType.SCORE_MULTIPLIER:
            self.score_multiplier = 2
        elif powerup.type == PowerUpType.BOMB:
            self.bombs += 1
        elif powerup.type == PowerUpType.TELEPORT:
            self.teleports += 1
        elif powerup.type == PowerUpType.SPEED_BOOST:
            self.speed_boost = 1.5

    def update_powerups(self):
        expired = []
        for powerup_type, duration in self.active_powerups.items():
            self.active_powerups[powerup_type] -= 1
            if self.active_powerups[powerup_type] <= 0:
                expired.append(powerup_type)

        for powerup_type in expired:
            del self.active_powerups[powerup_type]
            if powerup_type == PowerUpType.SHIELD:
                self.has_shield = False
            elif powerup_type == PowerUpType.GHOST:
                self.is_ghost = False
            elif powerup_type == PowerUpType.SCORE_MULTIPLIER:
                self.score_multiplier = 1
            elif powerup_type == PowerUpType.SPEED_BOOST:
                self.speed_boost = 1.0

    def use_bomb(self, game) -> bool:
        if self.bombs > 0:
            self.bombs -= 1
            # 炸弹效果：清除周围的障碍物和敌人
            head = self.body[0]
            explosion_range = 3
            
            for dx in range(-explosion_range, explosion_range + 1):
                for dy in range(-explosion_range, explosion_range + 1):
                    if abs(dx) + abs(dy) <= explosion_range:
                        pos = ((head[0] + dx) % GRID_WIDTH, (head[1] + dy) % GRID_HEIGHT)
                        if pos in game.obstacles:
                            game.obstacles.remove(pos)
                            game._create_particles(pos, COLORS['BOMB'])
            return True
        return False

    def use_teleport(self, game) -> bool:
        if self.teleports > 0:
            self.teleports -= 1
            # 传送到安全位置
            occupied = game._get_occupied_positions()
            safe_positions = []
            
            for x in range(GRID_WIDTH):
                for y in range(GRID_HEIGHT):
                    pos = (x, y)
                    if pos not in occupied:
                        safe_positions.append(pos)
            
            if safe_positions:
                new_pos = random.choice(safe_positions)
                # 移动蛇头到新位置
                self.body[0] = new_pos
                game._create_particles(new_pos, COLORS['TELEPORTER'])
                return True
        return False

class AStarAI:
    """A*寻路AI，比BFS更智能"""
    
    @staticmethod
    def get_next_direction(snake: Snake, target_pos: Tuple[int, int],
                          obstacles: set, other_snakes: List[Snake], 
                          food_positions: List[Tuple[int, int]]) -> Direction:
        head = snake.body[0]
        
        # 构建障碍地图
        blocked = obstacles.copy()
        for other in other_snakes:
            if other != snake:
                blocked.update(other.body)
        if not snake.is_ghost:
            blocked.update(list(snake.body)[1:])
        
        # A*寻路
        path = AStarAI._astar(head, target_pos, blocked)
        
        if path and len(path) > 1:
            next_pos = path[1]
            dx = (next_pos[0] - head[0]) % GRID_WIDTH
            dy = (next_pos[1] - head[1]) % GRID_HEIGHT
            
            # 处理边界环绕
            if dx > GRID_WIDTH // 2:
                dx -= GRID_WIDTH
            elif dx < -GRID_WIDTH // 2:
                dx += GRID_WIDTH
                
            if dy > GRID_HEIGHT // 2:
                dy -= GRID_HEIGHT
            elif dy < -GRID_HEIGHT // 2:
                dy += GRID_HEIGHT
            
            if dx == 1 or dx == -GRID_WIDTH + 1:
                return Direction.RIGHT
            elif dx == -1 or dx == GRID_WIDTH - 1:
                return Direction.LEFT
            elif dy == 1 or dy == -GRID_HEIGHT + 1:
                return Direction.DOWN
            elif dy == -1 or dy == GRID_HEIGHT - 1:
                return Direction.UP
        
        # 如果没有找到路径，使用生存策略
        return AStarAI._survival_move(snake, blocked, food_positions)
    
    @staticmethod
    def _astar(start: Tuple[int, int], goal: Tuple[int, int], 
               blocked: set) -> Optional[List[Tuple[int, int]]]:
        """A*算法实现"""
        def heuristic(a: Tuple[int, int], b: Tuple[int, int]) -> float:
            # 考虑边界环绕的启发式函数
            dx = min(abs(a[0] - b[0]), GRID_WIDTH - abs(a[0] - b[0]))
            dy = min(abs(a[1] - b[1]), GRID_HEIGHT - abs(a[1] - b[1]))
            return dx + dy
        
        frontier = [(0, start)]
        came_from = {start: None}
        cost_so_far = {start: 0}
        
        while frontier:
            current_priority, current = heapq.heappop(frontier)
            
            if current == goal:
                # 重构路径
                path = []
                while current is not None:
                    path.append(current)
                    current = came_from[current]
                return path[::-1]
            
            for direction in Direction:
                dx, dy = direction.value
                next_pos = ((current[0] + dx) % GRID_WIDTH,
                           (current[1] + dy) % GRID_HEIGHT)
                
                if next_pos in blocked:
                    continue
                
                new_cost = cost_so_far[current] + 1
                
                if next_pos not in cost_so_far or new_cost < cost_so_far[next_pos]:
                    cost_so_far[next_pos] = new_cost
                    priority = new_cost + heuristic(next_pos, goal)
                    heapq.heappush(frontier, (priority, next_pos))
                    came_from[next_pos] = current
        
        return None
    
    @staticmethod
    def _survival_move(snake: Snake, blocked: set, 
                      food_positions: List[Tuple[int, int]]) -> Direction:
        """生存策略：避免危险，寻找食物"""
        head = snake.body[0]
        best_direction = snake.direction
        best_score = -float('inf')
        
        for direction in Direction:
            if direction == snake.direction.opposite():
                continue
                
            dx, dy = direction.value
            next_pos = ((head[0] + dx) % GRID_WIDTH,
                       (head[1] + dy) % GRID_HEIGHT)
            
            if next_pos in blocked:
                continue
            
            # 评分系统
            score = 0
            
            # 距离食物的远近
            for food_pos in food_positions:
                dist = min(abs(next_pos[0] - food_pos[0]), 
                          GRID_WIDTH - abs(next_pos[0] - food_pos[0])) + \
                       min(abs(next_pos[1] - food_pos[1]), 
                          GRID_HEIGHT - abs(next_pos[1] - food_pos[1]))
                score += 10.0 / (dist + 1)
            
            # 避免边界（可选）
            if next_pos[0] in [0, GRID_WIDTH-1] or next_pos[1] in [0, GRID_HEIGHT-1]:
                score -= 2
            
            # 避免狭窄空间
            free_neighbors = 0
            for dir2 in Direction:
                dx2, dy2 = dir2.value
                neighbor = ((next_pos[0] + dx2) % GRID_WIDTH,
                           (next_pos[1] + dy2) % GRID_HEIGHT)
                if neighbor not in blocked:
                    free_neighbors += 1
            score += free_neighbors * 3
            
            if score > best_score:
                best_score = score
                best_direction = direction
        
        return best_direction

# 后续会继续添加游戏主类和其他功能...