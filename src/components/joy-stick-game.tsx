'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { FaceLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';
import Webcam from 'react-webcam';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2 } from 'lucide-react';
import { BirdIcon } from '@/components/icons/BirdIcon';
import { DinoIcon } from '@/components/icons/DinoIcon';
import { CactusIcon } from '@/components/icons/CactusIcon';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Game constants
const BIRD_SIZE = 40;
const GRAVITY = 0.5;
const JUMP_STRENGTH = -8;
const OBSTACLE_WIDTH = 80;
const OBSTACLE_GAP_BASE = 200;
const JOYSTICK_OBSTACLE_SPEED = 2.8;
const BIRD_X_POSITION = 150;
const SMILE_THRESHOLD = 0.6;
const BROW_RAISE_THRESHOLD = 0.4;


const DINO_SIZE = 50;
const DINO_Y_POSITION = 550;
const DINO_GRAVITY = 0.6;
const DINO_JUMP_STRENGTH = -15;
const DINO_OBSTACLE_SPEED = 5;
const CACTUS_WIDTH = 40;
const CACTUS_HEIGHT = 80;


type JOYstickObstacle = {
  x: number;
  topHeight: number;
  gap: number;
};

type DinoObstacle = {
  x: number;
  width: number;
  height: number;
};

type LevelData = {
  obstacles: { position: number; height: number; spacing: number }[];
};

type GameState = 'start' | 'playing' | 'gameOver';
type GameMode = 'joystick' | 'dino';

const formSchema = z.object({
  gameMode: z.enum(['joystick', 'dino']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  controlMode: z.enum(['finger', 'smile', 'both']),
});

type FormValues = z.infer<typeof formSchema>;

export default function JOYstickPage() {
  const [gameState, setGameState] = useState<GameState>('start');
  const [gameMode, setGameMode] = useState<GameMode>('joystick');
  
  // JOYstick state
  const [birdPosition, setBirdPosition] = useState(300);
  const [birdVelocity, setBirdVelocity] = useState(0);
  const [joystickObstacles, setJOYstickObstacles] = useState<JOYstickObstacle[]>([]);
  
  // Dino state
  const [dinoPosition, setDinoPosition] = useState(DINO_Y_POSITION);
  const [dinoVelocity, setDinoVelocity] = useState(0);
  const [dinoObstacles, setDinoObstacles] = useState<DinoObstacle[]>([]);

  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>(undefined);

  const gameLoopRef = useRef<number>();
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const levelDataRef = useRef<LevelData>({ obstacles: [] });
  const joystickObstacleCursorRef = useRef(0);
  const webcamRef = useRef<Webcam>(null);
  const lastVideoTimeRef = useRef(-1);
  const fingerTargetYRef = useRef<number | null>(null);
  const fingerTrackingActiveRef = useRef(false);
  const { toast } = useToast();

  const [mouthSmile, setMouthSmile] = useState(0);
  const [browRaise, setBrowRaise] = useState(0);
  const [fingerTracked, setFingerTracked] = useState(false);
  const [mounted, setMounted] = useState(false);

  const jumpSoundRef = useRef<HTMLAudioElement | null>(null);
  const gameOverSoundRef = useRef<HTMLAudioElement | null>(null);


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gameMode: 'joystick',
      difficulty: 'medium',
      controlMode: 'finger',
    },
  });

  const selectedGameMode = form.watch('gameMode');
  const selectedControlMode = form.watch('controlMode');
  const controlsReady =
    selectedGameMode === 'joystick'
      ? selectedControlMode === 'smile'
        ? Boolean(faceLandmarker)
        : selectedControlMode === 'finger'
        ? Boolean(handLandmarker)
        : Boolean(faceLandmarker || handLandmarker)
      : Boolean(faceLandmarker);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setGameMode(selectedGameMode);
    if (mounted && typeof window !== 'undefined') {
      const storedBestScore = localStorage.getItem(`bestScore_${selectedGameMode}`);
      if (storedBestScore) {
        setBestScore(parseInt(storedBestScore, 10));
      } else {
        setBestScore(0);
      }
    }
  }, [selectedGameMode, mounted]);
  
  useEffect(() => {
    // Initialize audio refs on client
    jumpSoundRef.current = new Audio('https://cdn.freesound.org/previews/510/510163_10878949-lq.mp3');
    gameOverSoundRef.current = new Audio('https://cdn.freesound.org/previews/243/243021_4263495-lq.mp3');
    jumpSoundRef.current.volume = 0.5;
    gameOverSoundRef.current.volume = 0.4;
    
    const createLandmarkers = async () => {
      try {
        const { FaceLandmarker, HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );

        const [faceResult, handResult] = await Promise.allSettled([
          FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
              delegate: 'GPU',
            },
            outputFaceBlendshapes: true,
            runningMode: 'VIDEO',
            numFaces: 1,
          }),
          HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
          }),
        ]);

        if (faceResult.status === 'fulfilled') {
          setFaceLandmarker(faceResult.value);
        } else {
          console.error('Error creating FaceLandmarker:', faceResult.reason);
        }

        if (handResult.status === 'fulfilled') {
          setHandLandmarker(handResult.value);
        } else {
          console.error('Error creating HandLandmarker:', handResult.reason);
        }

        if (faceResult.status === 'rejected' && handResult.status === 'rejected') {
          toast({
            variant: 'destructive',
            title: 'Landmarker Error',
            description: 'Could not initialize camera controls. Please refresh the page.',
          });
        }
      } catch (error) {
        console.error('Error creating landmarkers:', error);
        toast({
          variant: 'destructive',
          title: 'Landmarker Error',
          description: 'Could not initialize camera controls. Please refresh the page.',
        });
      }
    };
    createLandmarkers();
  }, [toast]);

  const handleJump = useCallback(() => {
    if (gameState !== 'playing') return;

    if (jumpSoundRef.current) {
      jumpSoundRef.current.currentTime = 0;
      jumpSoundRef.current.play();
    }

    if (gameMode === 'joystick') {
      setBirdVelocity(JUMP_STRENGTH);
    } else if (gameMode === 'dino' && dinoPosition >= DINO_Y_POSITION) {
      setDinoVelocity(DINO_JUMP_STRENGTH);
    }
  }, [gameState, gameMode, dinoPosition]);

  const predictWebcam = useCallback(() => {
    if (!webcamRef.current || !webcamRef.current.video || webcamRef.current.video.readyState < 2) {
      return;
    }
    if (!faceLandmarker && !handLandmarker) {
      return;
    }
  
    const video = webcamRef.current.video;
    if (lastVideoTimeRef.current === video.currentTime) {
        return;
    }
    lastVideoTimeRef.current = video.currentTime;
  
    const now = Date.now();
    let currentSmile = 0;
    let currentBrowRaise = 0;
    let currentFingerTracked = false;
    let currentFingerTargetY: number | null = null;
    let shouldJump = false;

    if (faceLandmarker) {
      const faceResults = faceLandmarker.detectForVideo(video, now);
      if (faceResults.faceBlendshapes && faceResults.faceBlendshapes.length > 0) {
        const blendshapes = faceResults.faceBlendshapes[0].categories;
        const smileLeft = blendshapes.find((shape) => shape.categoryName === 'mouthSmileLeft')?.score ?? 0;
        const smileRight = blendshapes.find((shape) => shape.categoryName === 'mouthSmileRight')?.score ?? 0;
        currentSmile = Math.max(smileLeft, smileRight);
        currentBrowRaise = blendshapes.find((shape) => shape.categoryName === 'browInnerUp')?.score ?? 0;
      }
    }

    if (handLandmarker && gameMode === 'joystick') {
      const handResults = handLandmarker.detectForVideo(video, now);
      if (handResults.landmarks && handResults.landmarks.length > 0) {
        const hand = handResults.landmarks[0];
        const indexTip = hand[8];
        if (indexTip) {
          const gameHeight = gameContainerRef.current?.clientHeight || window.innerHeight;
          currentFingerTracked = true;
          currentFingerTargetY = Math.max(
            0,
            Math.min(indexTip.y * gameHeight - BIRD_SIZE / 2, gameHeight - BIRD_SIZE)
          );
        }
      }
    }

    setMouthSmile(currentSmile);
    setBrowRaise(currentBrowRaise);
    setFingerTracked(currentFingerTracked);

    if (gameMode === 'joystick') {
      const smileEnabled = selectedControlMode === 'smile' || selectedControlMode === 'both';
      const fingerEnabled = selectedControlMode === 'finger' || selectedControlMode === 'both';
      fingerTrackingActiveRef.current = fingerEnabled && currentFingerTracked && currentFingerTargetY !== null;
      fingerTargetYRef.current = currentFingerTargetY;

      if (smileEnabled && currentSmile > SMILE_THRESHOLD && !fingerTrackingActiveRef.current) {
        shouldJump = true;
      }
    } else if (gameMode === 'dino') {
      fingerTrackingActiveRef.current = false;
      fingerTargetYRef.current = null;
      if (currentBrowRaise > BROW_RAISE_THRESHOLD) {
        shouldJump = true;
      }
    }

    if (shouldJump) {
      handleJump();
    }
  }, [faceLandmarker, handLandmarker, handleJump, gameMode, selectedControlMode]);

  const resetGame = useCallback(
    () => {
      const height = gameContainerRef.current?.clientHeight || window.innerHeight;
      const width = gameContainerRef.current?.clientWidth || window.innerWidth;
      
      setGameState('playing');
      setScore(0);
      
      if(gameMode === 'joystick') {
        setBirdPosition(height / 2);
        setBirdVelocity(0);
        fingerTrackingActiveRef.current = false;
        fingerTargetYRef.current = null;

        levelDataRef.current = { obstacles: [] };
        joystickObstacleCursorRef.current = 0;

        const initialObstacles: JOYstickObstacle[] = [];
        let currentX = width;
        for (let i = 0; i < 5; i++) {
          const pattern = levelDataRef.current.obstacles[joystickObstacleCursorRef.current];
          const gap =
            OBSTACLE_GAP_BASE -
            (form.getValues('difficulty') === 'hard'
              ? 50
              : form.getValues('difficulty') === 'medium'
              ? 25
              : 0);
          initialObstacles.push({
            x: currentX,
            topHeight: pattern?.height || Math.random() * (height - gap - 100) + 50,
            gap: gap,
          });
          currentX += pattern?.spacing || 350;
          if (levelDataRef.current.obstacles.length > 0) {
            joystickObstacleCursorRef.current =
              (joystickObstacleCursorRef.current + 1) % levelDataRef.current.obstacles.length;
          }
        }
        setJOYstickObstacles(initialObstacles);
      } else if (gameMode === 'dino') {
        setDinoPosition(DINO_Y_POSITION);
        setDinoVelocity(0);
        setDinoObstacles([{x: width, width: CACTUS_WIDTH, height: CACTUS_HEIGHT}]);
      }
    },
    [form, gameMode]
  );
  
  const handleGameOver = useCallback(() => {
    if (gameOverSoundRef.current) {
        gameOverSoundRef.current.currentTime = 0;
        gameOverSoundRef.current.play();
    }
    setGameState('gameOver');
    const finalScore = gameMode === 'joystick' ? score : Math.floor(score / 10);
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      if (mounted && typeof window !== 'undefined') {
        localStorage.setItem(`bestScore_${gameMode}`, finalScore.toString());
      }
    }
  }, [score, bestScore, gameMode, mounted]);


  const gameLoop = useCallback(() => {
    const height = gameContainerRef.current?.clientHeight || window.innerHeight;
    const width = gameContainerRef.current?.clientWidth || window.innerWidth;

    predictWebcam();

    if(gameMode === 'joystick'){
      if (fingerTrackingActiveRef.current && fingerTargetYRef.current !== null) {
        const targetY = fingerTargetYRef.current;
        setBirdVelocity(0);
        setBirdPosition((p) => p + (targetY - p) * 0.35);
      } else {
        setBirdVelocity((v) => v + GRAVITY);
        setBirdPosition((p) => p + birdVelocity);
      }

      let passedObstacle = false;
      let newObstacles = joystickObstacles.map((obstacle) => ({
        ...obstacle,
        x: obstacle.x - JOYSTICK_OBSTACLE_SPEED,
      }));

      const lastObstacle = newObstacles[newObstacles.length - 1];
      if (lastObstacle && lastObstacle.x < width) {
        const pattern = levelDataRef.current.obstacles[joystickObstacleCursorRef.current];
        const gap =
          OBSTACLE_GAP_BASE -
          (form.getValues('difficulty') === 'hard'
            ? 50
            : form.getValues('difficulty') === 'medium'
            ? 25
            : 0);
        newObstacles.push({
          x: lastObstacle.x + (pattern?.spacing || 350),
          topHeight: pattern?.height || Math.random() * (height - gap - 100) + 50,
          gap: gap,
        });
        if (levelDataRef.current.obstacles.length > 0) {
          joystickObstacleCursorRef.current =
            (joystickObstacleCursorRef.current + 1) % levelDataRef.current.obstacles.length;
        }
      }

      newObstacles = newObstacles.filter((o) => o.x > -OBSTACLE_WIDTH);
      setJOYstickObstacles(newObstacles);

      const activeObstacle = newObstacles.find(
        (o) => o.x + OBSTACLE_WIDTH > BIRD_X_POSITION && o.x < BIRD_X_POSITION + BIRD_SIZE
      );
      if (activeObstacle && activeObstacle.x + OBSTACLE_WIDTH < BIRD_X_POSITION + JOYSTICK_OBSTACLE_SPEED) {
        passedObstacle = true;
      }
      if (passedObstacle) {
        setScore((s) => s + 1);
      }

      if (birdPosition > height - BIRD_SIZE || birdPosition < 0) {
        handleGameOver();
      }

      if (activeObstacle) {
        if (
          birdPosition < activeObstacle.topHeight ||
          birdPosition + BIRD_SIZE > activeObstacle.topHeight + activeObstacle.gap
        ) {
          handleGameOver();
        }
      }
    } else if (gameMode === 'dino'){
        setDinoVelocity((v) => v + DINO_GRAVITY);
        setDinoPosition((p) => Math.min(p + dinoVelocity, DINO_Y_POSITION));

        let newObstacles = dinoObstacles.map(o => ({...o, x: o.x - DINO_OBSTACLE_SPEED}));

        const lastObstacle = newObstacles[newObstacles.length - 1];
        if(lastObstacle && lastObstacle.x < width - 300 - Math.random() * 400){
            newObstacles.push({x: width, width: CACTUS_WIDTH, height: CACTUS_HEIGHT });
        }

        newObstacles = newObstacles.filter(o => o.x > -o.width);
        setDinoObstacles(newObstacles);
        setScore(s => s + 1);

        const dinoX = width / 4;
        const activeObstacle = newObstacles.find(
          (o) => o.x < dinoX + DINO_SIZE && o.x + o.width > dinoX
        );
        
        if (activeObstacle) {
          if (dinoPosition + DINO_SIZE > height - activeObstacle.height) {
            handleGameOver();
          }
        }
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [birdVelocity, joystickObstacles, dinoVelocity, dinoObstacles, form, predictWebcam, gameMode, handleGameOver]);

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

  const onSubmit = async (values: FormValues) => {
    setIsGenerating(true);
    setGameMode(values.gameMode);
    resetGame();
    setIsGenerating(false);
  };
  
  const onUserMedia = () => {
    setHasCameraPermission(true);
  };
  
  const onUserMediaError = (error: string | DOMException) => {
    console.error('Webcam error:', error);
    setHasCameraPermission(false);
    toast({
      variant: 'destructive',
      title: 'Camera Access Denied',
      description: 'Please enable camera permissions to use face controls.',
    });
  };

  const renderStartScreen = () => (
    <div className="flex items-center justify-center h-full bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <CardTitle className="text-4xl font-bold text-center font-headline text-primary">JOYstick</CardTitle>
          <CardDescription className="text-center">Configure your adventure and start playing!</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
               <div className="rounded-lg overflow-hidden relative">
                <Webcam
                  ref={webcamRef}
                  mirrored={true}
                  onUserMedia={onUserMedia}
                  onUserMediaError={onUserMediaError}
                  className="w-full aspect-video"
                  videoConstraints={{ facingMode: 'user' }}
                />
                {hasCameraPermission === false && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Alert variant="destructive" className="w-auto">
                            <AlertTitle>Camera Access Required</AlertTitle>
                            <AlertDescription>Please allow camera access.</AlertDescription>
                        </Alert>
                    </div>
                )}
                {hasCameraPermission === undefined && (
                     <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <p>Waiting for camera...</p>
                    </div>
                )}
              </div>

              <FormField
                control={form.control}
                name="gameMode"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Game Mode</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="joystick" />
                          </FormControl>
                          <FormLabel className="font-normal">
                           flappyhappy (Smile or Finger Tracking)
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="dino" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            brow dino (Raise Eyebrows to Jump)
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control} name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty</FormLabel>
                     <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-2"
                      >
                        <FormItem className="flex items-center space-x-1 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="easy" />
                          </FormControl>
                          <FormLabel className="font-normal">Easy</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-1 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="medium" />
                          </FormControl>
                          <FormLabel className="font-normal">Medium</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-1 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="hard" />
                          </FormControl>
                          <FormLabel className="font-normal">Hard</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {selectedGameMode === 'joystick' && (
                <FormField
                  control={form.control}
                  name="controlMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Flappy Controls</FormLabel>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="finger" />
                          </FormControl>
                          <FormLabel className="font-normal">Finger only (easiest)</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="smile" />
                          </FormControl>
                          <FormLabel className="font-normal">Smile only</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="both" />
                          </FormControl>
                          <FormLabel className="font-normal">Both</FormLabel>
                        </FormItem>
                      </RadioGroup>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isGenerating || !controlsReady || hasCameraPermission !== true}>
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isGenerating ? 'Generating Level...' : !controlsReady ? 'Initializing...' : hasCameraPermission !== true ? 'Camera Required' : 'Start Game'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );

  const renderGame = () => (
    <div className="relative w-full h-full overflow-hidden">
      <Webcam
        ref={webcamRef}
        mirrored={true}
        className="absolute top-4 right-4 w-48 h-36 rounded-md border-2 border-primary z-30 opacity-80"
        videoConstraints={{ facingMode: 'user' }}
      />
      <div className="absolute top-8 left-1/2 -translate-x-1/2 text-7xl font-bold text-primary-foreground/20 z-20 font-headline" style={{ textShadow: '2px 2px 0px hsl(var(--primary))' }}>
        {gameMode === 'joystick' ? score : Math.floor(score / 10)}
      </div>

      <div className="absolute top-4 left-4 z-40 bg-background/50 p-2 rounded-md text-xs">
          <p>Smile: {mouthSmile.toFixed(2)}</p>
          <p>Finger: {fingerTracked ? 'Tracking' : 'Not Found'}</p>
          <p>Brow Raise: {browRaise.toFixed(2)}</p>
      </div>

      {gameMode === 'joystick' ? (
        <>
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
          {joystickObstacles.map((obstacle, i) => (
            <div key={i} className="absolute" style={{ left: obstacle.x, height: '100%', zIndex: 5 }}>
              <div className="absolute bg-accent rounded-md" style={{ top: 0, width: OBSTACLE_WIDTH, height: obstacle.topHeight }} />
              <div className="absolute bg-accent rounded-md" style={{ top: obstacle.topHeight + obstacle.gap, width: OBSTACLE_WIDTH, bottom: 0 }} />
            </div>
          ))}
        </>
      ) : (
        <>
          <DinoIcon
            style={{
              position: 'absolute',
              left: '25%',
              top: dinoPosition,
              width: DINO_SIZE,
              height: DINO_SIZE,
              zIndex: 10,
            }}
          />
          {dinoObstacles.map((obstacle, i) => (
            <div key={i} className="absolute" style={{ left: obstacle.x, bottom: 0, width: obstacle.width, height: obstacle.height, zIndex: 5 }}>
              <CactusIcon className="w-full h-full" />
            </div>
          ))}
           <div className="absolute bottom-0 left-0 w-full h-1/4 bg-background z-0" />
        </>
      )}
    </div>
  );

  const renderGameOverScreen = () => (
    <div className="flex items-center justify-center h-full bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-sm text-center shadow-2xl">
        <CardHeader>
          <CardTitle className="text-4xl font-bold text-destructive">Game Over</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <CardDescription>Your final score is:</CardDescription>
            <p className="text-8xl font-bold text-primary font-headline">{gameMode === 'joystick' ? score : Math.floor(score/10)}</p>
          </div>
          <div>
            <CardDescription>Best Score:</CardDescription>
            <p className="text-4xl font-bold text-secondary-foreground">{bestScore}</p>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button onClick={() => resetGame()} className="w-full">Restart with same settings</Button>
          <Button onClick={() => setGameState('start')} variant="outline" className="w-full">Back to Menu</Button>
        </CardFooter>
      </Card>
    </div>
  );
  
  return (
    <main ref={gameContainerRef} className="w-screen h-screen overflow-hidden bg-background select-none">
      {gameState === 'playing' && renderGame()}
      {gameState === 'start' && renderStartScreen()}
      {gameState === 'gameOver' && renderGameOverScreen()}
    </main>
  );
}
