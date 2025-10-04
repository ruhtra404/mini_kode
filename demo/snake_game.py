"""
Advanced Snake Game with Multiple Features
- Multiple game modes (Classic, AI Opponent, Survival with Obstacles)
- Power-ups system (Speed Boost, Score Multiplier, Shield, Ghost Mode)
- Progressive difficulty with dynamic obstacles
- Smooth animations and particle effects
- Comprehensive scoring and statistics
"""

import pygame
import random
import math
from enum import Enum
from dataclasses import dataclass
from typing import List, Tuple, Optional
from collections import deque

# Constants
WINDOW_WIDTH = 1000
WINDOW_HEIGHT = 800
GRID_SIZE = 20
GRID_WIDTH = WINDOW_WIDTH // GRID_SIZE
GRID_HEIGHT = WINDOW_HEIGHT // GRID_SIZE

# Colors
COLOR_BACKGROUND = (15, 15, 35)
COLOR_GRID = (30, 30, 50)
COLOR_SNAKE_HEAD = (50, 255, 100)
COLOR_SNAKE_BODY = (30, 200, 80)
COLOR_FOOD = (255, 50, 50)
COLOR_SPECIAL_FOOD = (255, 215, 0)
COLOR_OBSTACLE = (100, 100, 100)
COLOR_AI_SNAKE = (100, 150, 255)
COLOR_TEXT = (255, 255, 255)
COLOR_PARTICLE = (255, 200, 100)

# Game settings
BASE_SPEED = 10
MAX_SPEED = 25
SPEED_INCREMENT = 0.5


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
    SPEED_BOOST = "Speed Boost"
    SCORE_MULTIPLIER = "Score x2"
    SHIELD = "Shield"
    GHOST = "Ghost Mode"


class GameMode(Enum):
    CLASSIC = "Classic"
    AI_OPPONENT = "VS AI"
    SURVIVAL = "Survival"


@dataclass
class PowerUp:
    type: PowerUpType
    position: Tuple[int, int]
    duration: int
    color: Tuple[int, int, int]

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
            PowerUpType.GHOST: (147, 112, 219)
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


class Snake:
    def __init__(self, start_pos: Tuple[int, int], color: Tuple[int, int, int],
                 is_ai: bool = False):
        self.body = deque([start_pos])
        self.direction = Direction.RIGHT
        self.next_direction = Direction.RIGHT
        self.color = color
        self.is_ai = is_ai
        self.alive = True
        self.score = 0
        self.has_shield = False
        self.is_ghost = False
        self.score_multiplier = 1
        self.active_powerups = {}

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


class AIController:
    """Simple AI using BFS pathfinding"""

    @staticmethod
    def get_next_direction(snake: Snake, food_pos: Tuple[int, int],
                          obstacles: set, other_snakes: List[Snake]) -> Direction:
        head = snake.body[0]

        # Build obstacle map
        blocked = obstacles.copy()
        for other in other_snakes:
            if other != snake:
                blocked.update(other.body)
        if not snake.is_ghost:
            blocked.update(list(snake.body)[1:])

        # BFS to find path to food
        path = AIController._bfs(head, food_pos, blocked)

        if path and len(path) > 1:
            next_pos = path[1]
            dx = next_pos[0] - head[0]
            dy = next_pos[1] - head[1]

            # Handle wrapping
            if abs(dx) > 1:
                dx = -1 if dx > 0 else 1
            if abs(dy) > 1:
                dy = -1 if dy > 0 else 1

            if dx == 1:
                return Direction.RIGHT
            elif dx == -1:
                return Direction.LEFT
            elif dy == 1:
                return Direction.DOWN
            elif dy == -1:
                return Direction.UP

        # No path found, try to survive
        return AIController._survival_move(snake, blocked)

    @staticmethod
    def _bfs(start: Tuple[int, int], goal: Tuple[int, int],
             blocked: set) -> Optional[List[Tuple[int, int]]]:
        queue = deque([(start, [start])])
        visited = {start}

        while queue:
            pos, path = queue.popleft()

            if pos == goal:
                return path

            if len(path) > 100:  # Limit search depth
                continue

            for direction in Direction:
                dx, dy = direction.value
                next_pos = ((pos[0] + dx) % GRID_WIDTH,
                           (pos[1] + dy) % GRID_HEIGHT)

                if next_pos not in visited and next_pos not in blocked:
                    visited.add(next_pos)
                    queue.append((next_pos, path + [next_pos]))

        return None

    @staticmethod
    def _survival_move(snake: Snake, blocked: set) -> Direction:
        head = snake.body[0]
        possible_moves = []

        for direction in Direction:
            dx, dy = direction.value
            next_pos = ((head[0] + dx) % GRID_WIDTH,
                       (head[1] + dy) % GRID_HEIGHT)

            if next_pos not in blocked and direction != snake.direction.opposite():
                possible_moves.append(direction)

        return random.choice(possible_moves) if possible_moves else snake.direction


class Game:
    def __init__(self, mode: GameMode = GameMode.CLASSIC):
        pygame.init()
        self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
        pygame.display.set_caption(f"Advanced Snake - {mode.value}")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 36)
        self.small_font = pygame.font.Font(None, 24)

        self.mode = mode
        self.running = True
        self.paused = False
        self.game_over = False
        self.speed = BASE_SPEED

        # Initialize game objects
        self.player = Snake((GRID_WIDTH // 4, GRID_HEIGHT // 2), COLOR_SNAKE_BODY)
        self.snakes = [self.player]

        if mode == GameMode.AI_OPPONENT:
            self.ai_snake = Snake((3 * GRID_WIDTH // 4, GRID_HEIGHT // 2),
                                 COLOR_AI_SNAKE, is_ai=True)
            self.ai_snake.direction = Direction.LEFT
            self.snakes.append(self.ai_snake)

        self.food_pos = self._spawn_food()
        self.obstacles = set()
        self.powerups = []
        self.particles = []

        if mode == GameMode.SURVIVAL:
            self._spawn_obstacles(10)

        self.frames = 0
        self.high_score = 0

    def _spawn_food(self) -> Tuple[int, int]:
        occupied = self._get_occupied_positions()
        while True:
            pos = (random.randint(0, GRID_WIDTH - 1),
                   random.randint(0, GRID_HEIGHT - 1))
            if pos not in occupied:
                return pos

    def _spawn_obstacles(self, count: int):
        occupied = self._get_occupied_positions()
        for _ in range(count):
            while True:
                pos = (random.randint(0, GRID_WIDTH - 1),
                       random.randint(0, GRID_HEIGHT - 1))
                if pos not in occupied and pos not in self.obstacles:
                    self.obstacles.add(pos)
                    occupied.add(pos)
                    break

    def _get_occupied_positions(self) -> set:
        occupied = set()
        for snake in self.snakes:
            occupied.update(snake.body)
        occupied.update(self.obstacles)
        occupied.update(p.position for p in self.powerups)
        return occupied

    def _create_particles(self, pos: Tuple[int, int], color: Tuple[int, int, int]):
        x = pos[0] * GRID_SIZE + GRID_SIZE // 2
        y = pos[1] * GRID_SIZE + GRID_SIZE // 2

        for _ in range(15):
            angle = random.uniform(0, 2 * math.pi)
            speed = random.uniform(1, 4)
            self.particles.append(Particle(
                x, y,
                math.cos(angle) * speed,
                math.sin(angle) * speed,
                30,
                color
            ))

    def handle_input(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.running = False
                elif event.key == pygame.K_SPACE:
                    if self.game_over:
                        self.__init__(self.mode)
                    else:
                        self.paused = not self.paused
                elif event.key == pygame.K_UP:
                    self.player.set_direction(Direction.UP)
                elif event.key == pygame.K_DOWN:
                    self.player.set_direction(Direction.DOWN)
                elif event.key == pygame.K_LEFT:
                    self.player.set_direction(Direction.LEFT)
                elif event.key == pygame.K_RIGHT:
                    self.player.set_direction(Direction.RIGHT)

    def update(self):
        if self.paused or self.game_over:
            return

        self.frames += 1

        # Update AI
        if self.mode == GameMode.AI_OPPONENT and self.ai_snake.alive:
            direction = AIController.get_next_direction(
                self.ai_snake, self.food_pos, self.obstacles, [self.player]
            )
            self.ai_snake.set_direction(direction)

        # Move snakes
        for snake in self.snakes:
            if not snake.alive:
                continue

            old_tail = snake.move()

            # Check food collision
            if snake.body[0] == self.food_pos:
                snake.grow()
                snake.score += 10 * snake.score_multiplier
                self._create_particles(self.food_pos, COLOR_FOOD)
                self.food_pos = self._spawn_food()

                # Increase difficulty
                if self.speed < MAX_SPEED:
                    self.speed += SPEED_INCREMENT

                # Spawn obstacles in survival mode
                if self.mode == GameMode.SURVIVAL and snake.score % 50 == 0:
                    self._spawn_obstacles(2)

            # Check powerup collision
            for powerup in self.powerups[:]:
                if snake.body[0] == powerup.position:
                    snake.activate_powerup(powerup)
                    self._create_particles(powerup.position, powerup.color)
                    self.powerups.remove(powerup)

            # Update powerups
            snake.update_powerups()

            # Check collisions
            if snake.check_self_collision():
                if snake.has_shield:
                    snake.has_shield = False
                    if PowerUpType.SHIELD in snake.active_powerups:
                        del snake.active_powerups[PowerUpType.SHIELD]
                else:
                    snake.alive = False

            # Check obstacle collision
            if not snake.is_ghost and snake.body[0] in self.obstacles:
                if snake.has_shield:
                    snake.has_shield = False
                    if PowerUpType.SHIELD in snake.active_powerups:
                        del snake.active_powerups[PowerUpType.SHIELD]
                else:
                    snake.alive = False

            # Check snake-to-snake collision
            if self.mode == GameMode.AI_OPPONENT:
                for other_snake in self.snakes:
                    if other_snake != snake and other_snake.alive:
                        if not snake.is_ghost and snake.body[0] in other_snake.body:
                            if snake.has_shield:
                                snake.has_shield = False
                            else:
                                snake.alive = False

        # Spawn powerups
        if self.frames % 300 == 0 and len(self.powerups) < 3:
            occupied = self._get_occupied_positions()
            self.powerups.append(PowerUp.create_random(occupied))

        # Update powerup durations
        for powerup in self.powerups[:]:
            powerup.duration -= 1
            if powerup.duration <= 0:
                self.powerups.remove(powerup)

        # Update particles
        for particle in self.particles[:]:
            particle.x += particle.vx
            particle.y += particle.vy
            particle.lifetime -= 1
            if particle.lifetime <= 0:
                self.particles.remove(particle)

        # Check game over
        if not self.player.alive:
            self.game_over = True
            if self.player.score > self.high_score:
                self.high_score = self.player.score

    def render(self):
        self.screen.fill(COLOR_BACKGROUND)

        # Draw grid
        for x in range(0, WINDOW_WIDTH, GRID_SIZE):
            pygame.draw.line(self.screen, COLOR_GRID, (x, 0), (x, WINDOW_HEIGHT))
        for y in range(0, WINDOW_HEIGHT, GRID_SIZE):
            pygame.draw.line(self.screen, COLOR_GRID, (0, y), (WINDOW_WIDTH, y))

        # Draw obstacles
        for obs in self.obstacles:
            rect = pygame.Rect(obs[0] * GRID_SIZE, obs[1] * GRID_SIZE,
                             GRID_SIZE, GRID_SIZE)
            pygame.draw.rect(self.screen, COLOR_OBSTACLE, rect)
            pygame.draw.rect(self.screen, (150, 150, 150), rect, 2)

        # Draw food
        food_rect = pygame.Rect(self.food_pos[0] * GRID_SIZE,
                               self.food_pos[1] * GRID_SIZE,
                               GRID_SIZE, GRID_SIZE)
        pygame.draw.rect(self.screen, COLOR_FOOD, food_rect)
        pygame.draw.circle(self.screen, (255, 100, 100),
                         (self.food_pos[0] * GRID_SIZE + GRID_SIZE // 2,
                          self.food_pos[1] * GRID_SIZE + GRID_SIZE // 2),
                         GRID_SIZE // 3)

        # Draw powerups
        for powerup in self.powerups:
            x = powerup.position[0] * GRID_SIZE + GRID_SIZE // 2
            y = powerup.position[1] * GRID_SIZE + GRID_SIZE // 2
            pulse = int(5 * math.sin(self.frames * 0.1))
            pygame.draw.circle(self.screen, powerup.color, (x, y),
                             GRID_SIZE // 2 + pulse)
            pygame.draw.circle(self.screen, (255, 255, 255), (x, y),
                             GRID_SIZE // 2 + pulse, 2)

        # Draw snakes
        for snake in self.snakes:
            if not snake.alive:
                continue

            color = snake.color
            if snake.is_ghost:
                color = tuple(c // 2 for c in color)

            for i, segment in enumerate(snake.body):
                rect = pygame.Rect(segment[0] * GRID_SIZE, segment[1] * GRID_SIZE,
                                 GRID_SIZE - 2, GRID_SIZE - 2)

                if i == 0:  # Head
                    head_color = tuple(min(255, c + 50) for c in color)
                    pygame.draw.rect(self.screen, head_color, rect, border_radius=5)

                    # Draw eyes
                    eye_offset = 5
                    if snake.direction == Direction.RIGHT:
                        eye1 = (segment[0] * GRID_SIZE + GRID_SIZE - eye_offset,
                               segment[1] * GRID_SIZE + eye_offset)
                        eye2 = (segment[0] * GRID_SIZE + GRID_SIZE - eye_offset,
                               segment[1] * GRID_SIZE + GRID_SIZE - eye_offset)
                    elif snake.direction == Direction.LEFT:
                        eye1 = (segment[0] * GRID_SIZE + eye_offset,
                               segment[1] * GRID_SIZE + eye_offset)
                        eye2 = (segment[0] * GRID_SIZE + eye_offset,
                               segment[1] * GRID_SIZE + GRID_SIZE - eye_offset)
                    elif snake.direction == Direction.UP:
                        eye1 = (segment[0] * GRID_SIZE + eye_offset,
                               segment[1] * GRID_SIZE + eye_offset)
                        eye2 = (segment[0] * GRID_SIZE + GRID_SIZE - eye_offset,
                               segment[1] * GRID_SIZE + eye_offset)
                    else:  # DOWN
                        eye1 = (segment[0] * GRID_SIZE + eye_offset,
                               segment[1] * GRID_SIZE + GRID_SIZE - eye_offset)
                        eye2 = (segment[0] * GRID_SIZE + GRID_SIZE - eye_offset,
                               segment[1] * GRID_SIZE + GRID_SIZE - eye_offset)

                    pygame.draw.circle(self.screen, (0, 0, 0), eye1, 2)
                    pygame.draw.circle(self.screen, (0, 0, 0), eye2, 2)
                else:  # Body
                    body_color = tuple(max(0, c - i * 2) for c in color)
                    pygame.draw.rect(self.screen, body_color, rect, border_radius=3)

                # Draw shield effect
                if snake.has_shield and i == 0:
                    shield_radius = GRID_SIZE + int(5 * math.sin(self.frames * 0.2))
                    pygame.draw.circle(self.screen, (0, 191, 255),
                                     (segment[0] * GRID_SIZE + GRID_SIZE // 2,
                                      segment[1] * GRID_SIZE + GRID_SIZE // 2),
                                     shield_radius, 2)

        # Draw particles
        for particle in self.particles:
            alpha = int(255 * (particle.lifetime / 30))
            color = (*particle.color, alpha)
            size = max(1, int(particle.lifetime / 6))
            pygame.draw.circle(self.screen, particle.color,
                             (int(particle.x), int(particle.y)), size)

        # Draw UI
        score_text = self.font.render(f"Score: {self.player.score}", True, COLOR_TEXT)
        self.screen.blit(score_text, (10, 10))

        if self.high_score > 0:
            high_score_text = self.small_font.render(
                f"High: {self.high_score}", True, (200, 200, 200))
            self.screen.blit(high_score_text, (10, 50))

        # Draw active powerups
        y_offset = 90
        for powerup_type, duration in self.player.active_powerups.items():
            text = self.small_font.render(
                f"{powerup_type.value}: {duration // 60}s",
                True, (255, 255, 100))
            self.screen.blit(text, (10, y_offset))
            y_offset += 25

        # Draw AI score if applicable
        if self.mode == GameMode.AI_OPPONENT and self.ai_snake.alive:
            ai_score_text = self.font.render(
                f"AI Score: {self.ai_snake.score}", True, COLOR_AI_SNAKE)
            self.screen.blit(ai_score_text, (WINDOW_WIDTH - 200, 10))

        # Draw game over screen
        if self.game_over:
            overlay = pygame.Surface((WINDOW_WIDTH, WINDOW_HEIGHT))
            overlay.set_alpha(200)
            overlay.fill((0, 0, 0))
            self.screen.blit(overlay, (0, 0))

            game_over_text = self.font.render("GAME OVER", True, (255, 50, 50))
            text_rect = game_over_text.get_rect(
                center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT // 2 - 50))
            self.screen.blit(game_over_text, text_rect)

            final_score_text = self.font.render(
                f"Final Score: {self.player.score}", True, COLOR_TEXT)
            score_rect = final_score_text.get_rect(
                center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT // 2))
            self.screen.blit(final_score_text, score_rect)

            restart_text = self.small_font.render(
                "Press SPACE to restart", True, (200, 200, 200))
            restart_rect = restart_text.get_rect(
                center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT // 2 + 50))
            self.screen.blit(restart_text, restart_rect)

        # Draw pause screen
        if self.paused:
            pause_text = self.font.render("PAUSED", True, (255, 255, 100))
            text_rect = pause_text.get_rect(
                center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT // 2))
            self.screen.blit(pause_text, text_rect)

        pygame.display.flip()

    def run(self):
        while self.running:
            self.handle_input()
            self.update()
            self.render()
            self.clock.tick(self.speed)

        pygame.quit()


def main():
    print("Advanced Snake Game")
    print("=" * 50)
    print("Select Game Mode:")
    print("1. Classic")
    print("2. VS AI")
    print("3. Survival (with obstacles)")
    print("=" * 50)

    choice = input("Enter choice (1-3): ").strip()

    mode_map = {
        "1": GameMode.CLASSIC,
        "2": GameMode.AI_OPPONENT,
        "3": GameMode.SURVIVAL
    }

    mode = mode_map.get(choice, GameMode.CLASSIC)

    print(f"\nStarting {mode.value} mode...")
    print("\nControls:")
    print("- Arrow keys: Move")
    print("- SPACE: Pause/Restart")
    print("- ESC: Quit")
    print("\nPower-ups:")
    print("- Yellow: Speed Boost")
    print("- Orange: Score Multiplier (x2)")
    print("- Blue: Shield (protects from one hit)")
    print("- Purple: Ghost Mode (pass through obstacles)")

    game = Game(mode)
    game.run()


if __name__ == "__main__":
    main()
