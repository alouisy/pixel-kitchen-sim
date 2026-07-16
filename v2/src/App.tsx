import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls, Sky, Stars, Stats } from '@react-three/drei';
import { LevelGeometry } from './components/World/LevelGeometry';
import { PlayerController } from './components/Player/PlayerController';
import { EntityManager } from './components/World/EntityManager';
import { GameLoop } from './components/Core/GameLoop';
import { HUD } from './components/UI/HUD';
import { MainMenu } from './components/UI/MainMenu';
import { PauseMenu } from './components/UI/PauseMenu';
import { SettingsMenu } from './components/UI/SettingsMenu';
import { LevelSelectMenu } from './components/UI/LevelSelectMenu';
import { EditorUI } from './components/UI/EditorUI';
import { LevelManager } from './components/UI/LevelManager';
import { LevelEditor } from './components/Editor/LevelEditor';
import { LevelEndMenu } from './components/UI/LevelEndMenu';
import { LevelInstructions } from './components/UI/LevelInstructions';
import { LoadingScreen } from './components/UI/LoadingScreen';
import { useGameStore } from './store/useGameStore';

const App: React.FC = () => {
  const { gameState, setGameState } = useGameStore(state => state);

  // Pause handler
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const currentState = useGameStore.getState().gameState;
        if (currentState === 'PLAYING') {
          setGameState('PAUSED');
        } else if (currentState === 'PAUSED') {
          setGameState('PLAYING');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [setGameState]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <KeyboardControls
        map={[
          { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
          { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
          { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
          { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
          { name: 'jump', keys: ['Space'] },
        ]}
      >
        <Canvas shadows camera={{ fov: 75, position: [0, 1.8, 0] }}>
          <Stats />
          <Sky sunPosition={[100, 20, 100]} />
          <Stars />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} castShadow />

          <Suspense fallback={null}>
            {(gameState === 'PLAYING' || gameState === 'INSTRUCTIONS' || gameState === 'LEVEL_END' || gameState === 'PAUSED') && (
              <>
                <LevelGeometry />
                <EntityManager />
                {gameState === 'PLAYING' && <PlayerController />}
                {gameState === 'PLAYING' && <GameLoop />}
              </>
            )}
            {gameState === 'EDITOR' && (
              <LevelEditor />
            )}
          </Suspense>
        </Canvas>

        <HUD />
        <MainMenu />
        <LevelSelectMenu />
        <PauseMenu />
        <SettingsMenu
          onClose={() => setGameState('MENU')}
          isPauseMenu={false}
        />
        <LevelManager />
        <EditorUI />
        <LevelEndMenu />
        <LevelInstructions />
        <Suspense fallback={<LoadingScreen />}>
          {/* Loading handled by Suspense boundaries mostly */}
        </Suspense>
      </KeyboardControls>
    </div>
  );
};

export default App;
