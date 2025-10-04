# 继续完成游戏主类

class Game:
    def __init__(self, mode: GameMode = GameMode.CLASSIC, level_file: Optional[str] = None):
        pygame.init()
        self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
        pygame.display.set_caption(f"超级贪吃蛇 v2.0 - {mode.value}")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 36)
        self.small_font = pygame.font.Font(None, 24)
        self.large_font = pygame.font.Font(None, 72)

        self.mode = mode
        self.running = True
        self.paused = False
        self.game_over = False
        self.speed = BASE_SPEED
        
        # 游戏状态
        self.start_time = pygame.time.get_ticks()
        self.game_time = 0
        self.level_time_limit = None
        self.target_score = None
        
        # 管理器
        self.sound_manager = SoundManager()
        self.achievement_manager = AchievementManager()
        self.save_manager = SaveManager()
        
        # 加载游戏统计
        self.game_stats = self.save_manager.load_game()
        if self.game_stats is None:
            self.game_stats = GameStats()
        
        # 关卡数据
        self.current_level = 1
        self.level_data = None
        if level_file:
            self.level_data = self.save_manager.load_level(level_file)
            if self.level_data:
                self.level_time_limit = self.level_data.time_limit
                self.target_score = self.level_data.target_score
        
        # 初始化游戏对象
        self.player = Snake((GRID_WIDTH // 4, GRID_HEIGHT // 2), COLORS['SNAKE_HEAD'], name="Player")
        self.snakes = [self.player]
        
        if mode == GameMode.AI_OPPONENT:
            self.ai_snake = Snake((3 * GRID_WIDTH // 4, GRID_HEIGHT // 2),
                                 COLORS['AI_SNAKE'], is_ai=True, name="AI")
            self.ai_snake.direction = Direction.LEFT
            self.snakes.append(self.ai_snake)
        elif mode == GameMode.MULTIPLAYER:
            # 多人模式 - 支持本地多人
            self.player2 = Snake((3 * GRID_WIDTH // 4, GRID_HEIGHT // 2),
                                (255, 100, 255), name="Player2")
            self.snakes.append(self.player2)
        
        # 游戏元素
        self.food_positions = [self._spawn_food()]
        self.obstacles = set()
        self.powerups = []
        self.particles = []
        self.portals = []  # 传送门
        self.mines = set()  # 地雷
        self.bombs = []  # 激活的炸弹
        
        # 加载关卡数据
        if self.level_data:
            self.obstacles.update(self.level_data.obstacles)
            for portal_pair in self.level_data.portals:
                self.portals.append(portal_pair)
        elif mode == GameMode.SURVIVAL:
            self._spawn_obstacles(15)
            self._spawn_mines(5)
        
        # 特殊模式设置
        if mode == GameMode.TIME_CHALLENGE:
            self.level_time_limit = 120  # 2分钟挑战
            self.target_score = 200
        elif mode == GameMode.ENDLESS:
            self.speed = MAX_SPEED
            self._spawn_obstacles(20)
            self._spawn_mines(8)
        
        self.frames = 0
        self.wave_number = 1
        self.time_freeze_active = False
        self.last_achievement_check = 0
        
        # 输入处理
        self.keys_pressed = set()
        
    def _spawn_food(self) -> Tuple[int, int]:
        occupied = self._get_occupied_positions()
        while True:
            pos = (random.randint(0, GRID_WIDTH - 1),
                   random.randint(0, GRID_HEIGHT - 1))
            if pos not in occupied and pos not in self.mines:
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
    
    def _spawn_mines(self, count: int):
        occupied = self._get_occupied_positions()
        for _ in range(count):
            while True:
                pos = (random.randint(0, GRID_WIDTH - 1),
                       random.randint(0, GRID_HEIGHT - 1))
                if pos not in occupied and pos not in self.mines:
                    self.mines.add(pos)
                    occupied.add(pos)
                    break
    
    def _get_occupied_positions(self) -> set:
        occupied = set()
        for snake in self.snakes:
            occupied.update(snake.body)
        occupied.update(self.obstacles)
        occupied.update(self.mines)
        occupied.update(self.food_positions)
        occupied.update(p.position for p in self.powerups)
        return occupied
    
    def _create_particles(self, pos: Tuple[int, int], color: Tuple[int, int, int], 
                         count: int = 15, size: int = 3):
        x = pos[0] * GRID_SIZE + GRID_SIZE // 2
        y = pos[1] * GRID_SIZE + GRID_SIZE // 2
        
        for _ in range(count):
            angle = random.uniform(0, 2 * math.pi)
            speed = random.uniform(1, 6)
            lifetime = random.randint(20, 60)
            self.particles.append(Particle(
                x, y,
                math.cos(angle) * speed,
                math.sin(angle) * speed,
                lifetime,
                color,
                size
            ))
    
    def handle_input(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                self.keys_pressed.add(event.key)
                
                if event.key == pygame.K_ESCAPE:
                    self.running = False
                elif event.key == pygame.K_SPACE:
                    if self.game_over:
                        self._restart_game()
                    else:
                        self.paused = not self.paused
                elif event.key == pygame.K_F5:
                    self._quick_save()
                elif event.key == pygame.K_F9:
                    self._quick_load()
                elif event.key == pygame.K_b:
                    # 使用炸弹
                    if self.player.use_bomb(self):
                        self.sound_manager.play('explosion')
                elif event.key == pygame.K_t:
                    # 使用传送
                    if self.player.use_teleport(self):
                        self.sound_manager.play('powerup')
                
                # 玩家1控制
                elif event.key == pygame.K_UP:
                    self.player.set_direction(Direction.UP)
                elif event.key == pygame.K_DOWN:
                    self.player.set_direction(Direction.DOWN)
                elif event.key == pygame.K_LEFT:
                    self.player.set_direction(Direction.LEFT)
                elif event.key == pygame.K_RIGHT:
                    self.player.set_direction(Direction.RIGHT)
                
                # 玩家2控制（多人模式）
                if self.mode == GameMode.MULTIPLAYER:
                    if event.key == pygame.K_w:
                        self.player2.set_direction(Direction.UP)
                    elif event.key == pygame.K_s:
                        self.player2.set_direction(Direction.DOWN)
                    elif event.key == pygame.K_a:
                        self.player2.set_direction(Direction.LEFT)
                    elif event.key == pygame.K_d:
                        self.player2.set_direction(Direction.RIGHT)
            
            elif event.type == pygame.KEYUP:
                self.keys_pressed.discard(event.key)
    
    def update(self):
        if self.paused or self.game_over:
            return
        
        # 更新时间（考虑时间冻结）
        if not self.time_freeze_active:
            self.game_time = (pygame.time.get_ticks() - self.start_time) / 1000
        
        self.frames += 1
        
        # 检查时间限制
        if self.level_time_limit and self.game_time >= self.level_time_limit:
            if self.target_score and self.player.score < self.target_score:
                self.game_over = True
                self._show_message("时间到！目标未达成")
            else:
                self._level_complete()
        
        # 更新AI
        if self.mode == GameMode.AI_OPPONENT and self.ai_snake.alive:
            direction = AStarAI.get_next_direction(
                self.ai_snake, self.food_positions[0], self.obstacles, 
                [self.player], self.food_positions
            )
            self.ai_snake.set_direction(direction)
        
        # 移动蛇
        for snake in self.snakes:
            if not snake.alive:
                continue
            
            old_tail = snake.move()
            
            # 检查食物碰撞
            for i, food_pos in enumerate(self.food_positions[:]):
                if snake.body[0] == food_pos:
                    snake.grow()
                    snake.score += 10 * snake.score_multiplier
                    self._create_particles(food_pos, COLORS['FOOD'])
                    self.food_positions[i] = self._spawn_food()
                    self.sound_manager.play('eat')
                    
                    # 增加难度
                    if self.speed < MAX_SPEED:
                        self.speed += SPEED_INCREMENT
            
            # 检查道具碰撞
            for powerup in self.powerups[:]:
                if snake.body[0] == powerup.position:
                    snake.activate_powerup(powerup)
                    self._create_particles(powerup.position, powerup.color)
                    self.powerups.remove(powerup)
                    self.sound_manager.play('powerup')
                    
                    if powerup.type == PowerUpType.TIME_FREEZE:
                        self.time_freeze_active = True
                        pygame.time.set_timer(pygame.USEREVENT, 5000)  # 5秒后恢复
            
            # 检查传送门
            for portal_pair in self.portals:
                if snake.body[0] == portal_pair[0]:
                    snake.body[0] = portal_pair[1]
                    self._create_particles(portal_pair[1], COLORS['PORTAL'])
                    break
                elif snake.body[0] == portal_pair[1]:
                    snake.body[0] = portal_pair[0]
                    self._create_particles(portal_pair[0], COLORS['PORTAL'])
                    break
            
            # 检查地雷
            if snake.body[0] in self.mines and not snake.is_ghost:
                if snake.has_shield:
                    snake.has_shield = False
                    if PowerUpType.SHIELD in snake.active_powerups:
                        del snake.active_powerups[PowerUpType.SHIELD]
                else:
                    snake.alive = False
                self.mines.remove(snake.body[0])
                self._create_particles(snake.body[0], COLORS['MINE'], count=25)
            
            # 更新道具效果
            snake.update_powerups()
            
            # 检查碰撞
            if snake.check_self_collision():
                if snake.has_shield:
                    snake.has_shield = False
                    if PowerUpType.SHIELD in snake.active_powerups:
                        del snake.active_powerups[PowerUpType.SHIELD]
                else:
                    snake.alive = False
            
            # 检查障碍物碰撞
            if not snake.is_ghost and snake.body[0] in self.obstacles:
                if snake.has_shield:
                    snake.has_shield = False
                    if PowerUpType.SHIELD in snake.active_powerups:
                        del snake.active_powerups[PowerUpType.SHIELD]
                else:
                    snake.alive = False
            
            # 检查蛇与蛇碰撞
            for other_snake in self.snakes:
                if other_snake != snake and other_snake.alive:
                    if not snake.is_ghost and snake.body[0] in other_snake.body:
                        if snake.has_shield:
                            snake.has_shield = False
                        else:
                            snake.alive = False
        
        # 生成道具
        if self.frames % 180 == 0 and len(self.powerups) < 5:  # 每3秒最多5个道具
            occupied = self._get_occupied_positions()
            self.powerups.append(PowerUp.create_random(occupied))
        
        # 无尽模式波次系统
        if self.mode == GameMode.ENDLESS and self.frames % 600 == 0:  # 每10秒一波
            self.wave_number += 1
            self._spawn_obstacles(3)
            self._spawn_mines(2)
            self._show_message(f"第 {self.wave_number} 波来袭！")
        
        # 更新粒子效果
        for particle in self.particles[:]:
            particle.x += particle.vx
            particle.y += particle.vy
            particle.lifetime -= 1
            if particle.lifetime <= 0:
                self.particles.remove(particle)
        
        # 检查成就
        if self.frames - self.last_achievement_check > 300:  # 每5秒检查一次
            self.last_achievement_check = self.frames
            new_achievements = self.achievement_manager.check_achievements(self)
            for achievement in new_achievements:
                self._show_achievement_notification(achievement)
                self.game_stats.achievements.append(achievement)
                self.sound_manager.play('achievement')
        
        # 检查游戏结束
        if not self.player.alive:
            self.game_over = True
            if self.player.score > self.game_stats.high_score:
                self.game_stats.high_score = self.player.score
                self._show_message("新纪录！")
            
            # 更新统计
            self.game_stats.games_played += 1
            self.game_stats.total_score += self.player.score
            self.game_stats.total_time += self.game_time
            self.save_manager.save_game(self.game_stats)
    
    def _level_complete(self):
        """关卡完成"""
        self._show_message("关卡完成！")
        self.current_level += 1
        if self.current_level not in self.game_stats.unlocked_levels:
            self.game_stats.unlocked_levels.append(self.current_level)
        
        # 可以加载下一关或返回菜单
        pygame.time.wait(2000)
        self.running = False
    
    def _restart_game(self):
        """重新开始游戏"""
        self.__init__(self.mode)
    
    def _quick_save(self):
        """快速保存"""
        save_data = {
            'mode': self.mode.value,
            'player_score': self.player.score,
            'player_position': list(self.player.body),
            'player_direction': self.player.direction.value,
            'game_time': self.game_time,
            'food_positions': self.food_positions,
            'obstacles': list(self.obstacles),
            'powerups': [{'type': p.type.value, 'position': p.position, 'duration': p.duration} 
                        for p in self.powerups],
            'current_level': self.current_level
        }
        
        if self.save_manager.save_game(self.game_stats, "quick_save.json"):
            # 保存当前游戏状态
            with open("quick_save_game.json", 'w', encoding='utf-8') as f:
                json.dump(save_data, f, ensure_ascii=False, indent=2)
            self._show_message("游戏已保存")
    
    def _quick_load(self):
        """快速加载"""
        try:
            if os.path.exists("quick_save_game.json"):
                with open("quick_save_game.json", 'r', encoding='utf-8') as f:
                    save_data = json.load(f)
                
                # 恢复游戏状态
                self.player.score = save_data['player_score']
                self.player.body = deque(save_data['player_position'])
                self.player.direction = Direction(save_data['player_direction'])
                self.game_time = save_data['game_time']
                self.food_positions = save_data['food_positions']
                self.obstacles = set(save_data['obstacles'])
                self.current_level = save_data['current_level']
                
                # 恢复道具
                self.powerups = []
                for p_data in save_data['powerups']:
                    powerup_type = PowerUpType(p_data['type'])
                    self.powerups.append(PowerUp(
                        powerup_type, 
                        tuple(p_data['position']),
                        p_data['duration'],
                        self._get_powerup_color(powerup_type)
                    ))
                
                self._show_message("游戏已加载")
        except Exception as e:
            self._show_message(f"加载失败: {e}")
    
    def _get_powerup_color(self, powerup_type: PowerUpType) -> Tuple[int, int, int]:
        colors = {
            PowerUpType.SPEED_BOOST: (255, 255, 0),
            PowerUpType.SCORE_MULTIPLIER: (255, 165, 0),
            PowerUpType.SHIELD: (0, 191, 255),
            PowerUpType.GHOST: (147, 112, 219),
            PowerUpType.TELEPORT: (0, 255, 255),
            PowerUpType.BOMB: (255, 100, 0),
            PowerUpType.TIME_FREEZE: (255, 255, 255)
        }
        return colors.get(powerup_type, (255, 255, 255))
    
    def _show_message(self, message: str, duration: int = 2000):
        """显示临时消息"""
        # 这里可以实现消息显示系统
        print(f"[游戏消息] {message}")
    
    def _show_achievement_notification(self, achievement: str):
        """显示成就通知"""
        print(f"🏆 解锁成就: {achievement}")
    
    def render(self):
        self.screen.fill(COLORS['BACKGROUND'])
        
        # 绘制网格
        for x in range(0, WINDOW_WIDTH, GRID_SIZE):
            pygame.draw.line(self.screen, COLORS['GRID'], (x, 0), (x, WINDOW_HEIGHT))
        for y in range(0, WINDOW_HEIGHT, GRID_SIZE):
            pygame.draw.line(self.screen, COLORS['GRID'], (0, y), (WINDOW_WIDTH, y))
        
        # 绘制障碍物
        for obs in self.obstacles:
            rect = pygame.Rect(obs[0] * GRID_SIZE, obs[1] * GRID_SIZE,
                             GRID_SIZE, GRID_SIZE)
            pygame.draw.rect(self.screen, COLORS['OBSTACLE'], rect)
            pygame.draw.rect(self.screen, (150, 150, 150), rect, 2)
        
        # 绘制地雷
        for mine in self.mines:
            center = (mine[0] * GRID_SIZE + GRID_SIZE // 2,
                     mine[1] * GRID_SIZE + GRID_SIZE // 2)
            pygame.draw.circle(self.screen, COLORS['MINE'], center, GRID_SIZE // 3)
            pygame.draw.circle(self.screen, (200, 0, 200), center, GRID_SIZE // 3, 2)
        
        # 绘制传送门
        for portal_pair in self.portals:
            for i, portal in enumerate(portal_pair):
                color = COLORS['PORTAL'] if i == 0 else COLORS['TELEPORTER']
                center = (portal[0] * GRID_SIZE + GRID_SIZE // 2,
                         portal[1] * GRID_SIZE + GRID_SIZE // 2)
                pulse = int(8 * math.sin(self.frames * 0.15 + i * math.pi))
                pygame.draw.circle(self.screen, color, center, GRID_SIZE // 2 + pulse, 3)
        
        # 绘制食物
        for food_pos in self.food_positions:
            food_rect = pygame.Rect(food_pos[0] * GRID_SIZE,
                                   food_pos[1] * GRID_SIZE,
                                   GRID_SIZE, GRID_SIZE)
            pygame.draw.rect(self.screen, COLORS['FOOD'], food_rect)
            pygame.draw.circle(self.screen, (255, 100, 100),
                             (food_pos[0] * GRID_SIZE + GRID_SIZE // 2,
                              food_pos[1] * GRID_SIZE + GRID_SIZE // 2),
                             GRID_SIZE // 3)
        
        # 绘制道具
        for powerup in self.powerups:
            x = powerup.position[0] * GRID_SIZE + GRID_SIZE // 2
            y = powerup.position[1] * GRID_SIZE + GRID_SIZE // 2
            pulse = int(6 * math.sin(self.frames * 0.1))
            pygame.draw.circle(self.screen, powerup.color, (x, y),
                             GRID_SIZE // 2 + pulse)
            pygame.draw.circle(self.screen, (255, 255, 255), (x, y),
                             GRID_SIZE // 2 + pulse, 2)
            
            # 道具图标
            icon_text = self.small_font.render(powerup.type.value[0], True, (0, 0, 0))
            icon_rect = icon_text.get_rect(center=(x, y))
            self.screen.blit(icon_text, icon_rect)
        
        # 绘制蛇
        for snake in self.snakes:
            if not snake.alive:
                continue
            
            color = snake.color
            if snake.is_ghost:
                color = tuple(c // 3 for c in color)
            
            for i, segment in enumerate(snake.body):
                rect = pygame.Rect(segment[0] * GRID_SIZE, segment[1] * GRID_SIZE,
                                 GRID_SIZE - 2, GRID_SIZE - 2)
                
                if i == 0:  # 头部
                    head_color = tuple(min(255, c + 50) for c in color)
                    pygame.draw.rect(self.screen, head_color, rect, border_radius=8)
                    
                    # 绘制眼睛
                    self._draw_snake_eyes(snake, segment, head_color)
                else:  # 身体
                    body_color = tuple(max(0, c - i * 3) for c in color)
                    pygame.draw.rect(self.screen, body_color, rect, border_radius=4)
                
                # 护盾效果
                if snake.has_shield and i == 0:
                    shield_radius = GRID_SIZE + int(6 * math.sin(self.frames * 0.2))
                    pygame.draw.circle(self.screen, (0, 191, 255),
                                     (segment[0] * GRID_SIZE + GRID_SIZE // 2,
                                      segment[1] * GRID_SIZE + GRID_SIZE // 2),
                                     shield_radius, 3)
        
        # 绘制粒子效果
        for particle in self.particles:
            alpha = int(255 * (particle.lifetime / 60))
            size = max(1, int(particle.lifetime / 8))
            pygame.draw.circle(self.screen, particle.color,
                             (int(particle.x), int(particle.y)), size)
        
        # 绘制UI
        self._draw_ui()
        
        # 绘制游戏结束画面
        if self.game_over:
            self._draw_game_over_screen()
        
        # 绘制暂停画面
        if self.paused:
            self._draw_pause_screen()
        
        pygame.display.flip()
    
    def _draw_snake_eyes(self, snake: Snake, segment: Tuple[int, int], head_color: Tuple[int, int, int]):
        """绘制蛇眼睛"""
        eye_offset = 6
        center_x = segment[0] * GRID_SIZE + GRID_SIZE // 2
        center_y = segment[1] * GRID_SIZE + GRID_SIZE // 2
        
        if snake.direction == Direction.RIGHT:
            eye1 = (center_x + eye_offset, center_y - 4)
            eye2 = (center_x + eye_offset, center_y + 4)
        elif snake.direction == Direction.LEFT:
            eye1 = (center_x - eye_offset, center_y - 4)
            eye2 = (center_x - eye_offset, center_y + 4)
        elif snake.direction == Direction.UP:
            eye1 = (center_x - 4, center_y - eye_offset)
            eye2 = (center_x + 4, center_y - eye_offset)
        else:  # DOWN
            eye1 = (center_x - 4, center_y + eye_offset)
            eye2 = (center_x + 4, center_y + eye_offset)
        
        pygame.draw.circle(self.screen, (0, 0, 0), eye1, 3)
        pygame.draw.circle(self.screen, (0, 0, 0), eye2, 3)
        pygame.draw.circle(self.screen, (255, 255, 255), eye1, 1)
        pygame.draw.circle(self.screen, (255, 255, 255), eye2, 1)
    
    def _draw_ui(self):
        """绘制用户界面"""
        # 分数
        score_text = self.font.render(f"积分: {self.player.score}", True, COLORS['TEXT'])
        self.screen.blit(score_text, (10, 10))
        
        # 最高分
        if self.game_stats.high_score > 0:
            high_score_text = self.small_font.render(
                f"最高分: {self.game_stats.high_score}", True, (200, 200, 200))
            self.screen.blit(high_score_text, (10, 50))
        
        # 时间
        time_text = self.small_font.render(
            f"时间: {int(self.game_time)}s", True, COLORS['TEXT'])
        self.screen.blit(time_text, (10, 80))
        
        # 时间限制（如果有）
        if self.level_time_limit:
            remaining = max(0, self.level_time_limit - int(self.game_time))
            time_color = (255, 255, 100) if remaining > 30 else (255, 100, 100)
            limit_text = self.font.render(f"剩余时间: {remaining}s", True, time_color)
            self.screen.blit(limit_text, (WINDOW_WIDTH - 200, 10))
        
        # 目标分数（如果有）
        if self.target_score:
            target_text = self.small_font.render(
                f"目标: {self.target_score}", True, (255, 200, 100))
            self.screen.blit(target_text, (WINDOW_WIDTH - 200, 50))
        
        # 波次（无尽模式）
        if self.mode == GameMode.ENDLESS:
            wave_text = self.font.render(f"第 {self.wave_number} 波", True, (255, 100, 100))
            self.screen.blit(wave_text, (WINDOW_WIDTH // 2 - 50, 10))
        
        # 道具栏
        y_offset = 120
        for powerup_type, duration in self.player.active_powerups.items():
            color = self._get_powerup_color(powerup_type)
            text = self.small_font.render(
                f"{powerup_type.value}: {duration // 60}s", True, color)
            self.screen.blit(text, (10, y_offset))
            y_offset += 25
        
        # 特殊道具数量
        if self.player.bombs > 0:
            bomb_text = self.small_font.render(f"炸弹: {self.player.bombs} (按B使用)", 
                                             True, COLORS['BOMB'])
            self.screen.blit(bomb_text, (10, y_offset))
            y_offset += 25
        
        if self.player.teleports > 0:
            teleport_text = self.small_font.render(f"传送: {self.player.teleports} (按T使用)", 
                                                 True, COLORS['TELEPORTER'])
            self.screen.blit(teleport_text, (10, y_offset))
            y_offset += 25
        
        # 其他玩家信息
        if self.mode == GameMode.AI_OPPONENT and self.ai_snake.alive:
            ai_score_text = self.font.render(
                f"AI积分: {self.ai_snake.score}", True, COLORS['AI_SNAKE'])
            self.screen.blit(ai_score_text, (WINDOW_WIDTH - 200, 100))
        
        if self.mode == GameMode.MULTIPLAYER and self.player2.alive:
            p2_score_text = self.font.render(
                f"P2积分: {self.player2.score}", True, (255, 100, 255))
            self.screen.blit(p2_score_text, (WINDOW_WIDTH - 200, 140))
        
        # 控制提示
        controls_text = self.small_font.render(
            "方向键移动 | B炸弹 | T传送 | 空格暂停 | F5保存 | F9加载 | ESC退出", 
            True, (150, 150, 150))
        self.screen.blit(controls_text, (10, WINDOW_HEIGHT - 30))
    
    def _draw_game_over_screen(self):
        """绘制游戏结束画面"""
        overlay = pygame.Surface((WINDOW_WIDTH, WINDOW_HEIGHT))
        overlay.set_alpha(200)
        overlay.fill((0, 0, 0))
        self.screen.blit(overlay, (0, 0))
        
        game_over_text = self.large_font.render("游戏结束", True, (255, 50, 50))
        text_rect = game_over_text.get_rect(
            center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT // 2 - 100))
        self.screen.blit(game_over_text, text_rect)
        
        final_score_text = self.font.render(
            f"最终积分: {self.player.score}", True, COLORS['TEXT'])
        score_rect = final_score_text.get_rect(
            center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT // 2 - 30))
        self.screen.blit(final_score_text, score_rect)
        
        if self.player.score == self.game_stats.high_score:
            record_text = self.font.render("新纪录！", True, (255, 215, 0))
            record_rect = record_text.get_rect(
                center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT // 2 + 20))
            self.screen.blit(record_text, record_rect)
        
        restart_text = self.small_font.render(
            "按空格键重新开始", True, (200, 200, 200))
        restart_rect = restart_text.get_rect(
            center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT // 2 + 80))
        self.screen.blit(restart_text, restart_rect)
        
        menu_text = self.small_font.render(
            "按ESC键返回菜单", True, (200, 200, 200))
        menu_rect = menu_text.get_rect(
            center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT // 2 + 120))
        self.screen.blit(menu_text, menu_rect)
    
    def _draw_pause_screen(self):
        """绘制暂停画面"""
        pause_text = self.large_font.render("暂停", True, (255, 255, 100))
        text_rect = pause_text.get_rect(
            center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT // 2 - 50))
        self.screen.blit(pause_text, text_rect)
        
        continue_text = self.small_font.render(
            "按空格键继续", True, (200, 200, 200))
        continue_rect = continue_text.get_rect(
            center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT // 2 + 20))
        self.screen.blit(continue_text, continue_rect)
    
    def run(self):
        """主游戏循环"""
        print(f"开始游戏: {self.mode.value}")
        print("=" * 50)
        print("控制:")
        print("- 方向键: 移动")
        print("- B: 使用炸弹")
        print("- T: 使用传送")
        print("- 空格: 暂停/继续")
        print("- F5: 快速保存")
        print("- F9: 快速加载")
        print("- ESC: 退出游戏")
        print("=" * 50)
        
        while self.running:
            self.handle_input()
            self.update()
            self.render()
            self.clock.tick(int(self.speed * self.player.speed_boost))
        
        # 保存游戏统计
        self.save_manager.save_game(self.game_stats)
        pygame.quit()

# 关卡编辑器类
class LevelEditor:
    """关卡编辑器，用于创建自定义关卡"""
    
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
        pygame.display.set_caption("贪吃蛇关卡编辑器")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 36)
        self.small_font = pygame.font.Font(None, 24)
        
        self.running = True
        self.current_tool = "obstacle"  # obstacle, portal, mine, food, special
        self.obstacles = set()
        self.portals = []
        self.mines = set()
        self.special_items = []
        self.current_level = LevelData("新关卡", [], [], [], None, None, "normal")
        
        self.grid_snap = True
        self.show_help = True
    
    def handle_input(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.running = False
                elif event.key == pygame.K_s:
                    self._save_level()
                elif event.key == pygame.K_c:
                    self._clear_level()
                elif event.key == pygame.K_h:
                    self.show_help = not self.show_help
                elif event.key == pygame.K_1:
                    self.current_tool = "obstacle"
                elif event.key == pygame.K_2:
                    self.current_tool = "portal"
                elif event.key == pygame.K_3:
                    self.current_tool = "mine"
                elif event.key == pygame.K_4:
                    self.current_tool = "food"
                elif event.key == pygame.K_5:
                    self.current_tool = "special"
                elif event.key == pygame.K_g:
                    self.grid_snap = not self.grid_snap
            
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1:  # 左键
                    self._place_element(event.pos)
                elif event.button == 3:  # 右键
                    self._remove_element(event.pos)
    
    def _place_element(self, pos: Tuple[int, int]):
        """放置元素"""
        if self.grid_snap:
            grid_x = pos[0] // GRID_SIZE
            grid_y = pos[1] // GRID_SIZE
            pos = (grid_x, grid_y)
        
        if self.current_tool == "obstacle":
            self.obstacles.add(pos)
        elif self.current_tool == "mine":
            self.mines.add(pos)
        elif self.current_tool == "portal":
            if len(self.portals) < 2 and pos not in [p[0] for p in self.portals] and pos not in [p[1] for p in self.portals]:
                if not self.portals:
                    self.portals.append((pos, None))
                else:
                    # 完成传送门对
                    self.portals[0] = (self.portals[0][0], pos)
        elif self.current_tool == "special":
            self.special_items.append(("special", pos))
    
    def _remove_element(self, pos: Tuple[int, int]):
        """移除元素"""
        if self.grid_snap:
            grid_x = pos[0] // GRID_SIZE
            grid_y = pos[1] // GRID_SIZE
            pos = (grid_x, grid_y)
        
        if pos in self.obstacles:
            self.obstacles.remove(pos)
        elif pos in self.mines:
            self.mines.remove(pos)
        else:
            # 移除传送门
            self.portals = [(p1, p2) for p1, p2 in self.portals if p1 != pos and p2 != pos]
            # 移除特殊物品
            self.special_items = [(t, p) for t, p in self.special_items if p != pos]
    
    def _save_level(self):
        """保存关卡"""
        self.current_level.obstacles = list(self.obstacles)
        self.current_level.portals = self.portals
        self.current_level.special_items = self.special_items
        
        filename = input("输入关卡文件名 (不含扩展名): ").strip()
        if filename:
            if SaveManager.save_level(self.current_level, f"{filename}.json"):
                print(f"关卡已保存为: {filename}.json")
            else:
                print("保存失败！")
    
    def _clear_level(self):
        """清空关卡"""
        self.obstacles.clear()
        self.portals.clear()
        self.mines.clear()
        self.special_items.clear()
        print("关卡已清空")
    
    def render(self):
        self.screen.fill(COLORS['BACKGROUND'])
        
        # 绘制网格
        for x in range(0, WINDOW_WIDTH, GRID_SIZE):
            pygame.draw.line(self.screen, COLORS['GRID'], (x, 0), (x, WINDOW_HEIGHT))
        for y in range(0, WINDOW_HEIGHT, GRID_SIZE):
            pygame.draw.line(self.screen, COLORS['GRID'], (0, y), (WINDOW_WIDTH, y))
        
        # 绘制元素
        for obs in self.obstacles:
            rect = pygame.Rect(obs[0] * GRID_SIZE, obs[1] * GRID_SIZE,
                             GRID_SIZE, GRID_SIZE)
            pygame.draw.rect(self.screen, COLORS['OBSTACLE'], rect)
        
        for mine in self.mines:
            center = (mine[0] * GRID_SIZE + GRID_SIZE // 2,
                     mine[1] * GRID_SIZE + GRID_SIZE // 2)
            pygame.draw.circle(self.screen, COLORS['MINE'], center, GRID_SIZE // 3)
        
        for i, (p1, p2) in enumerate(self.portals):
            color = COLORS['PORTAL'] if i == 0 else COLORS['TELEPORTER']
            for portal in [p1, p2]:
                if portal:
                    center = (portal[0] * GRID_SIZE + GRID_SIZE // 2,
                             portal[1] * GRID_SIZE + GRID_SIZE // 2)
                    pygame.draw.circle(self.screen, color, center, GRID_SIZE // 2, 3)
        
        # 绘制UI
        title_text = self.font.render("贪吃蛇关卡编辑器", True, COLORS['TEXT'])
        self.screen.blit(title_text, (10, 10))
        
        tool_text = self.small_font.render(f"当前工具: {self.current_tool}", True, COLORS['TEXT'])
        self.screen.blit(tool_text, (10, 60))
        
        if self.show_help:
            help_texts = [
                "控制:",
                "1-5: 选择工具",
                "左键: 放置元素",
                "右键: 移除元素",
                "S: 保存关卡",
                "C: 清空关卡",
                "G: 切换网格吸附",
                "H: 切换帮助",
                "ESC: 退出"
            ]
            
            for i, text in enumerate(help_texts):
                help_surface = self.small_font.render(text, True, (200, 200, 200))
                self.screen.blit(help_surface, (WINDOW_WIDTH - 300, 100 + i * 25))
        
        pygame.display.flip()
    
    def run(self):
        print("关卡编辑器启动")
        print("=" * 30)
        print("工具:")
        print("1: 障碍物")
        print("2: 传送门")
        print("3: 地雷")
        print("4: 食物")
        print("5: 特殊物品")
        print("=" * 30)
        
        while self.running:
            self.handle_input()
            self.render()
            self.clock.tick(60)
        
        pygame.quit()

def main():
    """主菜单和游戏启动器"""
    print("🐍 超级贪吃蛇 v2.0 🐍")
    print("=" * 50)
    print("请选择:")
    print("1. 经典模式")
    print("2. AI对战模式")
    print("3. 生存模式")
    print("4. 时间挑战模式")
    print("5. 无尽模式")
    print("6. 多人对战模式")
    print("7. 关卡编辑器")
    print("8. 加载自定义关卡")
    print("9. 查看统计和成就")
    print("0. 退出")
    print("=" * 50)
    
    choice = input("输入选择 (0-9): ").strip()
    
    mode_map = {
        "1": GameMode.CLASSIC,
        "2": GameMode.AI_OPPONENT,
        "3": GameMode.SURVIVAL,
        "4": GameMode.TIME_CHALLENGE,
        "5": GameMode.ENDLESS,
        "6": GameMode.MULTIPLAYER,
        "7": "editor",
        "8": "load_level",
        "9": "stats",
        "0": "exit"
    }
    
    selected = mode_map.get(choice, "invalid")
    
    if selected == "exit":
        print("感谢游戏！再见！")
        return
    elif selected == "editor":
        editor = LevelEditor()
        editor.run()
    elif selected == "stats":
        _show_game_stats()
    elif selected == "load_level":
        _load_custom_level()
    elif selected != "invalid":
        game = Game(selected)
        game.run()
    else:
        print("无效选择，请重试！")
        main()

def _show_game_stats():
    """显示游戏统计"""
    save_manager = SaveManager()
    stats = save_manager.load_game()
    
    if stats:
        print("\n📊 游戏统计")
        print("=" * 30)
        print(f"玩家名称: {stats.player_name}")
        print(f"游戏次数: {stats.games_played}")
        print(f"总积分: {stats.total_score}")
        print(f"最高分: {stats.high_score}")
        print(f"总游戏时间: {int(stats.total_time)}秒")
        print(f"平均分数: {stats.total_score // max(stats.games_played, 1)}")
        
        if stats.achievements:
            print(f"\n🏆 已解锁成就 ({len(stats.achievements)}):")
            for achievement in stats.achievements:
                print(f"  • {achievement}")
        
        if stats.unlocked_levels:
            print(f"\n🔓 已解锁关卡: {sorted(stats.unlocked_levels)}")
    else:
        print("没有找到游戏数据！")
    
    input("\n按回车键返回主菜单...")
    main()

def _load_custom_level():
    """加载自定义关卡"""
    level_name = input("输入关卡文件名 (不含扩展名): ").strip()
    if level_name:
        try:
            game = Game(GameMode.CLASSIC, f"{level_name}.json")
            game.run()
        except Exception as e:
            print(f"加载关卡失败: {e}")
            input("按回车键返回主菜单...")
            main()
    else:
        main()

if __name__ == "__main__":
    main()