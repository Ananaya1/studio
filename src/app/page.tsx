'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { generateLevel } from '@/ai/flows/generate-level';
import type { GenerateLevelOutput } from '@/ai/flows/generate-level';
import { BirdIcon } from '@/components/icons/BirdIcon';

// Game constants
const BIRD_SIZE = 40;
const GRAVITY = 0.5;
const JUMP_STRENGTH = -8;
const OBSTACLE_WIDTH = 80;
const OBSTACLE_GAP_BASE = 200;
const OBSTACLE_SPEED = 4;
const BIRD_X_POSITION = 150;

type Obstacle = {
  x: number;
  topHeight: number;
  gap: number;
};

type LevelData = {
  obstacles: { position: number; height: number; spacing: number }[];
};

type GameState = 'start' | 'playing' | 'gameOver';

const formSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']),
  style: z.string().min(2, "Style must be at least 2 characters."),
  theme: z.string().min(2, "Theme must be at least 2 characters."),
});

type FormValues = z.infer<typeof formSchema>;

export default function SoarScapePage() {
  const [gameState, setGameState] = useState<GameState>('start');
  const [birdPosition, setBirdPosition] = useState(300);
  const [birdVelocity, setBirdVelocity] = useState(0);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [score, setScore] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const gameLoopRef = useRef<number>();
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const levelDataRef = useRef<LevelData>({ obstacles: [] });
  const obstacleCursorRef = useRef(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      difficulty: 'medium',
      style: 'futuristic',
      theme: 'space',
    },
  });

  const resetGame = useCallback((layout: GenerateLevelOutput | null) => {
    const height = gameContainerRef.current?.clientHeight || window.innerHeight;
    const width = gameContainerRef.current?.clientWidth || window.innerWidth;
    
    setGameState('playing');
    setBirdPosition(height / 2);
    setBirdVelocity(0);
    setScore(0);
    
    levelDataRef.current = { obstacles: [] };
    obstacleCursorRef.current = 0;
    
    if (layout) {
      try {
        const parsedLayout = JSON.parse(layout.levelLayout);
        if (parsedLayout.obstacles && Array.isArray(parsedLayout.obstacles)) {
          levelDataRef.current = parsedLayout;
        }
      } catch (error) {
        console.error("Failed to parse level layout, using fallback:", error);
      }
    }
    
    const initialObstacles: Obstacle[] = [];
    let currentX = width;
    for (let i = 0; i < 5; i++) {
      const pattern = levelDataRef.current.obstacles[obstacleCursorRef.current];
      const gap = OBSTACLE_GAP_BASE - (form.getValues('difficulty') === 'hard' ? 50 : form.getValues('difficulty') === 'medium' ? 25 : 0);
      initialObstacles.push({
        x: currentX,
        topHeight: pattern?.height || Math.random() * (height - gap - 100) + 50,
        gap: gap,
      });
      currentX += pattern?.spacing || 350;
      if (levelDataRef.current.obstacles.length > 0) {
        obstacleCursorRef.current = (obstacleCursorRef.current + 1) % levelDataRef.current.obstacles.length;
      }
    }
    setObstacles(initialObstacles);
  }, [form]);

  const gameLoop = useCallback(() => {
    const height = gameContainerRef.current?.clientHeight || window.innerHeight;
    const width = gameContainerRef.current?.clientWidth || window.innerWidth;

    setBirdVelocity(v => v + GRAVITY);
    setBirdPosition(p => p + birdVelocity);

    let passedObstacle = false;
    let newObstacles = obstacles.map(obstacle => ({
      ...obstacle,
      x: obstacle.x - OBSTACLE_SPEED
    }));

    const lastObstacle = newObstacles[newObstacles.length - 1];
    if (lastObstacle && lastObstacle.x < width) {
        const pattern = levelDataRef.current.obstacles[obstacleCursorRef.current];
        const gap = OBSTACLE_GAP_BASE - (form.getValues('difficulty') === 'hard' ? 50 : form.getValues('difficulty') === 'medium' ? 25 : 0);
        newObstacles.push({
            x: lastObstacle.x + (pattern?.spacing || 350),
            topHeight: pattern?.height || Math.random() * (height - gap - 100) + 50,
            gap: gap,
        });
        if (levelDataRef.current.obstacles.length > 0) {
          obstacleCursorRef.current = (obstacleCursorRef.current + 1) % levelDataRef.current.obstacles.length;
        }
    }

    newObstacles = newObstacles.filter(o => o.x > -OBSTACLE_WIDTH);
    setObstacles(newObstacles);

    const activeObstacle = newObstacles.find(o => o.x + OBSTACLE_WIDTH > BIRD_X_POSITION && o.x < BIRD_X_POSITION + BIRD_SIZE);
    if (activeObstacle && activeObstacle.x + OBSTACLE_WIDTH < BIRD_X_POSITION + OBSTACLE_SPEED) {
        passedObstacle = true;
    }
    if (passedObstacle) {
      setScore(s => s + 1);
    }

    if (birdPosition > height - BIRD_SIZE || birdPosition < 0) {
      setGameState('gameOver');
    }

    if (activeObstacle) {
      if (birdPosition < activeObstacle.topHeight || birdPosition + BIRD_SIZE > activeObstacle.topHeight + activeObstacle.gap) {
        setGameState('gameOver');
      }
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [birdVelocity, obstacles, form]);
  
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, gameLoop]);

  const handleJump = useCallback(() => {
    if (gameState === 'playing') {
      setBirdVelocity(JUMP_STRENGTH);
    }
  }, [gameState]);

  const onSubmit = async (values: FormValues) => {
    setIsGenerating(true);
    try {
      const result = await generateLevel(values);
      resetGame(result);
    } catch (error) {
      console.error('Failed to generate level:', error);
      resetGame(null);
    } finally {
      setIsGenerating(false);
    }
  };
  
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handleJump();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleJump]);
  
  const renderStartScreen = () => (
    <div className="flex items-center justify-center h-full bg-background/50 backdrop-blur-sm">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <CardTitle className="text-4xl font-bold text-center font-headline text-primary">SoarScape</CardTitle>
          <CardDescription className="text-center">Configure your flight and start the adventure!</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control} name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a difficulty" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control} name="style"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visual Style</FormLabel>
                    <FormControl><Input placeholder="e.g., futuristic, fantasy, cartoon" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control} name="theme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level Theme</FormLabel>
                    <FormControl><Input placeholder="e.g., underwater, space, jungle" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isGenerating}>
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isGenerating ? 'Generating Level...' : 'Start Game'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );

  const renderGame = () => (
    <div className="relative w-full h-full overflow-hidden" onClick={handleJump}>
      <div className="absolute top-8 left-1/2 -translate-x-1/2 text-7xl font-bold text-primary-foreground/20 z-20 font-headline" style={{ textShadow: '2px 2px 0px hsl(var(--primary))' }}>
        {score}
      </div>
      <BirdIcon
        style={{
          position: 'absolute',
          left: BIRD_X_POSITION,
          top: birdPosition,
          width: BIRD_SIZE,
          height: BIRD_SIZE,
          transform: `rotate(${Math.min(Math.max(birdVelocity * 2, -20), 20)}deg)`,
          transition: 'transform 0.1s linear',
          zIndex: 10,
        }}
      />
      {obstacles.map((obstacle, i) => (
        <div key={i} className="absolute" style={{ left: obstacle.x, height: '100%' }}>
          <div className="absolute bg-accent rounded-md" style={{ top: 0, width: OBSTACLE_WIDTH, height: obstacle.topHeight }} />
          <div className="absolute bg-accent rounded-md" style={{ top: obstacle.topHeight + obstacle.gap, width: OBSTACLE_WIDTH, bottom: 0 }} />
        </div>
      ))}
    </div>
  );

  const renderGameOverScreen = () => (
    <div className="flex items-center justify-center h-full bg-background/50 backdrop-blur-sm">
      <Card className="w-full max-w-sm text-center shadow-2xl">
        <CardHeader>
          <CardTitle className="text-4xl font-bold text-destructive">Game Over</CardTitle>
          <CardDescription>Your final score is:</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-8xl font-bold text-primary font-headline">{score}</p>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button onClick={() => resetGame(null)} className="w-full">Restart with same settings</Button>
          <Button onClick={() => setGameState('start')} variant="outline" className="w-full">Back to Menu</Button>
        </CardFooter>
      </Card>
    </div>
  );
  
  return (
    <main ref={gameContainerRef} className="w-screen h-screen overflow-hidden bg-background select-none cursor-pointer">
      {gameState === 'playing' && renderGame()}
      {gameState === 'start' && renderStartScreen()}
      {gameState === 'gameOver' && renderGameOverScreen()}
    </main>
  );
}
